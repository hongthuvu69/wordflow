// Dữ liệu TOEIC: ngân hàng đề (docs/tests), lượt làm bài, sổ lỗi sai, nhật ký học,
// lộ trình 48 tuần và số liệu cho báo cáo tuần. Tất cả lưu trong localStorage của máy.
import { progress, shuffle, startOfDay, dateKey, uuid } from "./store.js";

const LS = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v === null ? fallback : JSON.parse(v);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn("localStorage write failed", key, e);
    }
  },
};

const nowSecs = () => Math.floor(Date.now() / 1000);
const DAY = 86400;

// ---------------- Phân loại ----------------

export const PARTS = {
  1: { name: "Mô tả tranh", section: "L", icon: "🖼️", short: "Photographs" },
  2: { name: "Hỏi – Đáp", section: "L", icon: "💬", short: "Question-Response" },
  3: { name: "Hội thoại", section: "L", icon: "👥", short: "Conversations" },
  4: { name: "Bài nói ngắn", section: "L", icon: "📢", short: "Talks" },
  5: { name: "Hoàn thành câu", section: "R", icon: "✏️", short: "Incomplete Sentences" },
  6: { name: "Hoàn thành đoạn văn", section: "R", icon: "📄", short: "Text Completion" },
  7: { name: "Đọc hiểu", section: "R", icon: "📰", short: "Reading Comprehension" },
};

// Số câu mỗi Part trong đề thật (tổng 200).
export const PART_SIZE = { 1: 6, 2: 25, 3: 39, 4: 30, 5: 30, 6: 16, 7: 54 };

export const TYPES = {
  "p1-people": [1, "Tả người (hành động)"],
  "p1-object": [1, "Tả vật / vị trí"],
  "p1-scene": [1, "Tả cảnh"],
  "p2-wh": [2, "Câu hỏi WH (who/what/where/when/why/how)"],
  "p2-yesno": [2, "Câu hỏi Yes/No"],
  "p2-request": [2, "Đề nghị / yêu cầu"],
  "p2-choice": [2, "Câu hỏi lựa chọn (A or B)"],
  "p2-statement": [2, "Câu trần thuật"],
  "p2-indirect": [2, "Trả lời gián tiếp"],
  "p34-topic": [3, "Chủ đề / mục đích"],
  "p34-speaker": [3, "Người nói / địa điểm"],
  "p34-detail": [3, "Chi tiết"],
  "p34-next": [3, "Hành động tiếp theo"],
  "p34-implied": [3, "Hàm ý câu nói"],
  "p34-graphic": [3, "Câu hỏi kèm biểu đồ"],
  "p5-wordform": [5, "Từ loại"],
  "p5-tense": [5, "Thì của động từ"],
  "p5-passive": [5, "Bị động"],
  "p5-preposition": [5, "Giới từ"],
  "p5-conjunction": [5, "Liên từ"],
  "p5-pronoun": [5, "Đại từ"],
  "p5-relative": [5, "Mệnh đề quan hệ"],
  "p5-comparison": [5, "So sánh"],
  "p5-vocab": [5, "Từ vựng"],
  "p6-sentence": [6, "Chọn câu điền vào đoạn"],
  "p7-main": [7, "Ý chính / mục đích"],
  "p7-detail": [7, "Chi tiết"],
  "p7-inference": [7, "Suy luận"],
  "p7-not": [7, "Câu hỏi NOT true"],
  "p7-vocab": [7, "Từ đồng nghĩa"],
  "p7-insert": [7, "Chèn câu"],
  "p7-intent": [7, "Ý định người viết"],
};
export const typeLabel = (t) => (TYPES[t] ? TYPES[t][1] : t || "Khác");

export const REASONS = {
  vocab: "Không biết từ",
  listen: "Nghe không ra",
  trap: "Bị bẫy đáp án",
  grammar: "Hổng ngữ pháp",
  time: "Hết giờ / đoán",
  careless: "Ẩu, đọc sót",
};

// ---------------- Quy đổi điểm (ước tính) ----------------

// Bảng gần đúng số câu đúng (trên 100) → điểm (5–495) cho từng phần thi.
const CURVE = {
  L: [[0, 5], [25, 105], [50, 245], [75, 390], [90, 465], [96, 495], [100, 495]],
  R: [[0, 5], [25, 80], [50, 210], [75, 355], [90, 445], [97, 495], [100, 495]],
};
export function scaled(section, correct, total) {
  if (!total) return null;
  const raw = (100 * correct) / total;
  const pts = CURVE[section];
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    if (raw <= x1) return Math.round((y0 + ((raw - x0) / (x1 - x0)) * (y1 - y0)) / 5) * 5;
  }
  return 495;
}

// ---------------- Ngân hàng đề ----------------

export const bank = {
  loaded: false,
  tests: [], // metadata từ tests/index.json
  full: new Map(), // id → đề đã chuẩn hóa
  questions: new Map(), // qid → { q, group, part, testId }

  async load() {
    if (this.loaded) return;
    const index = await (await fetch("tests/index.json")).json();
    const docs = await Promise.all(index.tests.map((t) => fetch("tests/" + t.file).then((r) => r.json())));
    for (const doc of docs) {
      const test = normalize(doc);
      this.full.set(test.id, test);
      for (const part of test.parts)
        for (const g of part.groups)
          for (const q of g.questions) this.questions.set(q.id, { q, group: g, part: part.part, testId: test.id });
    }
    this.tests = index.tests.map((t) => {
      const test = this.full.get(t.id);
      return { ...t, title: test.title, kind: test.kind, duration: test.duration, count: countQuestions(test), parts: test.parts.map((p) => p.part) };
    });
    this.loaded = true;
  },

  test(id) {
    return this.full.get(id);
  },

  // Số câu theo Part / theo dạng có trong ngân hàng.
  countBy(field) {
    const out = {};
    for (const { q, part } of this.questions.values()) {
      const k = field === "part" ? part : q.type;
      out[k] = (out[k] || 0) + 1;
    }
    return out;
  },

  // Tạo bộ luyện tập: lấy nguyên nhóm câu (đoạn hội thoại/đoạn văn) chứa câu phù hợp,
  // ưu tiên câu chưa làm và câu từng sai.
  drill({ part, type, qids, count = 10, title }) {
    const answered = answeredMap();
    const partSet = part ? [].concat(part) : null;
    const groups = new Map(); // groupId → { part, group, score }
    for (const { q, group, part: p } of this.questions.values()) {
      if (partSet && !partSet.includes(p)) continue;
      if (type && q.type !== type) continue;
      if (qids && !qids.includes(q.id)) continue;
      const st = answered[q.id];
      const score = !st ? 2 : st.lastOk ? 0 : 1; // chưa làm > từng sai > đã đúng
      const cur = groups.get(group.id);
      if (!cur) groups.set(group.id, { part: p, group, score, rnd: Math.random() });
      else cur.score = Math.max(cur.score, score);
    }
    const picked = [];
    let n = 0;
    for (const g of [...groups.values()].sort((a, b) => b.score - a.score || a.rnd - b.rnd)) {
      if (n >= count) break;
      picked.push(g);
      n += g.group.questions.length;
    }
    picked.sort((a, b) => a.part - b.part);
    const parts = [];
    for (const g of picked) {
      let sec = parts.find((s) => s.part === g.part);
      if (!sec) parts.push((sec = { part: g.part, groups: [] }));
      sec.groups.push(g.group);
    }
    const test = {
      id: "drill-" + Date.now().toString(36),
      kind: qids ? "mistakes" : "drill",
      title: title || (type ? typeLabel(type) : partSet ? partSet.map((x) => "Part " + x).join(" + ") + (partSet.length === 1 ? " · " + PARTS[partSet[0]].name : "") : "Luyện tập"),
      duration: 0,
      parts,
    };
    numberQuestions(test);
    return test;
  },
};

function normalize(doc) {
  const test = {
    id: doc.id,
    title: doc.title,
    kind: doc.kind || "mini",
    duration: doc.duration || 0,
    source: doc.source || "",
    parts: (doc.parts || []).map((p) => ({
      part: p.part,
      directions: p.directions || "",
      groups: (p.groups || []).map((g, gi) => ({
        ...g,
        id: g.id || `${doc.id}-p${p.part}-g${gi + 1}`,
        questions: (g.questions || []).map((q) => ({ ...q, type: q.type || "" })),
      })),
    })),
  };
  numberQuestions(test);
  return test;
}

function numberQuestions(test) {
  let n = 0;
  for (const p of test.parts)
    for (const g of p.groups)
      for (const q of g.questions) {
        n++;
        q.no = test.kind === "drill" || test.kind === "mistakes" ? n : q.n || n;
      }
}

const countQuestions = (test) => test.parts.reduce((s, p) => s + p.groups.reduce((t, g) => t + g.questions.length, 0), 0);

export function flatQuestions(test) {
  const out = [];
  for (const p of test.parts) for (const g of p.groups) for (const q of g.questions) out.push({ q, group: g, part: p.part });
  return out;
}

// ---------------- Lượt làm bài ----------------

export const attempts = LS.get("wf.toeic.attempts", []);
export const mistakes = LS.get("wf.toeic.mistakes", {}); // qid → { qid, wrong, lastWrong, reason, resolved, lastAnswer }
export const study4 = LS.get("wf.toeic.study4", []);
const log = LS.get("wf.toeic.log", {}); // ngày → { reviews, good, ticks: {taskId: true} }
export const plan = { target: 800, start: "", examDate: "", weeklyHours: 13.5, ...LS.get("wf.toeic.plan", {}) };

const saveAttempts = () => LS.set("wf.toeic.attempts", attempts);
const saveMistakes = () => LS.set("wf.toeic.mistakes", mistakes);
const saveLog = () => LS.set("wf.toeic.log", log);
const saveStudy4 = () => LS.set("wf.toeic.study4", study4);
export const savePlan = () => LS.set("wf.toeic.plan", plan);

if (!plan.start) {
  plan.start = dateKey(mondayOf(nowSecs()));
  savePlan();
}

function answeredMap() {
  // qid → { lastOk, n, ok }
  const out = {};
  for (const a of attempts) {
    for (const [qid, ok] of Object.entries(a.res || {})) {
      const st = out[qid] || (out[qid] = { n: 0, ok: 0, lastOk: false });
      st.n++;
      st.ok += ok;
      st.lastOk = !!ok;
    }
  }
  return out;
}

export function grade(test, answers) {
  const res = {};
  const perPart = {};
  const perType = {};
  const sec = { L: { c: 0, t: 0 }, R: { c: 0, t: 0 } };
  let correct = 0;
  let total = 0;
  for (const { q, part } of flatQuestions(test)) {
    const ok = answers[q.id] === q.answer ? 1 : 0;
    res[q.id] = ok;
    total++;
    correct += ok;
    const pp = perPart[part] || (perPart[part] = { c: 0, t: 0 });
    pp.c += ok;
    pp.t++;
    const tt = perType[q.type] || (perType[q.type] = { c: 0, t: 0 });
    tt.c += ok;
    tt.t++;
    const s = sec[PARTS[part].section];
    s.c += ok;
    s.t++;
  }
  const L = scaled("L", sec.L.c, sec.L.t);
  const R = scaled("R", sec.R.c, sec.R.t);
  return {
    res, perPart, perType, correct, total,
    sec,
    est: { L, R, total: L !== null && R !== null ? L + R : null },
  };
}

export function saveAttempt(test, answers, { startedAt, elapsed, flagged }) {
  const g = grade(test, answers);
  const a = {
    id: uuid(),
    testId: test.id,
    title: test.title,
    kind: test.kind,
    startedAt,
    finishedAt: nowSecs(),
    elapsed: Math.round(elapsed),
    answers,
    flagged: [...(flagged || [])],
    ...g,
  };
  attempts.push(a);
  saveAttempts();
  // Cập nhật sổ lỗi sai.
  for (const [qid, ok] of Object.entries(g.res)) {
    const m = mistakes[qid];
    if (!ok) {
      mistakes[qid] = { qid, wrong: (m?.wrong || 0) + 1, lastWrong: a.finishedAt, reason: m?.reason || "", resolved: false, lastAnswer: answers[qid] ?? null, streak: 0 };
    } else if (m && !m.resolved) {
      m.streak = (m.streak || 0) + 1;
      // Làm đúng lại 2 lần liên tiếp thì coi như đã khắc phục.
      if (m.streak >= 2 || test.kind === "mistakes") m.resolved = true;
    }
  }
  saveMistakes();
  return a;
}

export function attempt(id) {
  return attempts.find((a) => a.id === id);
}

export function setReason(qid, reason) {
  if (!mistakes[qid]) return;
  mistakes[qid].reason = reason;
  saveMistakes();
}

export function openMistakes() {
  return Object.values(mistakes)
    .filter((m) => !m.resolved && bank.questions.has(m.qid))
    .sort((a, b) => b.lastWrong - a.lastWrong);
}

export function addStudy4(entry) {
  study4.push({ id: uuid(), ts: nowSecs(), ...entry });
  study4.sort((a, b) => a.ts - b.ts);
  saveStudy4();
}

export function removeStudy4(id) {
  const i = study4.findIndex((e) => e.id === id);
  if (i >= 0) {
    study4.splice(i, 1);
    saveStudy4();
  }
}

// ---------------- Nhật ký học ----------------

function dayLog(key = dateKey(nowSecs())) {
  return log[key] || (log[key] = { reviews: 0, good: 0, ticks: {} });
}

// Ghi lại từng lượt ôn flashcard để tính số lượt ôn và tỉ lệ nhớ theo tuần.
progress.onChange((kind) => {
  if (kind !== "review") return;
  const last = progress.reviews[progress.reviews.length - 1];
  if (!last) return;
  const d = dayLog(dateKey(last.ts));
  d.reviews++;
  if (last.rating >= 3) d.good++;
  saveLog();
});

export function isTicked(taskId, key = dateKey(nowSecs())) {
  return !!log[key]?.ticks?.[taskId];
}
export function toggleTick(taskId, value) {
  const d = dayLog();
  d.ticks[taskId] = value ?? !d.ticks[taskId];
  saveLog();
}

// ---------------- Lộ trình 48 tuần ----------------

export const PHASES = [
  { n: 1, name: "Nền móng", from: 1, to: 12, score: [450, 550], words: 1200, focus: "Phát âm, ngữ pháp lõi, Part 1–2, Part 5 cơ bản, shadowing" },
  { n: 2, name: "Bứt phá", from: 13, to: 24, score: [550, 650], words: 2200, focus: "Part 3–4 (paraphrase), Part 5–6 đầy đủ, Part 7 đoạn đơn" },
  { n: 3, name: "Tăng tốc", from: 25, to: 38, score: [650, 750], words: 3000, focus: "Part 7 đoạn đôi/ba, quản lý thời gian, đề full hằng tuần" },
  { n: 4, name: "Về đích", from: 39, to: 48, score: [750, 800], words: 3500, focus: "Chữa lỗi sai có hệ thống, 1–2 đề/tuần, đăng ký thi" },
];

export function mondayOf(secs) {
  const d = new Date(secs * 1000);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return Math.floor(d.getTime() / 1000);
}

const parseDay = (key) => {
  const [y, m, d] = key.split("-").map(Number);
  return Math.floor(new Date(y, m - 1, d).getTime() / 1000);
};

export function currentWeek() {
  const start = mondayOf(parseDay(plan.start));
  return Math.max(1, Math.floor((mondayOf(nowSecs()) - start) / (7 * DAY)) + 1);
}

export function phaseOf(week) {
  return PHASES.find((p) => week >= p.from && week <= p.to) || PHASES[PHASES.length - 1];
}

// Điểm mục tiêu theo tuần (tăng tuyến tính trong từng giai đoạn).
export function expectedScore(week) {
  const p = phaseOf(week);
  const t = (Math.min(week, p.to) - p.from + 1) / (p.to - p.from + 1);
  return Math.round(p.score[0] + t * (p.score[1] - p.score[0]));
}

// ---------------- Lịch học trong ngày ----------------

// Bài chính buổi tối theo thứ (1 = thứ 2 … 5 = thứ 6).
const EVENING = {
  1: { parts: [1, 2], title: "Part 1 + 2 · Nghe tranh & hỏi đáp", sub: "Làm bài rồi chép chính tả các câu sai" },
  2: { parts: [5, 6], title: "Part 5 + 6 · Ngữ pháp & điền đoạn", sub: "Ghi lý do sai cho từng câu" },
  3: { parts: [3], title: "Part 3 · Hội thoại", sub: "Đọc trước câu hỏi, gạch từ khóa" },
  4: { parts: [7], title: "Part 7 · Đọc hiểu (bấm giờ)", sub: "Mục tiêu: 1 phút/câu" },
  5: { parts: [4], title: "Part 4 · Bài nói + luyện nói", sub: "Nghe xong tóm tắt lại bằng lời của bạn" },
};

function didPartToday(parts, today) {
  return attempts.some((a) => a.finishedAt >= today && parts.some((p) => a.perPart?.[p]));
}

export function todayTasks() {
  const now = nowSecs();
  const today = startOfDay(0);
  const wd = new Date().getDay(); // 0 = CN
  const d = log[dateKey(now)] || { reviews: 0 };
  const vocabDone = d.reviews >= 10;
  const tasks = [];
  const vocab = { id: "vocab", icon: "🃏", title: "Ôn từ vựng + học từ mới", sub: `${d.reviews} lượt ôn hôm nay`, min: 15, act: "vl-today", done: vocabDone, when: "Sáng / đi làm" };

  if (wd >= 1 && wd <= 5) {
    const ev = EVENING[wd];
    tasks.push(vocab);
    // Thứ 3 bài chính cũng là Part 5 nên cần 2 lượt Part 5 mới tính xong cả hai.
    const part5Today = attempts.filter((a) => a.finishedAt >= today && a.perPart?.[5]).length;
    tasks.push({ id: "lunch", icon: "⚡", title: "Mini drill 10 câu Part 5", sub: "Ngữ pháp nhanh giờ nghỉ trưa", min: 15, act: "drill-part", parts: [5], done: part5Today >= 1, when: "Nghỉ trưa" });
    tasks.push({ id: "main", icon: "🎯", title: ev.title, sub: ev.sub, min: 35, act: "drill-part", parts: ev.parts, done: wd === 2 ? part5Today >= 2 && didPartToday([6], today) : ev.parts.every((p) => didPartToday([p], today)), when: "Buổi tối" });
    tasks.push({ id: "shadow", icon: "🗣️", title: "Shadowing 10 phút", sub: "Nghe 1 câu → dừng → nói lại y hệt ngữ điệu", min: 10, href: "#/phrases", manual: true, done: isTicked("shadow"), when: "Trước khi ngủ" });
  } else if (wd === 6) {
    const doneFull = attempts.some((a) => a.finishedAt >= today && (a.kind === "full" || a.kind === "mini")) || study4.some((e) => e.ts >= today);
    tasks.push({ id: "mock", icon: "📝", title: "Thi thử đề full (120 phút)", sub: "Làm trên Study4 rồi nhập điểm, hoặc làm đề trong app", min: 120, href: "#/tests", done: doneFull, when: "Sáng thứ 7" });
    tasks.push({ id: "fix", icon: "🔍", title: "Chữa đề + ghi lý do sai", sub: "Mỗi câu sai: ghi lý do và từ mới", min: 60, href: "#/mistakes", manual: true, done: isTicked("fix"), when: "Sau khi thi" });
    tasks.push({ id: "speak", icon: "🎙️", title: "Luyện nói 20 phút", sub: "Tự nói 1 chủ đề trong 1–2 phút, ghi âm nghe lại", min: 20, manual: true, done: isTicked("speak"), when: "Chiều / tối" });
    tasks.push({ ...vocab, min: 10 });
  } else {
    tasks.push({ id: "report", icon: "📊", title: "Xem báo cáo tuần", sub: "Biết điểm yếu → kế hoạch tuần sau", min: 10, href: "#/report", done: isTicked("report"), when: "Chủ nhật" });
    tasks.push({ id: "redo", icon: "♻️", title: "Làm lại câu sai trong tuần", sub: `${openMistakes().length} câu đang chờ`, min: 20, act: "drill-mistakes", done: attempts.some((a) => a.finishedAt >= today && a.kind === "mistakes"), when: "Chủ nhật" });
    tasks.push({ ...vocab, min: 15 });
  }
  return tasks;
}

// ---------------- Số liệu theo tuần ----------------

export function weekRange(offset = 0) {
  const start = mondayOf(nowSecs()) + offset * 7 * DAY;
  return [start, start + 7 * DAY];
}

function minutesIn(from, to) {
  let min = 0;
  for (const a of attempts) if (a.finishedAt >= from && a.finishedAt < to) min += a.elapsed / 60;
  for (const [key, d] of Object.entries(log)) {
    const t = parseDay(key);
    if (t < from || t >= to) continue;
    min += d.reviews * 0.3; // khoảng 18 giây mỗi thẻ
    for (const id of Object.keys(d.ticks || {})) if (d.ticks[id]) min += TICK_MIN[id] || 10;
  }
  return min;
}
const TICK_MIN = { shadow: 10, fix: 60, speak: 20, report: 10 };

function activeDays(from, to) {
  const days = new Set();
  for (const a of attempts) if (a.finishedAt >= from && a.finishedAt < to) days.add(dateKey(a.finishedAt));
  for (const [key, d] of Object.entries(log)) {
    const t = parseDay(key);
    if (t >= from && t < to && (d.reviews || Object.values(d.ticks || {}).some(Boolean))) days.add(key);
  }
  return days.size;
}

export function weekStats(offset = 0) {
  const [from, to] = weekRange(offset);
  const inWeek = attempts.filter((a) => a.finishedAt >= from && a.finishedAt < to);
  const perPart = {};
  const perType = {};
  let correct = 0;
  let total = 0;
  for (const a of inWeek) {
    correct += a.correct;
    total += a.total;
    for (const [p, v] of Object.entries(a.perPart || {})) {
      const x = perPart[p] || (perPart[p] = { c: 0, t: 0 });
      x.c += v.c;
      x.t += v.t;
    }
    for (const [k, v] of Object.entries(a.perType || {})) {
      const x = perType[k] || (perType[k] = { c: 0, t: 0 });
      x.c += v.c;
      x.t += v.t;
    }
  }
  let reviews = 0;
  let good = 0;
  for (const [key, d] of Object.entries(log)) {
    const t = parseDay(key);
    if (t >= from && t < to) {
      reviews += d.reviews;
      good += d.good;
    }
  }
  let newWords = 0;
  for (const r of Object.values(progress.rows)) if (r.first_seen >= from && r.first_seen < to) newWords++;
  const mocks = scorePoints().filter((p) => p.ts >= from && p.ts < to);
  return {
    from, to,
    minutes: minutesIn(from, to),
    days: activeDays(from, to),
    attempts: inWeek.length,
    correct, total, perPart, perType,
    reviews, good, newWords,
    newMistakes: Object.values(mistakes).filter((m) => m.lastWrong >= from && m.lastWrong < to).length,
    mocks,
  };
}

// Dạng câu yếu nhất (ít nhất 3 câu đã làm trong 30 ngày gần đây).
export function weakTypes(limit = 3, since = nowSecs() - 30 * DAY) {
  const agg = {};
  for (const a of attempts) {
    if (a.finishedAt < since) continue;
    for (const [k, v] of Object.entries(a.perType || {})) {
      const x = agg[k] || (agg[k] = { c: 0, t: 0 });
      x.c += v.c;
      x.t += v.t;
    }
  }
  return Object.entries(agg)
    .filter(([k, v]) => k && v.t >= 3)
    .map(([type, v]) => ({ type, ...v, acc: v.c / v.t }))
    .sort((a, b) => a.acc - b.acc)
    .slice(0, limit);
}

export function partAccuracy(since = 0) {
  const out = {};
  for (const a of attempts) {
    if (a.finishedAt < since) continue;
    for (const [p, v] of Object.entries(a.perPart || {})) {
      const x = out[p] || (out[p] = { c: 0, t: 0 });
      x.c += v.c;
      x.t += v.t;
    }
  }
  return out;
}

// Các mốc điểm: đề full/mini trong app (ước tính) + điểm Study4 tự nhập.
export function scorePoints() {
  const pts = [];
  for (const a of attempts) {
    if (a.est?.total != null && (a.kind === "full" || a.kind === "mini")) pts.push({ ts: a.finishedAt, score: a.est.total, L: a.est.L, R: a.est.R, src: a.kind === "full" ? "Đề full" : "Mini test", estimate: a.kind !== "full" });
  }
  for (const e of study4) pts.push({ ts: e.ts, score: (e.L || 0) + (e.R || 0), L: e.L, R: e.R, src: "Study4", name: e.name });
  return pts.sort((a, b) => a.ts - b.ts);
}

export function latestScore() {
  const pts = scorePoints();
  return pts.length ? pts[pts.length - 1] : null;
}

export { shuffle };
