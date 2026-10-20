// Luyện viết: dịch câu Việt→Anh, sắp xếp từ thành câu, tự đặt câu.
// Chấm tự động bằng cách so từng từ với câu mẫu (dãy con chung dài nhất), không cần AI.
// Bản QML tương ứng: qml/practice.js.

const CONTRACTIONS = {
  "i'm": "i am", "you're": "you are", "he's": "he is", "she's": "she is", "it's": "it is",
  "we're": "we are", "they're": "they are", "i've": "i have", "you've": "you have",
  "we've": "we have", "they've": "they have", "i'll": "i will", "you'll": "you will",
  "we'll": "we will", "they'll": "they will", "i'd": "i would", "don't": "do not",
  "doesn't": "does not", "didn't": "did not", "can't": "cannot", "won't": "will not",
  "isn't": "is not", "aren't": "are not", "wasn't": "was not", "weren't": "were not",
  "haven't": "have not", "hasn't": "has not", "let's": "let us", "that's": "that is",
  "what's": "what is", "there's": "there is", "couldn't": "could not",
  "shouldn't": "should not", "wouldn't": "would not", "how's": "how is",
};

export const plain = (s) => String(s ?? "").replace(/\*/g, "");

// Câu → danh sách từ đã chuẩn hóa (chữ thường, bỏ dấu câu, mở rộng dạng viết tắt).
export function tokens(s) {
  const out = [];
  const words = plain(s)
    .toLowerCase()
    .replace(/[‘’`´]/g, "'")
    .replace(/[^a-z0-9' ]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  for (const w of words) {
    const t = w.replace(/^'+|'+$/g, "");
    if (!t) continue;
    out.push(...(CONTRACTIONS[t] || t).split(" "));
  }
  return out;
}

// Dãy con chung dài nhất: đánh dấu từ nào của a và b khớp nhau theo đúng thứ tự.
export function lcs(a, b) {
  const n = a.length, m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const aMatch = new Array(n).fill(false), bMatch = new Array(m).fill(false);
  for (let i = 0, j = 0; i < n && j < m; ) {
    if (a[i] === b[j]) { aMatch[i] = bMatch[j] = true; i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  return { length: dp[0][0], aMatch, bMatch };
}

// So câu người học với câu mẫu. score: 0..1.
export function compare(user, model) {
  const u = tokens(user), m = tokens(model);
  if (!u.length) return { score: 0, user: u, model: m, userMatch: [], modelMatch: m.map(() => false) };
  const r = lcs(u, m);
  return { score: (2 * r.length) / (u.length + m.length), user: u, model: m, userMatch: r.aMatch, modelMatch: r.bMatch };
}

// Dạng quá khứ / phân từ của động từ bất quy tắc thường gặp → nguyên mẫu.
const IRREGULAR = {
  was: "be", were: "be", been: "be", am: "be", is: "be", are: "be", went: "go", gone: "go",
  woke: "wake", woken: "wake", took: "take", taken: "take", made: "make", got: "get", gotten: "get",
  gave: "give", given: "give", came: "come", saw: "see", seen: "see", ate: "eat", eaten: "eat",
  drank: "drink", drunk: "drink", bought: "buy", brought: "bring", thought: "think", taught: "teach",
  caught: "catch", spent: "spend", lent: "lend", left: "leave", felt: "feel", kept: "keep", slept: "sleep",
  met: "meet", paid: "pay", said: "say", told: "tell", sold: "sell", found: "find", had: "have", has: "have",
  did: "do", done: "do", does: "do", knew: "know", known: "know", wrote: "write", written: "write",
  forgot: "forget", forgotten: "forget", forgave: "forgive", forgiven: "forgive", began: "begin", begun: "begin",
  chose: "choose", chosen: "choose", broke: "break", broken: "break", spoke: "speak", spoken: "speak",
  understood: "understand", stood: "stand", sat: "sit", ran: "run", won: "win", lost: "lose", hung: "hang",
  heard: "hear", read: "read", built: "build", sent: "send", fell: "fall", fallen: "fall", drove: "drive",
  driven: "drive", rode: "ride", flew: "fly", flown: "fly", grew: "grow", grown: "grow", threw: "throw",
  wore: "wear", worn: "wear", froze: "freeze", frozen: "freeze", led: "lead", meant: "mean", fed: "feed",
  hurt: "hurt", quit: "quit", cut: "cut", put: "put", set: "set", cost: "cost", let: "let",
};

// Từ cần luyện có xuất hiện trong câu không (chấp nhận dạng đã chia: book → booked, woke → wake).
export function usesWord(sentence, target) {
  const base = (w) => IRREGULAR[w] || w;
  const s = tokens(sentence).map(base);
  const t = tokens(target).map(base);
  if (!t.length) return true;
  const stem = (w) => (w.length > 4 ? w.slice(0, Math.max(4, w.length - 2)) : w);
  return t.every((tw) => s.some((sw) => sw === tw || sw.startsWith(stem(tw))));
}

export function verdict(score) {
  if (score >= 0.9) return { label: "Rất tốt! Gần như giống câu mẫu", cls: "good" };
  if (score >= 0.65) return { label: "Khá gần! Xem chỗ khác biệt bên dưới", cls: "warn" };
  return { label: "Khác câu mẫu khá nhiều. Câu của bạn vẫn có thể đúng, hãy tự so sánh", cls: "bad" };
}

// Câu có đúng một cụm *...* → dùng được cho bài dịch & sắp xếp.
export function usableExamples(w) {
  return (w.examples || []).filter((e) => (e.en.match(/\*/g) || []).length === 2 && e.vi);
}

// Tách câu thành các "thẻ từ" để sắp xếp (giữ nguyên chữ hoa và dấu câu).
export function scramble(sentence) {
  const parts = plain(sentence).split(/\s+/).filter(Boolean);
  if (parts.length < 2) return parts;
  for (let attempt = 0; attempt < 10; attempt++) {
    const s = shuffleArr(parts);
    if (s.join(" ") !== parts.join(" ")) return s;
  }
  return parts.slice().reverse();
}

function shuffleArr(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Tạo bài luyện từ danh sách từ. mode: "mix" | "translate" | "reorder" | "write".
export function buildPractice(words, mode, count = 8) {
  const items = [];
  let writes = 0;
  for (const w of shuffleArr(words)) {
    if (items.length >= count) break;
    const exs = usableExamples(w);
    let type = mode;
    if (mode === "mix") {
      const r = Math.random();
      type = r < 0.45 ? "translate" : r < 0.8 ? "reorder" : "write";
      if (type === "write" && writes >= 2) type = "translate";
    }
    if ((type === "translate" || type === "reorder") && !exs.length) type = "write";
    const ex = exs.length ? exs[Math.floor(Math.random() * exs.length)] : null;
    if (type === "reorder") {
      const n = plain(ex.en).split(/\s+/).length;
      if (n < 4 || n > 14) type = "translate";
    }
    if (type === "write") writes++;
    const target = ex ? (ex.en.match(/\*(.+?)\*/) || [])[1] || w.word : w.word;
    items.push({ type, word: w, example: ex, target, pieces: type === "reorder" ? scramble(ex.en) : null });
  }
  return items;
}

// Đề bài soạn sẵn để dán vào Claude chat (dùng gói Claude sẵn có, không tốn API).
export function claudePrompt(item, answer) {
  const w = item.word;
  const task =
    item.type === "translate"
      ? `Đề: dịch sang tiếng Anh câu "${item.example.vi}"`
      : `Đề: tự đặt một câu tiếng Anh có dùng từ "${w.word}"`;
  return [
    "Bạn là giáo viên tiếng Anh của mình (trình độ hiện tại A2, mục tiêu B2). Hãy chấm câu mình viết.",
    `Từ cần luyện: "${w.word}" (${w.pos}), nghĩa: ${w.meaning}`,
    task,
    `Câu của mình: "${answer.trim()}"`,
    "",
    "Trả lời ngắn gọn bằng tiếng Việt:",
    `1. Câu đúng hay sai ngữ pháp? Dùng từ "${w.word}" đã tự nhiên chưa?`,
    "2. Sửa lỗi (nếu có) và giải thích ngắn gọn.",
    "3. Gợi ý 1–2 cách nói tự nhiên hơn như người bản xứ.",
    "4. Chấm điểm trên thang 10.",
  ].join("\n");
}
