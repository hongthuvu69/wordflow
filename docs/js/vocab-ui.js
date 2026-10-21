// Học từ vựng theo phương pháp có cơ sở khoa học:
// - Học theo "bài" 10 từ, chia nhóm 5 từ (giảm quá tải trí nhớ làm việc).
// - Mỗi từ mới đi qua 3 bước: Làm quen → Nhận diện (chọn nghĩa) → Nhớ chủ động (tự gõ từ).
// - Ôn tập bằng câu hỏi (retrieval practice), app tự chấm rồi xếp lịch ôn ngắt quãng SM-2
//   (dùng chung progress.review với flashcard nên vẫn đồng bộ với app trên PC).
import { content, progress, shuffle } from "./store.js";
import { esc, hl, plain, go, header, bar, speak, spk, toast, GEAR } from "./ui.js";

const UNIT = 10; // số từ mỗi bài
const CHUNK = 5; // số từ học cùng lúc
const REVIEW_MAX = 30; // tối đa số từ mỗi buổi ôn

let rerender = () => {};
let currentHash = "";
let sess = null; // buổi học/ôn đang diễn ra

// ---------------- Mức độ thành thạo ----------------

export const LEVELS = [
  { key: "new", name: "Mới", color: "var(--border)" },
  { key: "learning", name: "Đang học", color: "#F59E0B" },
  { key: "young", name: "Mới nhớ", color: "#60A5FA" },
  { key: "mature", name: "Nhớ lâu", color: "#8B5CF6" },
  { key: "master", name: "Thành thạo", color: "#10B981" },
];

export function masteryOf(id) {
  const r = progress.rows[id];
  if (!r) return 0;
  if (r.state === 1 || r.interval_days < 1) return 1;
  if (r.interval_days < 7) return 2;
  if (r.interval_days < 21) return 3;
  return 4;
}

function masteryCounts(ids) {
  const c = [0, 0, 0, 0, 0];
  for (const id of ids) c[masteryOf(id)]++;
  return c;
}

function masteryBar(ids, { legend = true } = {}) {
  const c = masteryCounts(ids);
  const total = ids.length || 1;
  return `<div class="mbar">${LEVELS.map((l, i) => (c[i] ? `<i style="width:${(100 * c[i]) / total}%;background:${l.color}"></i>` : "")).join("")}</div>
    ${
      legend
        ? `<div class="mlegend">${LEVELS.map((l, i) => `<span><i style="background:${l.color}"></i>${l.name} <b>${c[i]}</b></span>`).join("")}</div>`
        : ""
    }`;
}

function hardIds() {
  return content.allIds
    .filter((id) => {
      const r = progress.rows[id];
      return r && (r.lapses >= 2 || (r.reps > 0 && r.ease < 2.1));
    })
    .sort((a, b) => progress.rows[b].lapses - progress.rows[a].lapses || progress.rows[a].ease - progress.rows[b].ease);
}

function dueIds() {
  const now = Math.floor(Date.now() / 1000);
  return content.allIds
    .filter((id) => progress.rows[id] && progress.rows[id].due <= now)
    .sort((a, b) => progress.rows[a].due - progress.rows[b].due);
}

// ---------------- Lộ trình: chủ đề → bài 10 từ ----------------

export function units(topicId) {
  const ids = content.wordIds(topicId);
  const out = [];
  for (let i = 0; i < ids.length; i += UNIT) {
    const u = ids.slice(i, i + UNIT);
    const seen = u.filter((id) => progress.rows[id]).length;
    out.push({ n: out.length + 1, ids: u, seen, done: seen === u.length });
  }
  return out;
}

function currentTopic() {
  const saved = progress.settings.vlTopic;
  if (saved && content.topic(saved) && units(saved).some((u) => !u.done)) return content.topic(saved);
  return content.topics.find((t) => units(t.id).some((u) => !u.done)) || content.topics[0];
}

function setTopic(id) {
  progress.setSetting("vlTopic", id);
}

// ---------------- Kiểm tra câu trả lời gõ tay ----------------

const norm = (s) =>
  String(s ?? "")
    .toLowerCase()
    .replace(/[‘’`´]/g, "'")
    .replace(/[^a-z0-9' -]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function lev(a, b) {
  const m = a.length;
  const n = b.length;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[m][n];
}

// Trả về "exact" | "typo" | "form" (đúng từ gốc nhưng sai dạng trong câu) | "wrong"
function checkTyped(input, accepted, base) {
  const x = norm(input);
  if (!x) return "wrong";
  const acc = accepted.map(norm);
  if (acc.includes(x)) return "exact";
  if (base && norm(base) === x) return "form";
  for (const a of acc) {
    const tol = a.length >= 9 ? 2 : a.length >= 4 ? 1 : 0;
    if (tol && lev(a, x) <= tol) return "typo";
  }
  return "wrong";
}

// Câu ví dụ có *từ* → câu đục lỗ + đáp án đúng dạng.
function clozeOf(w) {
  const ex = (w.examples || []).find((e) => (e.en.match(/\*/g) || []).length === 2) || null;
  if (!ex) return null;
  const m = ex.en.match(/\*(.+?)\*/);
  return { text: ex.en.replace(/\*(.+?)\*/, "_____"), answer: m[1], vi: ex.vi, full: plain(ex.en) };
}

function hintOf(word, level) {
  // level 1: chữ cái đầu + số ký tự; level 2: thêm nửa từ
  return word
    .split("")
    .map((ch, i) => (ch === " " ? "  " : i === 0 || (level >= 2 && i < Math.ceil(word.length / 2)) ? ch : "_"))
    .join(" ");
}

// ---------------- Tạo buổi học / buổi ôn ----------------

function startLearn(topicId, unitN) {
  const u = units(topicId).find((x) => x.n === unitN) || units(topicId).find((x) => !x.done);
  if (!u) {
    toast("Bạn đã học hết chủ đề này 🎉");
    return;
  }
  const ids = u.ids.filter((id) => !progress.rows[id]).length ? u.ids.filter((id) => !progress.rows[id]) : u.ids;
  const steps = [];
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    chunk.forEach((id) => steps.push({ type: "intro", id }));
    shuffle(chunk).forEach((id) => steps.push({ type: "recog", id }));
    shuffle(chunk).forEach((id) => steps.push({ type: recallType(id), id }));
  }
  setTopic(topicId);
  sess = { kind: "learn", topicId, unitN: u.n, ids, steps, i: 0, mistakes: {}, firstTry: {}, ans: null, startedAt: Date.now() };
  go("#/learn");
}

function recallType(id) {
  return clozeOf(content.word(id)) && Math.random() < 0.5 ? "cloze" : "recall";
}

function startReview(ids, title = "Ôn tập") {
  ids = ids.slice(0, REVIEW_MAX);
  if (!ids.length) {
    toast("Không có từ nào cần ôn lúc này 👍");
    return;
  }
  const steps = shuffle(ids).map((id) => {
    const lv = masteryOf(id);
    const pool = lv <= 1 ? ["recog", "listen", "recall"] : lv === 2 ? ["recall", "cloze", "listen", "recog"] : ["cloze", "recall"];
    let type = pool[Math.floor(Math.random() * pool.length)];
    if (type === "cloze" && !clozeOf(content.word(id))) type = "recall";
    return { type, id };
  });
  sess = { kind: "review", title, ids, steps, i: 0, mistakes: {}, firstTry: {}, rated: {}, ans: null, startedAt: Date.now() };
  go("#/learn");
}

function startToday() {
  const due = dueIds();
  if (due.length) startReview(due, "Ôn tập hôm nay");
  else {
    const t = currentTopic();
    startLearn(t.id);
  }
}

// ---------------- Giao diện buổi học ----------------

const TYPE_LABEL = {
  intro: ["✨", "Từ mới"],
  recog: ["👀", "Chọn nghĩa đúng"],
  listen: ["🎧", "Nghe và chọn từ"],
  recall: ["🧠", "Nhớ lại từ tiếng Anh"],
  cloze: ["✍️", "Điền từ vào câu"],
};

function optionsFor(step) {
  if (step.options) return step.options;
  const w = content.word(step.id);
  const others = content.randomWords(3, w.id, w.topicId);
  const field = step.type === "listen" ? "word" : "meaning";
  const opts = shuffle([w, ...others]).map((x) => ({ id: x.id, text: x[field] }));
  step.options = opts;
  return opts;
}

function miniCard(w) {
  const ex = (w.examples || [])[0];
  return `<div class="wmini">
    <div class="row"><div class="grow"><div class="wm-word">${esc(w.word)}</div><div class="muted">${esc(w.ipa)} · ${esc(w.pos)}</div></div>${spk(w.word)}</div>
    <div class="wm-mean">${esc(w.meaning)}</div>
    ${ex ? `<div class="wm-ex"><div>${hl(ex.en)}</div><div class="muted small">${esc(ex.vi)}</div></div>` : ""}
  </div>`;
}

function viewIntro(w, step) {
  const ex = (w.examples || [])[0];
  return `<div class="lcard intro">
    <div class="row"><span class="chip ${w.level === "TOEIC" ? "warn" : "info"}">${esc(w.level)}</span><span class="chip plain">${esc(w.pos)}</span></div>
    <div class="big-word">${esc(w.word)}</div>
    <div class="row center-row"><span class="ipa">${esc(w.ipa)}</span>${spk(w.word)}${spk(w.word, true)}</div>
    <div class="meaning"><b>${esc(w.meaning)}</b>${w.definition ? `<i>${esc(w.definition)}</i>` : ""}</div>
    ${ex ? `<div class="example">${spk(ex.en)}<div><div class="en">${hl(ex.en)}</div><div class="vi">${esc(ex.vi)}</div></div></div>` : ""}
    ${w.collocations?.length ? `<div class="chips">${w.collocations.slice(0, 4).map((c) => `<button class="chip" data-say="${esc(c)}">🔊 ${esc(c)}</button>`).join("")}</div>` : ""}
    ${w.note ? `<div class="note"><div class="t">💡 Lưu ý</div>${hl(w.note)}</div>` : ""}
  </div>
  <div class="lfoot"><button class="btn primary block" data-act="vl-next">Đã nắm, tiếp tục →</button></div>`;
}

function viewChoice(w, step) {
  const a = sess.ans;
  const opts = optionsFor(step);
  const listen = step.type === "listen";
  return `<div class="lcard">
    ${
      listen
        ? `<div class="center"><button class="bigplay" data-say="${esc(w.word)}" aria-label="Nghe lại">🔊</button>
           <div class="muted small" style="margin-top:8px">Bấm để nghe lại · <button class="link" data-say="${esc(w.word)}" data-slow="1">🐢 nghe chậm</button></div></div>`
        : `<div class="big-word">${esc(w.word)}</div><div class="row center-row"><span class="ipa">${esc(w.ipa)}</span>${spk(w.word)}</div>`
    }
  </div>
  ${opts
    .map((o, i) => {
      let cls = "";
      if (a) cls = o.id === w.id ? "correct" : o.id === a.chosen ? "wrong" : "";
      return `<button class="opt ${cls}" data-act="vl-choose" data-i="${i}" ${a ? "disabled" : ""}><span class="n">${i + 1}</span><span class="grow">${esc(o.text)}</span></button>`;
    })
    .join("")}
  ${a ? feedback(w, a.ok) : ""}`;
}

function viewTyped(w, step) {
  const a = sess.ans;
  const cz = step.type === "cloze" ? clozeOf(w) : null;
  const target = cz ? cz.answer : w.word;
  const hint = step.hint || 0;
  return `<div class="lcard">
    ${
      cz
        ? `<div class="cloze">${esc(cz.text).replace("_____", `<span class="gap">${a ? esc(cz.answer) : "_____"}</span>`)}</div>
           <div class="muted" style="margin-top:6px">${esc(cz.vi)}</div>
           <div class="small" style="margin-top:10px">Gợi ý nghĩa: <b>${esc(w.meaning)}</b></div>`
        : `<div class="vi-prompt">${esc(w.meaning)}</div>
           ${w.definition ? `<div class="muted center">${esc(w.definition)}</div>` : ""}
           <div class="center" style="margin-top:6px"><span class="chip plain">${esc(w.pos)}</span></div>`
    }
    ${hint && !a ? `<div class="hint-line">${esc(hintOf(target, hint))}</div>` : ""}
  </div>
  <form data-form="vl-type" autocomplete="off">
    <input class="field type-in ${a ? (a.ok ? "ok" : "bad") : ""}" id="vl-input" value="${esc(a ? a.typed : "")}" placeholder="Gõ từ tiếng Anh…" autocapitalize="none" autocorrect="off" spellcheck="false" enterkeyhint="done" ${a ? "readonly" : "autofocus"}>
    ${
      a
        ? ""
        : `<div class="btns"><button type="button" class="btn" data-act="vl-hint" ${hint >= 2 ? "disabled" : ""}>💡 Gợi ý</button>
           <button type="button" class="btn" data-act="vl-skip">Không nhớ</button>
           <button type="submit" class="btn primary grow">Kiểm tra</button></div>`
    }
  </form>
  ${a ? feedback(w, a.ok, a.note) : ""}`;
}

function feedback(w, ok, note = "") {
  const canEasy = sess.kind === "review" && ok && !sess.rated[w.id + ":easy"];
  return `<div class="fb ${ok ? "good" : "bad"}">
    <div class="fb-head">${ok ? "🎉 Chính xác!" : "💡 Chưa đúng — ghi nhớ lại nhé"}${note ? `<div class="small" style="font-weight:500;margin-top:2px">${esc(note)}</div>` : ""}</div>
    ${miniCard(w)}
    <div class="btns">
      ${canEasy ? `<button class="btn" data-act="vl-easy">😎 Quá dễ</button>` : ""}
      <button class="btn primary grow" data-act="vl-next">Tiếp tục →</button>
    </div>
  </div>`;
}

function viewDone() {
  const s = sess;
  const ids = s.ids;
  const perfect = ids.filter((id) => !s.mistakes[id]).length;
  const mins = Math.max(1, Math.round((Date.now() - s.startedAt) / 60000));
  const next = s.kind === "learn" ? units(s.topicId).find((u) => !u.done) : null;
  return `<div class="done">
      <div class="emo">${perfect === ids.length ? "🏆" : "💪"}</div>
      <h2>${s.kind === "learn" ? `Hoàn thành bài ${s.unitN}!` : "Ôn tập xong!"}</h2>
      <p class="muted">${ids.length} từ · đúng ngay lần đầu ${perfect}/${ids.length} · ${mins} phút</p>
    </div>
    <div class="card" style="padding:6px 14px">
      ${ids
        .map((id) => {
          const w = content.word(id);
          const lv = LEVELS[masteryOf(id)];
          const st = progress.wordState(id);
          return `<a class="list-row" href="#/word/${id}"><span class="dot" style="background:${lv.color}"></span>
            <div class="grow"><div class="t">${esc(w.word)}</div><div class="muted small">${esc(w.meaning)}</div></div>
            <div class="right small"><b>${lv.name}</b><div class="muted">ôn ${st.dueText || ""}</div></div></a>`;
        })
        .join("")}
    </div>
    <div class="muted small center" style="margin:-4px 0 14px">Từ trả lời sai sẽ quay lại sớm hơn; từ đúng sẽ giãn lịch ôn dần (1 → 3 → 7 → 21 ngày…).</div>
    <div class="btns">
      ${next ? `<button class="btn primary grow" data-act="vl-learn" data-topic="${s.topicId}" data-unit="${next.n}">Học bài ${next.n} →</button>` : ""}
      ${dueIds().length ? `<button class="btn ${next ? "" : "primary"} grow" data-act="vl-review">Ôn ${dueIds().length} từ đến hạn</button>` : ""}
      <a class="btn grow" href="#/vocab">Về Từ vựng</a>
    </div>`;
}

function viewLearn() {
  if (!sess) {
    go("#/vocab");
    return "";
  }
  const s = sess;
  if (s.i >= s.steps.length) return `<div class="learn">${viewDone()}</div>`;
  const step = s.steps[s.i];
  const w = content.word(step.id);
  const [ico, label] = TYPE_LABEL[step.type];
  let body = "";
  if (step.type === "intro") body = viewIntro(w, step);
  else if (step.type === "recog" || step.type === "listen") body = viewChoice(w, step);
  else body = viewTyped(w, step);
  if (!s.spoken || s.spoken !== s.i) {
    s.spoken = s.i;
    if (step.type === "intro" || step.type === "listen" || (step.type === "recog" && progress.settings.autoSpeak)) setTimeout(() => speak(w.word), 250);
  }
  const title = s.kind === "learn" ? `${content.topic(s.topicId)?.icon || ""} Bài ${s.unitN} · ${esc(content.topic(s.topicId)?.title_vi || "")}` : esc(s.title);
  return `<div class="learn">
    <div class="ltop">
      <button class="icon-btn" data-act="vl-exit" aria-label="Thoát">✕</button>
      <div class="grow">${bar(s.i, s.steps.length)}</div>
      <span class="muted small">${s.i + 1}/${s.steps.length}</span>
    </div>
    <div class="lhead"><span class="chip purple">${ico} ${label}</span><span class="muted small grow" style="text-align:right">${title}</span></div>
    ${body}
  </div>`;
}

// ---------------- Xử lý trả lời ----------------

function answer(ok, extra = {}) {
  const s = sess;
  const step = s.steps[s.i];
  s.ans = { ok, ...extra };
  if (!ok) {
    s.mistakes[step.id] = (s.mistakes[step.id] || 0) + 1;
    // Hỏi lại từ này sau vài câu, bằng dạng dễ hơn nếu đang ở dạng gõ.
    const retry = { type: step.type === "intro" ? "recog" : step.type, id: step.id, retry: true };
    s.steps.splice(Math.min(s.steps.length, s.i + 4), 0, retry);
  }
  if (s.kind === "review" && !(step.id in s.rated)) {
    // Lần trả lời đầu tiên quyết định điểm: đúng = Nhớ, có gợi ý/gõ gần đúng = Khó, sai = Quên.
    const r = ok ? (step.hint || extra.typo ? 2 : 3) : 1;
    s.rated[step.id] = r;
    progress.review(step.id, r);
  }
  if (!ok || step.type !== "intro") speak(content.word(step.id).word);
  rerender();
}

function next() {
  const s = sess;
  s.ans = null;
  s.i++;
  if (s.i >= s.steps.length && s.kind === "learn") {
    // Kết thúc bài: chấm theo số lần sai của từng từ.
    for (const id of s.ids) {
      const m = s.mistakes[id] || 0;
      progress.review(id, m === 0 ? 3 : m <= 2 ? 2 : 1);
    }
  }
  rerender();
  window.scrollTo(0, 0);
}

// ---------------- Trang tổng Từ vựng ----------------

export function viewVocabHub() {
  const due = dueIds();
  const s = progress.stats(content.allIds);
  const t = currentTopic();
  const us = units(t.id);
  const nextU = us.find((u) => !u.done);
  const learned = content.allIds.filter((id) => progress.rows[id]).length;
  const hard = hardIds();
  const newLeft = Math.max(0, progress.settings.dailyNewLimit - s.newToday);
  const date = new Date().toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit" });
  return `${header("Từ vựng", esc(date), { right: `<a class="icon-btn" href="#/settings" aria-label="Cài đặt">${GEAR}</a>` })}
    <div class="card hero vhero">
      <div class="label">Hôm nay</div>
      <div class="vh-row">
        <div><b>${due.length}</b><span>từ cần ôn</span></div>
        <div><b>${newLeft}</b><span>từ mới còn lại</span></div>
        <div><b>${s.streak}🔥</b><span>ngày liên tiếp</span></div>
      </div>
      <button class="btn" data-act="vl-today">${due.length ? `Ôn ${Math.min(due.length, REVIEW_MAX)} từ đến hạn →` : `Học bài mới →`}</button>
      <div class="hint" style="margin:10px 0 0">${due.length ? "Ôn trước, học mới sau: ôn đúng hạn giúp nhớ lâu gấp nhiều lần." : "Không có từ đến hạn. Học 10 từ mới hôm nay nhé!"}</div>
    </div>

    <div class="section-title row"><span class="grow">📍 Đang học</span><a class="link" href="#/topics">Đổi chủ đề</a></div>
    <div class="card cur-topic">
      <div class="row"><span class="ico-lg">${t.icon}</span>
        <div class="grow"><div class="t">${esc(t.title_vi)}</div><div class="muted small">${esc(t.level)} · ${content.wordIds(t.id).length} từ · ${us.length} bài</div></div></div>
      <div class="unit-dots">${us.map((u) => `<span class="${u.done ? "done" : u === nextU ? "cur" : ""}" title="Bài ${u.n}">${u.done ? "✓" : u.n}</span>`).join("")}</div>
      ${
        nextU
          ? `<button class="btn primary block" data-act="vl-learn" data-topic="${t.id}" data-unit="${nextU.n}">Học bài ${nextU.n} · ${nextU.ids.length - nextU.seen} từ mới</button>`
          : `<div class="muted small">Đã học hết chủ đề này 🎉</div>`
      }
    </div>

    <div class="section-title row"><span class="grow">📊 Mức độ ghi nhớ</span><span class="muted small">${learned}/${content.allIds.length} từ</span></div>
    <div class="card">${masteryBar(content.allIds.filter((id) => progress.rows[id]).length ? content.allIds.filter((id) => progress.rows[id]) : [])}
      ${learned ? "" : `<div class="muted small">Học bài đầu tiên để bắt đầu theo dõi mức độ ghi nhớ.</div>`}</div>

    <div class="tools6">
      <a href="#/topics"><span>📚</span>Chủ đề</a>
      <a href="#/hard"><span>🧩</span>Từ khó${hard.length ? ` <b>${hard.length}</b>` : ""}</a>
      <a href="#/study"><span>🃏</span>Thẻ lật</a>
      <a href="#/quiz"><span>🎯</span>Quiz</a>
      <a href="#/practice"><span>✍️</span>Luyện viết</a>
      <a href="#/phrases"><span>💬</span>Mẫu câu</a>
    </div>

    <div class="section-title">🧪 Phương pháp học</div>
    <div class="card method">
      <div><b>1. Làm quen</b><span>Nghe phát âm, đọc nghĩa và câu ví dụ trong ngữ cảnh.</span></div>
      <div><b>2. Nhận diện</b><span>Chọn nghĩa đúng hoặc nghe – chọn từ.</span></div>
      <div><b>3. Nhớ chủ động</b><span>Tự gõ lại từ: bước khó nhất nhưng giúp nhớ lâu nhất.</span></div>
      <div><b>4. Ôn ngắt quãng</b><span>App tự hẹn ngày ôn: sai thì ôn sớm, đúng thì giãn dần 1 → 3 → 7 → 21 ngày.</span></div>
    </div>`;
}

export function unitsHtml(topicId) {
  const us = units(topicId);
  return `<div class="units">${us
    .map(
      (u) => `<button class="unit ${u.done ? "done" : ""}" data-act="vl-learn" data-topic="${topicId}" data-unit="${u.n}">
        <span class="un">${u.done ? "✓" : u.n}</span>
        <div class="grow"><div class="t">Bài ${u.n}</div><div class="muted small">${u.ids.length} từ · đã học ${u.seen}</div></div>
        ${masteryBar(u.ids, { legend: false })}
      </button>`
    )
    .join("")}</div>`;
}

function viewHard() {
  const ids = hardIds();
  return `${header("🧩 Từ khó", "Những từ bạn hay quên: ôn riêng để dứt điểm", { back: true })}
    ${
      ids.length
        ? `<button class="btn primary block" data-act="vl-hard" style="margin-bottom:14px">Ôn ${Math.min(ids.length, REVIEW_MAX)} từ khó →</button>
           <div class="card" style="padding:6px 14px">${ids
             .map((id) => {
               const w = content.word(id);
               const r = progress.rows[id];
               return `<a class="list-row" href="#/word/${id}"><div class="grow"><div class="t">${esc(w.word)}</div><div class="muted small">${esc(w.meaning)}</div></div>
                 <span class="chip bad">quên ${r.lapses} lần</span></a>`;
             })
             .join("")}</div>`
        : `<div class="done"><div class="emo">🌱</div><h2>Chưa có từ khó</h2><p class="muted">Từ nào bạn quên từ 2 lần trở lên sẽ xuất hiện ở đây.</p></div>`
    }`;
}

// ---------------- Điều hướng & sự kiện ----------------

export const routes = [
  [/^#\/vocab$/, "vocab", () => viewVocabHub()],
  [/^#\/learn$/, "learn", () => viewLearn()],
  [/^#\/hard$/, "vocab", () => viewHard()],
];

export function init(renderFn) {
  rerender = renderFn;
}

export function onRoute(hash) {
  currentHash = hash;
}

export function focusInput() {
  const el = document.getElementById("vl-input");
  if (el && !el.readOnly) el.focus({ preventScroll: true });
}

document.addEventListener("click", (ev) => {
  const el = ev.target.closest("[data-act]");
  if (!el) return;
  const act = el.dataset.act;
  if (!act.startsWith("vl-")) return;
  const s = sess;
  switch (act) {
    case "vl-today":
      startToday();
      break;
    case "vl-learn":
      startLearn(el.dataset.topic, Number(el.dataset.unit));
      break;
    case "vl-review":
      startReview(dueIds(), "Ôn tập hôm nay");
      break;
    case "vl-hard":
      startReview(hardIds(), "Ôn từ khó");
      break;
    case "vl-exit":
      if (s && s.i < s.steps.length && s.i > 0 && !confirm("Thoát buổi học? Các từ đã trả lời trong buổi ôn vẫn được lưu.")) break;
      sess = null;
      go("#/vocab");
      break;
    case "vl-next":
      next();
      break;
    case "vl-choose": {
      if (!s || s.ans) break;
      const step = s.steps[s.i];
      const o = optionsFor(step)[Number(el.dataset.i)];
      answer(o.id === step.id, { chosen: o.id });
      break;
    }
    case "vl-hint": {
      const step = s.steps[s.i];
      step.hint = (step.hint || 0) + 1;
      rerender();
      break;
    }
    case "vl-skip":
      answer(false, { typed: "" });
      break;
    case "vl-easy": {
      const id = s.steps[s.i].id;
      s.rated[id + ":easy"] = true;
      progress.review(id, 4);
      toast("Đã giãn lịch ôn cho từ này");
      next();
      break;
    }
  }
});

document.addEventListener("submit", (ev) => {
  if (ev.target.dataset.form !== "vl-type") return;
  ev.preventDefault();
  const s = sess;
  if (!s) return;
  if (s.ans) {
    next(); // Enter lần nữa sau khi đã chấm = sang câu tiếp
    return;
  }
  const step = s.steps[s.i];
  const w = content.word(step.id);
  const input = document.getElementById("vl-input").value;
  const cz = step.type === "cloze" ? clozeOf(w) : null;
  const accepted = cz ? [cz.answer] : [w.word];
  const res = checkTyped(input, accepted, cz ? w.word : null);
  if (res === "exact") answer(true, { typed: input });
  else if (res === "typo") answer(true, { typed: input, typo: true, note: `Gần đúng, chú ý chính tả: ${accepted[0]}` });
  else if (res === "form") answer(true, { typed: input, typo: true, note: `Đúng từ! Trong câu này cần dạng: ${cz.answer}` });
  else answer(false, { typed: input });
});

document.addEventListener("keydown", (ev) => {
  if (!sess || !currentHash.startsWith("#/learn")) return;
  if (ev.target.matches("input, textarea")) return;
  const s = sess;
  if (ev.key === "Enter" && (s.ans || s.steps[s.i]?.type === "intro")) {
    ev.preventDefault();
    document.querySelector('[data-act="vl-next"]')?.click();
  } else if ("1234".includes(ev.key) && !s.ans) {
    document.querySelector(`[data-act="vl-choose"][data-i="${Number(ev.key) - 1}"]`)?.click();
  }
});

export const isBusy = () => currentHash.startsWith("#/learn");
