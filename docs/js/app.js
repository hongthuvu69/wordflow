import { content, progress, shuffle } from "./store.js";
import { sync } from "./sync.js";

const $view = document.getElementById("view");

// ---------------- Tiện ích ----------------

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const hl = (s) => esc(s).replace(/\*(.+?)\*/g, '<b class="hl">$1</b>');
const plain = (s) => String(s ?? "").replace(/\*/g, "");
const go = (hash) => (location.hash = hash);

const STATE_LABEL = (st) =>
  !st.exists ? ["Mới", "info"] : st.due ? ["Cần ôn", "warn"] : st.state === 3 ? ["Thành thạo", "good"] : ["Đang học", ""];

// ---------------- Phát âm ----------------

let voice = null;
function pickVoice() {
  const vs = speechSynthesis.getVoices();
  voice =
    vs.find((v) => v.lang === "en-US" && /Samantha|Google US|Aaron|Nicky/i.test(v.name)) ||
    vs.find((v) => v.lang === "en-US") ||
    vs.find((v) => v.lang && v.lang.startsWith("en")) ||
    null;
}
if ("speechSynthesis" in window) {
  pickVoice();
  speechSynthesis.onvoiceschanged = pickVoice;
}
function speak(text, slow = false) {
  if (!("speechSynthesis" in window) || !text) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(plain(text));
  u.lang = "en-US";
  if (voice) u.voice = voice;
  u.rate = slow ? 0.6 : 0.95;
  speechSynthesis.speak(u);
}
const spk = (text, slow = false) =>
  `<button class="spk" data-say="${esc(plain(text))}"${slow ? ' data-slow="1"' : ""} aria-label="${slow ? "Nghe chậm" : "Nghe"}">${slow ? "🐢" : "🔊"}</button>`;

// ---------------- Khối giao diện dùng lại ----------------

function header(title, sub = "", { back = false, right = "" } = {}) {
  return `<div class="head">
    ${back ? `<button class="icon-btn" data-act="back" aria-label="Quay lại">←</button>` : ""}
    <div class="grow"><h1>${title}</h1>${sub ? `<div class="sub">${sub}</div>` : ""}</div>
    ${right}
  </div>`;
}

const bar = (value, max) => `<div class="bar"><i style="width:${max ? Math.round((100 * value) / max) : 0}%"></i></div>`;

function syncLine() {
  if (!sync.signedIn) return "";
  const text = sync.busy ? "☁️ Đang đồng bộ…" : (sync.ok ? "☁️ " : "⚠️ ") + (sync.status || "Chưa đồng bộ");
  return `<div class="sync-line ${sync.ok ? "" : "err"}" data-sync-line>${esc(text)}</div>`;
}

function wordCard(w, { showHeader = true } = {}) {
  const parts = [];
  if (showHeader) {
    parts.push(`<div class="word-title"><h2>${esc(w.word)}</h2>
      <span class="chip purple">${esc(w.pos)}</span><span class="chip info">${esc(w.level)}</span></div>
      <div class="row"><span class="ipa">${esc(w.ipa)}</span>${spk(w.word)}${spk(w.word, true)}</div>`);
  }
  parts.push(`<div class="meaning"><b>${esc(w.meaning)}</b>${w.definition ? `<i>${esc(w.definition)}</i>` : ""}</div>`);
  if (w.collocations?.length) {
    parts.push(`<div class="sub-title">🔗 Cụm từ hay đi kèm</div><div class="chips">${w.collocations
      .map((c) => `<button class="chip" data-say="${esc(c)}">🔊 ${esc(c)}</button>`)
      .join("")}</div>`);
  }
  if (w.examples?.length) {
    parts.push(`<div class="sub-title">📝 Ví dụ trong ngữ cảnh</div>${w.examples
      .map(
        (e) => `<div class="example">${spk(e.en)}<div>
          <div class="en">${hl(e.en)}</div><div class="vi">${esc(e.vi)}</div>
          ${e.context ? `<span class="ctx">${esc(e.context)}</span>` : ""}</div></div>`
      )
      .join("")}`);
  }
  if (w.note) parts.push(`<div class="note"><div class="t">💡 Cách dùng</div>${hl(w.note)}</div>`);
  if (w.mistake) {
    parts.push(`<div class="mistake"><div class="t">⚠️ Lỗi hay gặp</div>
      <div>❌ <s>${esc(w.mistake.wrong)}</s></div>
      <div class="ok">✅ ${esc(w.mistake.right)}</div>
      <div>${esc(w.mistake.explain)}</div></div>`);
  }
  if (w.synonyms?.length) parts.push(`<div class="small"><b>≈ Đồng nghĩa:</b> ${esc(w.synonyms.join(", "))}</div>`);
  if (w.antonyms?.length) parts.push(`<div class="small"><b>↔ Trái nghĩa:</b> ${esc(w.antonyms.join(", "))}</div>`);
  return parts.join("");
}

// ---------------- Trang chủ ----------------

function phraseOfDay() {
  const all = content.topics.flatMap((t) => content.phrases.get(t.id) || []);
  return all.length ? all[Math.floor(Date.now() / 86400000) % all.length] : null;
}

function viewHome() {
  const s = progress.stats(content.allIds);
  const total = s.due + s.newRemaining;
  const tip = phraseOfDay();
  const date = new Date().toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit" });

  return `
    ${header("Chào bạn 👋", esc(date), { right: `<a class="icon-btn" href="#/settings" aria-label="Cài đặt">⚙️</a>` })}
    ${syncLine()}
    <div class="card hero">
      <div class="label">Bài học hôm nay</div>
      <div class="big">${total ? `${s.due} từ cần ôn + ${s.newRemaining} từ mới` : "Xong hết rồi! 🎉"}</div>
      <div class="hint">${total ? `Khoảng ${Math.max(1, Math.round(total * 0.4))} phút` : "Làm thêm Quiz hoặc luyện Mẫu câu nhé."}</div>
      <button class="btn" data-act="${total ? "start-today" : "goto-quiz"}">${total ? "Bắt đầu học →" : "Làm Quiz →"}</button>
    </div>
    <div class="stats">
      <div class="stat"><span class="i">⏰</span><div class="v">${s.due}</div><div class="l">Cần ôn hôm nay</div></div>
      <div class="stat"><span class="i">✨</span><div class="v">${s.newToday}/${progress.settings.dailyNewLimit}</div><div class="l">Từ mới hôm nay</div></div>
      <div class="stat"><span class="i">📖</span><div class="v">${s.seen}/${s.total}</div><div class="l">Từ đã học</div></div>
      <div class="stat"><span class="i">🔥</span><div class="v">${s.streak}</div><div class="l">Ngày liên tiếp · ${s.reviewedToday} lượt hôm nay</div></div>
    </div>
    <div class="section-title">Tiến độ theo chủ đề</div>
    <div class="card">
      ${content.topics
        .map((t) => {
          const ts = progress.topicStats(content.wordIds(t.id));
          return `<a class="list-row" href="#/topic/${t.id}">
            <span class="ico">${t.icon}</span>
            <div class="grow"><div class="t">${esc(t.title_vi)}</div>${bar(ts.seen, ts.total)}</div>
            <span class="muted small">${ts.seen}/${ts.total}</span>
            ${ts.due ? `<span class="chip warn">${ts.due}</span>` : ""}
          </a>`;
        })
        .join("")}
    </div>
    ${
      tip
        ? `<div class="card" style="background:var(--purple-soft);border:none">
        <div class="small" style="color:var(--purple);font-weight:700">💬 Mẫu câu của ngày · ${esc(tip.situation_vi)}</div>
        <div class="row"><b class="grow" style="font-size:18px">${esc(tip.neutral)}</b>${spk(tip.neutral)}</div>
        <div class="muted">${esc(tip.vi)}</div></div>`
        : ""
    }`;
}

// ---------------- Chủ đề ----------------

function viewTopics() {
  return `${header("Chủ đề", `${content.topics.length} chủ đề · ${content.allIds.length} từ`)}
    ${content.topics
      .map((t) => {
        const ts = progress.topicStats(content.wordIds(t.id));
        return `<a class="card" href="#/topic/${t.id}" style="display:block">
          <div class="row"><span style="font-size:30px">${t.icon}</span><div class="grow"></div><span class="chip info">${esc(t.level)}</span></div>
          <div style="font-size:18px;font-weight:700;margin-top:4px">${esc(t.title_vi)}</div>
          <div class="muted small" style="margin-bottom:10px">${esc(t.description || "")}</div>
          ${bar(ts.seen, ts.total)}
          <div class="row muted small" style="margin-top:6px"><span class="grow">${ts.seen}/${ts.total} từ · ${t.phraseCount} tình huống</span>${ts.due ? `<b style="color:var(--warn)">⏰ ${ts.due}</b>` : ""}</div>
        </a>`;
      })
      .join("")}`;
}

function viewTopic(id) {
  const t = content.topic(id);
  if (!t) return viewTopics();
  const ids = content.wordIds(id);
  const ts = progress.topicStats(ids);
  return `${header(`${t.icon} ${esc(t.title_vi)}`, `${ts.seen}/${ts.total} đã học · ${ts.mastered} thành thạo`, { back: true })}
    <div class="btns" style="margin-bottom:12px">
      <button class="btn primary" data-act="start-topic" data-id="${id}">🃏 Học chủ đề</button>
      <a class="btn" href="#/quiz/${id}">🎯 Quiz</a>
      <a class="btn" href="#/phrases/${id}">💬 Mẫu câu</a>
    </div>
    <input class="field search" type="search" placeholder="🔍 Tìm từ hoặc nghĩa…" data-filter>
    <div class="card" style="padding:4px 12px">
      ${ids
        .map((wid) => {
          const w = content.word(wid);
          const [label, cls] = STATE_LABEL(progress.wordState(wid));
          return `<a class="list-row" href="#/word/${wid}" data-search="${esc((w.word + " " + w.meaning).toLowerCase())}">
            <div class="grow"><div class="t">${esc(w.word)}</div><div class="muted small">${esc(w.meaning)}</div></div>
            <span class="chip ${cls}">${label}</span></a>`;
        })
        .join("")}
    </div>`;
}

function viewWord(id) {
  const w = content.word(id);
  if (!w) return viewTopics();
  const st = progress.wordState(id);
  const info = st.exists ? `${STATE_LABEL(st)[0]} · ôn tiếp: ${st.dueText} · đã ôn ${st.reps} lần` : "Bạn chưa học từ này";
  return `${header(esc(w.topicTitle), info, { back: true })}
    ${wordCard(w)}
    <button class="btn primary block" style="margin-top:16px" data-act="study-word" data-id="${id}">${st.exists ? "Ôn từ này ngay" : "Học từ này"}</button>`;
}

// ---------------- Flashcard ----------------

let session = null;

function startStudy(ids, title) {
  session = { ids, title, queue: ids.slice(), total: ids.length, done: 0, revealed: false, counts: [0, 0, 0, 0], spoken: null };
  go("#/study/s" + Date.now().toString(36));
}

function todayIds() {
  return progress.buildSession(content.allIds, progress.newRemainingToday());
}

function viewStudy() {
  if (!session) {
    const ids = todayIds();
    session = { ids, title: "Bài học hôm nay", queue: ids.slice(), total: ids.length, done: 0, revealed: false, counts: [0, 0, 0, 0], spoken: null };
  }
  const s = session;
  const head = header(esc(s.title), s.total ? `Đã xong ${s.done}/${s.total} · còn ${s.queue.length} thẻ` : "", { back: true });

  if (s.total === 0) {
    return `${head}<div class="done"><div class="emo">🎉</div><h2>Hôm nay không còn từ nào cần học!</h2>
      <p class="muted">Ôn đều quan trọng hơn học nhiều. Muốn học thêm thì bấm bên dưới.</p>
      <div class="btns" style="justify-content:center"><button class="btn primary" data-act="more-new">Học thêm 5 từ mới</button>
      <a class="btn" href="#/quiz">🎯 Làm Quiz</a></div></div>`;
  }
  if (s.queue.length === 0) {
    const [a, h, g, e] = s.counts;
    return `${head}<div class="done"><div class="emo">🏁</div><h2>Hoàn thành ${s.total} thẻ!</h2>
      <div class="chips" style="justify-content:center;margin:12px 0">
        <span class="chip bad">Quên: ${a}</span><span class="chip warn">Khó: ${h}</span><span class="chip">Nhớ: ${g}</span><span class="chip good">Dễ: ${e}</span></div>
      <p class="muted">Mẹo: làm Quiz ngay sau khi học giúp nhớ lâu hơn nhiều.</p>
      <div class="btns" style="justify-content:center"><a class="btn primary" href="#/quiz">🎯 Làm Quiz</a><a class="btn" href="#/">Về trang chủ</a></div></div>`;
  }

  const id = s.queue[0];
  const w = content.word(id);
  const progressBar = `<div class="progress">${bar(s.done, s.total)}</div>`;

  if (!s.revealed) {
    if (s.spoken !== id + s.done && progress.settings.autoSpeak) {
      s.spoken = id + s.done;
      setTimeout(() => speak(w.word), 150);
    }
    return `<div class="study">${head}${progressBar}
      <div class="flash-front">
        <span class="chip plain">${esc(w.topicTitle)}</span>
        <div class="w">${esc(w.word)}</div>
        <div class="ipa">${esc(w.ipa)} · ${esc(w.pos)}</div>
        <div class="row">${spk(w.word)}${spk(w.word, true)}</div>
        <p class="muted">Bạn có nhớ nghĩa không? Thử nói một câu với từ này.</p>
      </div>
      <div class="reveal"><button class="btn primary block" data-act="reveal">Hiện đáp án</button></div></div>`;
  }

  const pv = progress.intervalPreview(id);
  const labels = ["Quên", "Khó", "Nhớ", "Dễ"];
  return `<div class="study">${head}${progressBar}
    <div class="flash-back">${wordCard(w)}</div>
    <div class="rate">${labels
      .map((l, i) => `<button class="r${i + 1}" data-act="rate" data-r="${i + 1}">${l}<small>${pv[i]}</small></button>`)
      .join("")}</div></div>`;
}

function rate(r) {
  const s = session;
  if (!s || !s.revealed || !s.queue.length) return;
  const id = s.queue[0];
  progress.review(id, r);
  s.counts[r - 1]++;
  const q = s.queue.slice(1);
  if (r === 1) q.splice(Math.min(q.length, 3), 0, id);
  else s.done++;
  s.queue = q;
  s.revealed = false;
  render();
  window.scrollTo(0, 0);
}

// ---------------- Quiz ----------------

let quiz = null;
const TYPE_LABEL = {
  meaning: "Chọn nghĩa đúng",
  reverse: "Chọn từ tiếng Anh đúng",
  cloze: "Điền từ vào chỗ trống (từ có thể đã chia dạng)",
  listen: "Nghe và chọn từ",
  mistake: "Câu nào đúng?",
};

function makeQuestion(w, topicId) {
  const types = ["meaning", "reverse", "listen"];
  const clozeable = (w.examples || []).filter((e) => (e.en.match(/\*/g) || []).length === 2);
  if (clozeable.length) types.push("cloze", "cloze");
  if (w.mistake) types.push("mistake");
  const type = types[Math.floor(Math.random() * types.length)];
  const others = content.randomWords(3, w.id, topicId);

  if (type === "mistake") {
    const options = shuffle([w.mistake.right, w.mistake.wrong]);
    return { type, wordId: w.id, prompt: "Chọn câu đúng:", sub: "Từ: " + w.word, options,
             correct: options.indexOf(w.mistake.right), explain: w.mistake.explain, speak: w.mistake.right };
  }
  let prompt, sub = "", correctText = w.word, options, explain, say = w.word;
  if (type === "meaning") {
    prompt = w.word; sub = w.ipa; correctText = w.meaning;
    options = [w.meaning, ...others.map((o) => o.meaning)];
    explain = `${w.word} = ${w.meaning}`;
  } else if (type === "reverse") {
    prompt = w.meaning; sub = w.definition || "";
    options = [w.word, ...others.map((o) => o.word)];
    explain = `${w.meaning} = ${w.word} ${w.ipa}`;
  } else if (type === "listen") {
    prompt = "Bạn nghe thấy từ nào?"; sub = "Bấm 🔊 để nghe lại";
    options = [w.word, ...others.map((o) => o.word)];
    explain = `${w.word} ${w.ipa} – ${w.meaning}`;
  } else {
    const ex = clozeable[Math.floor(Math.random() * clozeable.length)];
    prompt = ex.en.replace(/\*(.+?)\*/, "_____"); sub = ex.vi || "";
    options = [w.word, ...others.map((o) => o.word)];
    explain = plain(ex.en); say = plain(ex.en);
  }
  options = shuffle(options);
  return { type, wordId: w.id, prompt, sub, options, correct: options.indexOf(correctText), explain, speak: say };
}

function startQuiz(topicId) {
  let pool;
  if (topicId) pool = content.wordIds(topicId);
  else {
    pool = progress.seenIds(content.allIds);
    if (pool.length < 6) pool = content.allIds;
  }
  quiz = {
    topicId,
    questions: shuffle(pool).slice(0, 10).map((id) => makeQuestion(content.word(id), topicId)),
    index: 0, score: 0, chosen: -1, wrong: [],
  };
  playListen();
}

function playListen() {
  const q = quiz && quiz.questions[quiz.index];
  if (q && q.type === "listen") setTimeout(() => speak(q.speak), 200);
}

function viewQuiz(topicId) {
  const t = topicId ? content.topic(topicId) : null;
  if (topicId && (!quiz || quiz.topicId !== topicId)) startQuiz(topicId);
  const title = "🎯 Quiz" + (t ? " · " + esc(t.title_vi) : "");

  if (!quiz || (!topicId && quiz.topicId)) {
    quiz = null;
    return `${header(title, "Kiểm tra nhanh 10 câu: nghĩa, điền từ, nghe, chọn câu đúng.")}
      <div class="card stack">
        <b>Chọn phạm vi</b>
        <select class="field" id="quiz-scope">
          <option value="">Tất cả từ đã học</option>
          ${content.topics.map((x) => `<option value="${x.id}">${x.icon} ${esc(x.title_vi)}</option>`).join("")}
        </select>
        <div class="muted small">Nếu bạn học chưa đủ 6 từ, quiz sẽ lấy từ toàn bộ kho từ.</div>
        <button class="btn primary block" data-act="quiz-start">Bắt đầu →</button>
      </div>`;
  }

  const n = quiz.questions.length;
  if (quiz.index >= n) {
    const emo = quiz.score >= n * 0.8 ? "🏆" : quiz.score >= n * 0.5 ? "👍" : "💪";
    return `${header(title, "", { back: !!topicId })}<div class="done"><div class="emo">${emo}</div><h2>Đúng ${quiz.score}/${n} câu</h2>
      ${quiz.wrong.length ? `<p class="muted">Cần xem lại: ${esc(quiz.wrong.map((id) => content.word(id).word).join(", "))}</p>` : ""}
      <div class="btns" style="justify-content:center">
        ${quiz.wrong.length ? `<button class="btn primary" data-act="quiz-review">🃏 Ôn lại từ sai</button>` : ""}
        <button class="btn" data-act="quiz-again">🔁 Quiz mới</button></div></div>`;
  }

  const q = quiz.questions[quiz.index];
  const answered = quiz.chosen >= 0;
  return `${header(title, `Câu ${quiz.index + 1}/${n} · Đúng ${quiz.score}`, { back: !!topicId })}
    <div class="progress" style="margin-bottom:12px">${bar(quiz.index, n)}</div>
    <span class="chip purple">${TYPE_LABEL[q.type]}</span>
    <div class="row"><div class="q-prompt grow ${q.type === "meaning" ? "huge" : ""}">${esc(q.prompt)}</div>
      ${q.type === "listen" || q.type === "meaning" ? spk(q.speak) : ""}</div>
    ${q.sub ? `<div class="muted">${esc(q.sub)}</div>` : ""}
    ${q.options
      .map((o, i) => {
        const cls = answered ? (i === q.correct ? "correct" : i === quiz.chosen ? "wrong" : "") : "";
        const mark = answered && (i === q.correct || i === quiz.chosen) ? (i === q.correct ? "✅" : "❌") : "";
        return `<button class="opt ${cls}" data-act="quiz-choose" data-i="${i}"><span class="n">${i + 1}</span><span class="grow">${esc(o)}</span>${mark}</button>`;
      })
      .join("")}
    ${
      answered
        ? `<div class="explain ${quiz.chosen === q.correct ? "good" : "warn"}"><span>${quiz.chosen === q.correct ? "🎉" : "💡"}</span>
           <span class="grow">${esc(q.explain)}</span>${spk(q.speak)}</div>
           <button class="btn primary block" style="margin-top:12px" data-act="quiz-next">${quiz.index + 1 < n ? "Câu tiếp →" : "Xem kết quả"}</button>`
        : ""
    }`;
}

// ---------------- Mẫu câu ----------------

function viewPhrases(topicId) {
  const tid = topicId || content.topics[0]?.id;
  const regs = [["formal", "Trang trọng", "info"], ["neutral", "Bình thường", ""], ["casual", "Thân mật", "warn"]];
  return `${header("💬 Mẫu câu giao tiếp", "Nghe → nhắc lại to → tự thay từ để nói câu của bạn.", { back: !!topicId })}
    <div class="chips scroll">${content.topics
      .map((t) => `<a class="chip ${t.id === tid ? "on" : "plain"}" href="#/phrases/${t.id}">${t.icon} ${esc(t.title_vi)}</a>`)
      .join("")}</div>
    ${(content.phrases.get(tid) || [])
      .map(
        (p, i) => `<div class="card">
        <div style="font-weight:700;font-size:17px">${i + 1}. ${esc(p.situation_vi)}</div>
        <div class="muted small" style="margin-bottom:6px"><i>${esc(p.situation)}</i></div>
        ${regs
          .filter(([k]) => p[k])
          .map(([k, label, cls]) => `<div class="reg"><span class="chip ${cls}">${label}</span><span class="s">${esc(p[k])}</span>${spk(p[k])}</div>`)
          .join("")}
        <div class="muted small" style="margin-top:6px">Nghĩa: ${esc(p.vi)}</div>
        ${p.reply ? `<div class="reply"><span class="grow">↩️ <b>Người kia có thể đáp:</b> ${esc(p.reply)}</span>${spk(p.reply)}</div>` : ""}
        ${p.note ? `<div class="tip">💡 ${esc(p.note)}</div>` : ""}
      </div>`
      )
      .join("")}`;
}

// ---------------- Cài đặt ----------------

let editServer = false;

function viewSettings() {
  const st = progress.settings;
  let account;
  if (!sync.configured || editServer) {
    account = `<input class="field" id="sv-url" placeholder="Project URL: https://xxxx.supabase.co" value="${esc(sync.url)}" autocapitalize="off">
      <input class="field" id="sv-key" placeholder="Publishable key (hoặc anon key)" autocapitalize="off">
      <div class="btns"><button class="btn primary" data-act="sv-save">Lưu máy chủ</button>
      ${sync.configured ? `<button class="btn" data-act="sv-cancel">Hủy</button>` : ""}</div>`;
  } else if (!sync.signedIn) {
    account = `<div class="muted small" style="margin-bottom:8px">Máy chủ: ${esc(sync.url)}</div>
      <form data-form="login">
      <input class="field" id="lg-email" type="email" placeholder="Email" autocomplete="username" autocapitalize="off">
      <input class="field" id="lg-pass" type="password" placeholder="Mật khẩu (ít nhất 6 ký tự)" autocomplete="current-password">
      <div class="btns"><button class="btn primary" type="submit" ${sync.busy ? "disabled" : ""}>Đăng nhập</button>
      <button class="btn" type="button" data-act="signup" ${sync.busy ? "disabled" : ""}>Tạo tài khoản</button>
      <button class="btn" type="button" data-act="sv-edit">Đổi máy chủ</button></div></form>`;
  } else {
    account = `<div>Đã đăng nhập: <b>${esc(sync.email)}</b></div>
      <div class="muted small" style="margin:4px 0 10px">Tự động đồng bộ khi mở app và 15 giây sau khi bạn học.</div>
      <div class="btns"><button class="btn primary" data-act="sync-now" ${sync.busy ? "disabled" : ""}>🔄 Đồng bộ ngay</button>
      <button class="btn" data-act="signout">Đăng xuất</button></div>`;
  }

  return `${header("⚙️ Cài đặt", "", { back: true })}
    <div class="card stack">
      <b>Học tập</b>
      <div class="row"><div class="grow">Số từ mới mỗi ngày<div class="muted small">Gợi ý 10–15 từ</div></div>
        <div class="stepper"><button data-act="limit" data-d="-1">−</button><b>${st.dailyNewLimit}</b><button data-act="limit" data-d="1">+</button></div></div>
      <div class="row"><div class="grow">Tự động đọc từ khi hiện thẻ</div>
        <label class="switch"><input type="checkbox" data-toggle="autoSpeak" ${st.autoSpeak ? "checked" : ""}><span></span></label></div>
      <div class="btns"><button class="btn" data-say="Hello! Let's learn some new English words today.">🔊 Nghe thử</button>
        <button class="btn" data-say="Hello! Let's learn some new English words today." data-slow="1">🐢 Nghe chậm</button></div>
    </div>
    <div class="card">
      <b>☁️ Đồng bộ với PC</b>
      <div class="muted small" style="margin:4px 0 10px">Dùng cùng tài khoản Supabase với app WordFlow trên máy tính.</div>
      ${account}
      <div class="status ${sync.ok ? "ok" : "err"}" data-sync-status>${sync.status ? (sync.ok ? "✓ " : "⚠ ") + esc(sync.status) : ""}</div>
    </div>
    <div class="card stack">
      <b>📲 Cài lên màn hình chính</b>
      <div class="muted small">Trên iPhone: mở bằng Safari → nút Chia sẻ (ô vuông có mũi tên) → "Thêm vào MH chính". App sẽ mở toàn màn hình và dùng được khi không có mạng.</div>
    </div>
    <div class="card stack">
      <b>Dữ liệu</b>
      <button class="btn danger" data-act="reset">🗑️ Xóa toàn bộ tiến độ học</button>
    </div>`;
}

// ---------------- Điều hướng ----------------

const routes = [
  [/^#?\/?$/, "home", () => viewHome()],
  [/^#\/topics$/, "topics", () => viewTopics()],
  [/^#\/topic\/([\w-]+)$/, "topics", (m) => viewTopic(m[1])],
  [/^#\/word\/([\w-]+)$/, "topics", (m) => viewWord(m[1])],
  [/^#\/study(?:\/(\w+))?$/, "study", () => viewStudy()],
  [/^#\/quiz(?:\/([\w-]+))?$/, "quiz", (m) => viewQuiz(m[1])],
  [/^#\/phrases(?:\/([\w-]+))?$/, "phrases", (m) => viewPhrases(m[1])],
  [/^#\/settings$/, "settings", () => viewSettings()],
];
let currentTab = "home";
let lastHash = null;

function render() {
  const hash = location.hash || "#/";
  for (const [re, tab, fn] of routes) {
    const m = hash.match(re);
    if (!m) continue;
    currentTab = tab;
    $view.innerHTML = fn(m);
    document.body.classList.toggle("focus", tab === "study" && /^#\/study/.test(hash));
    for (const a of document.querySelectorAll(".tabbar a")) a.classList.toggle("active", a.dataset.tab === tab);
    if (hash !== lastHash) window.scrollTo(0, 0);
    lastHash = hash;
    return;
  }
  go("#/");
}

window.addEventListener("hashchange", () => {
  // Bấm tab "Ôn tập" luôn tạo buổi học mới cho hôm nay.
  if (location.hash === "#/study") session = null;
  if (location.hash === "#/quiz") quiz = null;
  render();
});

// ---------------- Sự kiện ----------------

document.addEventListener("click", (ev) => {
  const sayEl = ev.target.closest("[data-say]");
  if (sayEl) {
    ev.preventDefault();
    speak(sayEl.dataset.say, !!sayEl.dataset.slow);
    return;
  }
  const el = ev.target.closest("[data-act]");
  if (!el) return;
  const act = el.dataset.act;
  switch (act) {
    case "back":
      history.length > 1 ? history.back() : go("#/");
      break;
    case "start-today":
      startStudy(todayIds(), "Bài học hôm nay");
      break;
    case "goto-quiz":
      go("#/quiz");
      break;
    case "start-topic": {
      const t = content.topic(el.dataset.id);
      startStudy(progress.buildSession(content.wordIds(t.id), 10), t.title_vi);
      break;
    }
    case "study-word":
      startStudy([el.dataset.id], content.word(el.dataset.id).word);
      break;
    case "reveal":
      session.revealed = true;
      render();
      break;
    case "rate":
      rate(Number(el.dataset.r));
      break;
    case "more-new": {
      const ids = progress.buildSession(content.allIds, 5);
      if (ids.length) startStudy(ids, "Học thêm");
      break;
    }
    case "quiz-start":
      startQuiz(document.getElementById("quiz-scope").value);
      if (quiz.topicId) go("#/quiz/" + quiz.topicId);
      else render();
      break;
    case "quiz-choose": {
      if (!quiz || quiz.chosen >= 0) break;
      const q = quiz.questions[quiz.index];
      quiz.chosen = Number(el.dataset.i);
      if (quiz.chosen === q.correct) quiz.score++;
      else if (!quiz.wrong.includes(q.wordId)) quiz.wrong.push(q.wordId);
      if (q.type !== "listen") speak(q.speak);
      render();
      break;
    }
    case "quiz-next":
      quiz.index++;
      quiz.chosen = -1;
      render();
      window.scrollTo(0, 0);
      playListen();
      break;
    case "quiz-review":
      startStudy(quiz.wrong.slice(), "Ôn lại từ sai");
      break;
    case "quiz-again":
      startQuiz(quiz.topicId);
      render();
      break;
    case "limit":
      progress.setSetting("dailyNewLimit", Math.min(50, Math.max(1, progress.settings.dailyNewLimit + Number(el.dataset.d))));
      break;
    case "sv-save":
      if (sync.configure(document.getElementById("sv-url").value, document.getElementById("sv-key").value)) {
        editServer = false;
        render();
      }
      break;
    case "sv-cancel":
      editServer = false;
      render();
      break;
    case "sv-edit":
      editServer = true;
      render();
      break;
    case "signup":
      sync.signUp(document.getElementById("lg-email").value, document.getElementById("lg-pass").value);
      break;
    case "sync-now":
      sync.syncNow();
      break;
    case "signout":
      sync.signOut();
      render();
      break;
    case "reset":
      if (confirm(sync.signedIn ? "Xóa toàn bộ tiến độ trên máy này VÀ trên máy chủ đồng bộ? Không thể hoàn tác." : "Xóa toàn bộ tiến độ học? Không thể hoàn tác.")) {
        progress.resetLocal();
        if (sync.signedIn) sync.deleteRemoteData();
      }
      break;
  }
});

document.addEventListener("submit", (ev) => {
  if (ev.target.dataset.form === "login") {
    ev.preventDefault();
    sync.signIn(document.getElementById("lg-email").value, document.getElementById("lg-pass").value);
  }
});

document.addEventListener("change", (ev) => {
  const key = ev.target.dataset.toggle;
  if (key) progress.setSetting(key, ev.target.checked);
});

document.addEventListener("input", (ev) => {
  if (!("filter" in ev.target.dataset)) return;
  const q = ev.target.value.trim().toLowerCase();
  for (const row of document.querySelectorAll("[data-search]")) row.hidden = !!q && !row.dataset.search.includes(q);
});

// Phím tắt khi dùng trên máy tính.
document.addEventListener("keydown", (ev) => {
  if (ev.target.matches("input, select, textarea")) return;
  if (currentTab === "study" && session) {
    if ((ev.key === " " || ev.key === "Enter") && !session.revealed && session.queue.length) {
      ev.preventDefault();
      session.revealed = true;
      render();
    } else if (session.revealed && "1234".includes(ev.key)) rate(Number(ev.key));
  } else if (currentTab === "quiz" && quiz && quiz.index < quiz.questions.length) {
    const opt = document.querySelector(`.opt[data-i="${Number(ev.key) - 1}"]`);
    if (opt && quiz.chosen < 0) opt.click();
    else if (ev.key === "Enter" && quiz.chosen >= 0) document.querySelector('[data-act="quiz-next"]')?.click();
  }
});

// Cập nhật giao diện khi dữ liệu thay đổi từ nơi khác (đồng bộ, cài đặt).
progress.onChange((kind) => {
  if (kind !== "review" && currentTab !== "study" && currentTab !== "quiz") render();
});

let wasSignedIn = sync.signedIn;
sync.onChange(() => {
  if (sync.signedIn !== wasSignedIn || currentTab === "settings") {
    wasSignedIn = sync.signedIn;
    // Giữ nội dung đang gõ trong form: chỉ vẽ lại khi trạng thái đăng nhập đổi hoặc nút cần bật/tắt.
    if (currentTab === "settings" && document.activeElement?.matches("input")) {
      const el = document.querySelector("[data-sync-status]");
      if (el) {
        el.className = "status " + (sync.ok ? "ok" : "err");
        el.textContent = sync.status ? (sync.ok ? "✓ " : "⚠ ") + sync.status : "";
      }
    } else if (currentTab !== "study" && currentTab !== "quiz") render();
    return;
  }
  const line = document.querySelector("[data-sync-line]");
  if (line) {
    line.className = "sync-line " + (sync.ok ? "" : "err");
    line.textContent = sync.busy ? "☁️ Đang đồng bộ…" : (sync.ok ? "☁️ " : "⚠️ ") + sync.status;
  }
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") sync.syncNow();
  else if (sync.timer) sync.syncNow(); // đang chờ đồng bộ mà người dùng rời app: đẩy ngay
});

// ---------------- Khởi động ----------------

(async () => {
  try {
    await content.load();
  } catch (e) {
    $view.innerHTML = `<div class="done"><div class="emo">😕</div><h2>Không tải được nội dung</h2><p class="muted">${esc(e.message || e)}</p></div>`;
    return;
  }
  render();
  sync.syncNow();
  if ("serviceWorker" in navigator && location.protocol === "https:") {
    navigator.serviceWorker.register("sw.js").catch((e) => console.warn("SW", e));
  }
})();
