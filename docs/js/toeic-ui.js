// Giao diện luyện thi TOEIC: Hôm nay, Luyện đề, màn hình làm bài (kiểu Study4), kết quả,
// sổ lỗi sai, Tiến độ, báo cáo tuần, nhập điểm Study4.
import { content, progress, startOfDay } from "./store.js";
import { esc, header, bar, pct, go, toast, speakLines, fmtDuration, fmtMinutes } from "./ui.js";
import * as T from "./toeic.js";

const { PARTS, PART_SIZE, TYPES, REASONS, PHASES } = T;
const LETTERS = ["A", "B", "C", "D"];
const STUDY4_URL = "https://study4.com/tests/?term=toeic";
const KIND_LABEL = { full: "Đề full", mini: "Mini test", pack: "Bộ luyện theo Part" };

let rerender = () => {};
let currentHash = "";

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
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn("localStorage write failed", key, e);
    }
  },
};

const accClass = (c, t) => (!t ? "" : c / t >= 0.8 ? "good" : c / t >= 0.6 ? "warn" : "bad");
const dayLabel = (secs) => new Date(secs * 1000).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
const nowSecs = () => Math.floor(Date.now() / 1000);
const localDay = (key) => Math.floor(new Date(key + "T00:00:00").getTime() / 1000);

function delta(now, before, unit = "") {
  if (before == null || now == null) return "";
  const d = Math.round(now - before);
  if (!d) return `<span class="delta">= tuần trước</span>`;
  return `<span class="delta ${d > 0 ? "up" : "down"}">${d > 0 ? "▲" : "▼"} ${Math.abs(d)}${unit}</span>`;
}

// ================= HÔM NAY =================

function viewToday() {
  const week = T.currentWeek();
  const phase = T.phaseOf(week);
  const latest = T.latestScore();
  const expected = T.expectedScore(week);
  const tasks = T.todayTasks();
  const doneMin = tasks.filter((t) => t.done).reduce((s, t) => s + t.min, 0);
  const totalMin = tasks.reduce((s, t) => s + t.min, 0);
  const ws = T.weekStats(0);
  const weekTarget = T.plan.weeklyHours * 60;
  const weak = T.weakTypes(3);
  const s = progress.stats(content.allIds);
  const date = new Date().toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit" });
  let examLine = "";
  if (T.plan.examDate) {
    const days = Math.round((localDay(T.plan.examDate) - startOfDay(0)) / 86400);
    examLine = days >= 0 ? ` · còn <b>${days}</b> ngày tới ngày thi` : "";
  }

  return `
    ${header("Hôm nay", esc(date), { right: `<a class="icon-btn" href="#/settings" aria-label="Cài đặt">⚙️</a>` })}
    <div class="card hero goal">
      <div class="label">Tuần ${Math.min(week, 48)}/48 · Giai đoạn ${phase.n}: ${phase.name}${examLine}</div>
      <div class="goal-row">
        <div><div class="big">${latest ? latest.score : "—"}</div><div class="hint">Điểm gần nhất${latest ? ` (${latest.src})` : ""}</div></div>
        <div class="arrow">→</div>
        <div><div class="big">${expected}</div><div class="hint">Mốc tuần này</div></div>
        <div class="arrow">→</div>
        <div><div class="big">${T.plan.target}</div><div class="hint">Mục tiêu</div></div>
      </div>
      <div class="bar light"><i style="width:${latest ? Math.min(100, Math.round((100 * latest.score) / T.plan.target)) : 0}%"></i></div>
      <div class="hint" style="margin:8px 0 0">Trọng tâm: ${esc(phase.focus)}</div>
    </div>

    <div class="section-title row"><span class="grow">📋 Việc hôm nay</span><span class="muted small">${fmtMinutes(doneMin)} / ${fmtMinutes(totalMin)}</span></div>
    <div class="card tasks">
      ${tasks.map(taskRow).join("")}
    </div>

    <div class="section-title">📈 Tuần này</div>
    <div class="stats">
      <div class="stat"><span class="i">⏱️</span><div class="v">${fmtMinutes(ws.minutes)}</div><div class="l">/ ${fmtMinutes(weekTarget)} mục tiêu</div>${bar(ws.minutes, weekTarget)}</div>
      <div class="stat"><span class="i">📅</span><div class="v">${ws.days}/7</div><div class="l">Ngày có học</div>${bar(ws.days, 7)}</div>
      <div class="stat"><span class="i">🎯</span><div class="v">${ws.total ? pct(ws.correct, ws.total) + "%" : "—"}</div><div class="l">Độ chính xác · ${ws.total} câu</div></div>
      <div class="stat"><span class="i">📖</span><div class="v">${ws.newWords}</div><div class="l">Từ mới · ${s.due} từ cần ôn</div></div>
    </div>

    ${
      weak.length
        ? `<div class="section-title">🩺 Điểm yếu cần luyện</div>
      <div class="card">${weak
        .map(
          (w) => `<button class="list-row plain-btn" data-act="drill-type" data-type="${w.type}">
          <span class="chip ${accClass(w.c, w.t)}">${pct(w.c, w.t)}%</span>
          <div class="grow"><div class="t">${esc(T.typeLabel(w.type))}</div><div class="muted small">Part ${TYPES[w.type]?.[0] ?? "?"} · ${w.c}/${w.t} câu đúng</div></div>
          <span class="muted">Luyện →</span></button>`
        )
        .join("")}</div>`
        : ""
    }
    <a class="card row link-card" href="#/report"><span style="font-size:26px">📊</span><div class="grow"><b>Báo cáo tuần</b><div class="muted small">Giờ học, độ chính xác từng Part, điểm yếu và gợi ý tuần sau</div></div><span class="muted">→</span></a>`;
}

function taskRow(t) {
  const action = t.href ? `href="${t.href}"` : `data-act="${t.act}"${t.parts ? ` data-parts="${t.parts.join(",")}"` : ""}`;
  const tag = t.href ? "a" : "button";
  return `<div class="task ${t.done ? "done" : ""}">
    ${
      t.manual
        ? `<button class="check" data-act="tick" data-id="${t.id}" aria-label="Đánh dấu xong">${t.done ? "✓" : ""}</button>`
        : `<span class="check auto" title="Tự đánh dấu khi bạn làm xong">${t.done ? "✓" : ""}</span>`
    }
    <${tag} class="grow task-body plain-btn" ${action}>
      <div class="task-when">${esc(t.when)} · ${t.min} phút</div>
      <div class="t">${t.icon} ${esc(t.title)}</div>
      <div class="muted small">${esc(t.sub)}</div>
    </${tag}>
  </div>`;
}

// ================= LUYỆN ĐỀ =================

function viewTests() {
  const counts = T.bank.countBy("part");
  const typeCounts = T.bank.countBy("type");
  const acc = T.partAccuracy();
  const typeAcc = {};
  for (const a of T.attempts)
    for (const [k, v] of Object.entries(a.perType || {})) {
      const x = typeAcc[k] || (typeAcc[k] = { c: 0, t: 0 });
      x.c += v.c;
      x.t += v.t;
    }
  const open = T.openMistakes();
  const recent = T.attempts.slice(-8).reverse();

  return `${header("Luyện đề", `${T.bank.questions.size} câu trong kho · ${T.attempts.length} lượt đã làm`)}
    ${runner ? resumeCard() : ""}

    <div class="section-title">📝 Đề thi thử</div>
    ${T.bank.tests
      .map((t) => {
        const done = T.attempts.filter((a) => a.testId === t.id);
        const best = done.length ? Math.max(...done.map((a) => a.est?.total || 0)) : 0;
        return `<a class="card test-card" href="#/test/${t.id}">
          <div class="row"><span class="chip ${t.kind === "full" ? "purple" : t.kind === "pack" ? "warn" : "info"}">${KIND_LABEL[t.kind] || "Mini test"}</span><span class="grow"></span>
          ${done.length ? `<span class="chip good">Đã làm ${done.length} lần${best ? ` · cao nhất ≈${best}` : ""}</span>` : ""}</div>
          <div class="test-title">${esc(t.title)}</div>
          <div class="muted small">${t.count} câu · ${t.duration} phút · Part ${t.parts.join(", ")}</div></a>`;
      })
      .join("")}
    <div class="card test-card soon">
      <div class="row"><span class="chip purple">Đề full</span><span class="grow"></span><span class="chip plain">Đang soạn</span></div>
      <div class="test-title">Full Test 200 câu / 120 phút</div>
      <div class="muted small">Đủ 7 Part như đề thật. Bộ đề sẽ được nạp vào kho dần dần.</div>
    </div>
    <div class="card row study4">
      <span style="font-size:26px">🌐</span>
      <div class="grow"><b>Đề thật trên Study4</b><div class="muted small">Làm đề ở Study4, xong nhập điểm vào đây để theo dõi tiến độ.</div></div>
    </div>
    <div class="btns" style="margin:-4px 0 12px">
      <a class="btn" href="${STUDY4_URL}" target="_blank" rel="noopener">Mở Study4 ↗</a>
      <a class="btn primary" href="#/study4/add">＋ Nhập điểm Study4</a>
    </div>

    <div class="section-title">🧩 Luyện theo Part</div>
    <div class="part-grid">
      ${[1, 2, 3, 4, 5, 6, 7]
        .map((p) => {
          const n = counts[p] || 0;
          const a = acc[p];
          return `<button class="part-card ${n ? "" : "off"}" ${n ? `data-act="drill-part" data-parts="${p}"` : "disabled"}>
            <div class="row"><span class="pi">${PARTS[p].icon}</span><span class="grow"></span>${a ? `<span class="chip ${accClass(a.c, a.t)}">${pct(a.c, a.t)}%</span>` : ""}</div>
            <div class="pn">Part ${p}</div>
            <div class="pt">${PARTS[p].name}</div>
            <div class="muted small">${n ? `${n} câu trong kho` : "Sắp có"}</div>
          </button>`;
        })
        .join("")}
    </div>

    <div class="section-title">🔬 Luyện theo dạng câu</div>
    <div class="card" style="padding:4px 12px">
      ${Object.keys(TYPES)
        .filter((k) => typeCounts[k])
        .map((k) => {
          const a = typeAcc[k];
          return `<button class="list-row plain-btn" data-act="drill-type" data-type="${k}">
            <span class="chip plain" style="min-width:52px;justify-content:center">P${TYPES[k][0] === 3 ? "3·4" : TYPES[k][0]}</span>
            <div class="grow"><div class="t">${esc(TYPES[k][1])}</div><div class="muted small">${typeCounts[k]} câu${a ? ` · đúng ${a.c}/${a.t}` : ""}</div></div>
            ${a ? `<span class="chip ${accClass(a.c, a.t)}">${pct(a.c, a.t)}%</span>` : `<span class="muted small">Chưa làm</span>`}
          </button>`;
        })
        .join("")}
    </div>

    <a class="card row link-card" href="#/mistakes">
      <span style="font-size:26px">📕</span>
      <div class="grow"><b>Sổ lỗi sai</b><div class="muted small">${open.length ? `${open.length} câu cần làm lại` : "Chưa có câu sai nào"}</div></div>
      ${open.length ? `<span class="chip bad">${open.length}</span>` : ""}<span class="muted">→</span>
    </a>

    ${
      recent.length
        ? `<div class="section-title">🕘 Lịch sử làm bài</div><div class="card" style="padding:4px 12px">${recent
            .map(
              (a) => `<a class="list-row" href="#/result/${a.id}">
            <div class="grow"><div class="t">${esc(a.title)}</div><div class="muted small">${dayLabel(a.finishedAt)} · ${fmtDuration(a.elapsed)} · ${a.correct}/${a.total} câu</div></div>
            ${a.est?.total ? `<span class="chip purple">≈${a.est.total}</span>` : ""}
            <span class="chip ${accClass(a.correct, a.total)}">${pct(a.correct, a.total)}%</span></a>`
            )
            .join("")}</div>`
        : ""
    }`;
}

function resumeCard() {
  const total = runFlat().length;
  const done = Object.keys(runner.answers).length;
  return `<div class="card resume">
    <div class="row"><span style="font-size:24px">⏸️</span><div class="grow"><b>Đang làm dở: ${esc(runner.test.title)}</b>
    <div class="muted small">${done}/${total} câu · ${runner.mode === "exam" ? "Thi thật" : "Luyện tập"} · ${fmtDuration(elapsed())}</div></div></div>
    <div class="btns" style="margin-top:10px"><button class="btn primary" data-act="rt-resume">Làm tiếp →</button><button class="btn" data-act="rt-discard">Bỏ bài này</button></div>
  </div>`;
}

// ---------- Màn hình chuẩn bị làm đề ----------

let introParts = null;

function viewTestIntro(id) {
  const t = T.bank.test(id);
  if (!t) return viewTests();
  const meta = T.bank.tests.find((x) => x.id === id);
  if (!introParts || introParts.id !== id) introParts = { id, sel: new Set(t.parts.map((p) => p.part)), mode: "exam" };
  const past = T.attempts.filter((a) => a.testId === id).reverse();
  const counts = Object.fromEntries(t.parts.map((p) => [p.part, p.groups.reduce((s, g) => s + g.questions.length, 0)]));
  const selCount = [...introParts.sel].reduce((s, p) => s + (counts[p] || 0), 0);
  const allSel = introParts.sel.size === t.parts.length;
  const minutes = allSel ? t.duration : Math.max(1, Math.round((t.duration * selCount) / meta.count));

  return `${header(esc(t.title), esc(t.source), { back: true })}
    <div class="card">
      <div class="kpis">
        <div><b>${meta.count}</b><span>câu hỏi</span></div>
        <div><b>${t.duration}</b><span>phút</span></div>
        <div><b>${t.parts.length}</b><span>Part</span></div>
        <div><b>${past.length}</b><span>lượt đã làm</span></div>
      </div>
    </div>
    <div class="section-title">Chế độ làm bài</div>
    <div class="mode-pick">
      <button class="mode ${introParts.mode === "exam" ? "on" : ""}" data-act="intro-mode" data-mode="exam">
        <b>⏱️ Thi thật</b><span>Bấm giờ ${minutes} phút · audio chỉ nghe 1 lần · chấm điểm khi nộp bài</span></button>
      <button class="mode ${introParts.mode === "practice" ? "on" : ""}" data-act="intro-mode" data-mode="practice">
        <b>📖 Luyện tập</b><span>Không giới hạn giờ · nghe lại thoải mái · xem đáp án và giải thích ngay sau mỗi câu</span></button>
    </div>
    <div class="section-title row"><span class="grow">Chọn Part</span><button class="link" data-act="intro-all">${allSel ? "Bỏ chọn hết" : "Chọn tất cả"}</button></div>
    <div class="card" style="padding:4px 12px">
      ${t.parts
        .map(
          (p) => `<label class="list-row">
          <input type="checkbox" data-intro-part="${p.part}" ${introParts.sel.has(p.part) ? "checked" : ""}>
          <div class="grow"><div class="t">Part ${p.part} · ${PARTS[p.part].name}</div><div class="muted small">${PARTS[p.part].short} · ${counts[p.part]} câu</div></div>
          <span class="chip plain">${PARTS[p.part].section === "L" ? "Listening" : "Reading"}</span></label>`
        )
        .join("")}
    </div>
    <button class="btn primary block" data-act="intro-start" ${selCount ? "" : "disabled"}>Bắt đầu ${selCount} câu →</button>
    ${
      past.length
        ? `<div class="section-title">Các lần đã làm</div><div class="card" style="padding:4px 12px">${past
            .map(
              (a) => `<a class="list-row" href="#/result/${a.id}"><div class="grow"><div class="t">${dayLabel(a.finishedAt)} · ${a.correct}/${a.total} câu</div>
              <div class="muted small">${fmtDuration(a.elapsed)}</div></div>${a.est?.total ? `<span class="chip purple">≈${a.est.total}</span>` : ""}
              <span class="chip ${accClass(a.correct, a.total)}">${pct(a.correct, a.total)}%</span></a>`
            )
            .join("")}</div>`
        : ""
    }`;
}

// ================= MÀN HÌNH LÀM BÀI =================

const RUN_KEY = "wf.toeic.runner";
let runner = LS.get(RUN_KEY, null);
let stopAudio = null;
let playing = null; // id nhóm đang phát

const saveRunner = () => LS.set(RUN_KEY, runner);

function elapsed() {
  if (!runner) return 0;
  return runner.base + (runner.resumed ? (Date.now() - runner.resumed) / 1000 : 0);
}
function pauseRunner() {
  if (!runner || !runner.resumed) return;
  runner.base = elapsed();
  runner.resumed = null;
  saveRunner();
}
function resumeRunner() {
  if (runner && !runner.resumed) {
    runner.resumed = Date.now();
    saveRunner();
  }
}

// Chia đề thành các trang: Part 5 gộp 5 câu một trang, các Part khác mỗi nhóm câu một trang.
const PER_PAGE = { 5: 5 };
function runPages() {
  const pages = [];
  for (const p of runner.test.parts) {
    const size = PER_PAGE[p.part] || 1;
    p.groups.forEach((g, i) => {
      const last = pages[pages.length - 1];
      if (i > 0 && size > 1 && last.groups.length < size) last.groups.push(g);
      else pages.push({ part: p.part, directions: i === 0 ? p.directions : "", groups: [g] });
    });
  }
  return pages;
}
function runFlat() {
  return T.flatQuestions(runner.test);
}

function startRun(test, mode = "exam", parts = null) {
  if (parts) test = { ...test, parts: test.parts.filter((p) => parts.includes(p.part)) };
  const count = T.flatQuestions(test).length;
  const full = T.flatQuestions(T.bank.test(test.id) || test).length;
  const limit = mode === "exam" && test.duration ? Math.round((test.duration * 60 * count) / full) : 0;
  stopAudio?.();
  runner = { test, mode, startedAt: nowSecs(), base: 0, resumed: Date.now(), limit, answers: {}, flagged: [], gi: 0, played: {}, palette: false };
  saveRunner();
  go("#/run");
}

function groupCaption(part, g) {
  const nums = g.questions.map((q) => q.no);
  const range = nums.length > 1 ? `Questions ${nums[0]}–${nums[nums.length - 1]}` : `Question ${nums[0]}`;
  if (part === 3) return `${range} refer to the following conversation.`;
  if (part === 4) return `${range} refer to the following talk.`;
  if (part === 6 || part === 7) {
    const kinds = { email: "e-mail", chat: "text-message chain", memo: "memo", notice: "notice", article: "article", ad: "advertisement", letter: "letter", form: "form" };
    const k = (g.passages || []).map((p) => kinds[p.kind] || "text");
    return `${range} refer to the following ${k.length > 1 ? k.join(" and ") : k[0] || "text"}.`;
  }
  return "";
}

function highlight(html, evidence) {
  for (const e of evidence) {
    const ee = esc(e);
    if (ee && html.includes(ee)) html = html.split(ee).join(`<mark>${ee}</mark>`);
  }
  return html;
}

function passageHtml(p, evidence = []) {
  if (p.kind === "chat") {
    const lines = p.text.split("\n").map((line) => {
      const m = line.match(/^(.+?) \[(.+?)\]:\s*(.*)$/);
      return m
        ? `<div class="msg"><div class="who"><b>${esc(m[1])}</b> <span>${esc(m[2])}</span></div><div>${highlight(esc(m[3]), evidence)}</div></div>`
        : `<div class="msg">${highlight(esc(line), evidence)}</div>`;
    });
    return `<div class="passage chat">${lines.join("")}</div>`;
  }
  if (p.kind === "table") {
    // Mỗi dòng là một hàng, các cột cách nhau bởi từ 2 khoảng trắng trở lên.
    const rows = p.text.split("\n").map((line) => `<tr>${line.trim().split(/\s{2,}/).map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`);
    return `<div class="passage table">${p.title ? `<div class="p-title">${esc(p.title)}</div>` : ""}<table>${rows.join("")}</table></div>`;
  }
  let body = esc(p.text).replace(/\{\{(\d+)\}\}/g, '<span class="blank">($1) ________</span>');
  body = highlight(body, evidence);
  return `<div class="passage ${p.kind || ""}">
    ${p.title ? `<div class="p-title">${esc(p.title)}</div>` : ""}
    ${p.head ? `<div class="p-head">${esc(p.head).replace(/\n/g, "<br>")}</div>` : ""}
    <div class="p-body">${body.replace(/\n/g, "<br>")}</div>
  </div>`;
}

function transcriptHtml(g, evidence = []) {
  return `<div class="transcript"><div class="small muted" style="margin-bottom:6px">📜 Transcript</div>${(g.script || [])
    .map((l) => `<div class="line"><b class="sp ${/^M/.test(l.sp) ? "m" : "w"}">${esc(l.sp || "")}</b><span>${highlight(esc(l.text), evidence)}</span>
      <span class="accent">${esc((l.accent || "us").toUpperCase())}</span></div>`)
    .join("")}</div>`;
}

function audioBox(g, gid, { exam, review }) {
  const isPlaying = playing === gid;
  const used = exam && runner?.played?.[gid];
  const accents = [...new Set((g.script || []).map((l) => (l.accent || "us").toUpperCase()))].join(" · ");
  return `<div class="audio ${isPlaying ? "on" : ""}">
    <button class="play" data-act="${isPlaying ? "rt-stop" : "rt-play"}" data-g="${esc(gid)}" ${used && !isPlaying && !review ? "disabled" : ""}>${isPlaying ? "⏹" : "▶"}</button>
    <div class="grow">
      <div class="t">${isPlaying ? "Đang phát…" : used && !review ? "Đã phát (thi thật chỉ nghe 1 lần)" : "Phát audio"}</div>
      <div class="muted small">Giọng: ${accents}${exam && !review ? " · nghe 1 lần" : ""}</div>
    </div>
    ${!exam || review ? `<button class="chip plain" data-act="rt-play" data-g="${esc(gid)}" data-slow="1">🐢 0.8x</button>` : ""}
  </div>`;
}

// Một câu hỏi. state: { chosen, reveal, flagged, review, reason }
function questionHtml(q, part, st) {
  const hideText = (part === 1 || part === 2) && !st.reveal;
  const opts = q.options
    .map((o, i) => {
      let cls = "";
      if (st.reveal) cls = i === q.answer ? "correct" : i === st.chosen ? "wrong" : "";
      else if (i === st.chosen) cls = "picked";
      return `<button class="opt ${cls} ${hideText ? "letter-only" : ""}" data-act="rt-choose" data-q="${q.id}" data-i="${i}" ${st.review ? "disabled" : ""}>
        <span class="n">${LETTERS[i]}</span>${hideText ? "" : `<span class="grow">${esc(o)}</span>`}</button>`;
    })
    .join("");
  const ok = st.chosen === q.answer;
  return `<div class="q ${st.reveal ? (ok ? "is-ok" : "is-bad") : ""}" id="q-${q.id}">
    <div class="q-head">
      <span class="qn">${q.no}</span>
      <div class="grow q-text">${q.prompt ? esc(q.prompt).replace(/-{4,}/g, '<span class="blank">________</span>') : part === 6 ? `Chọn đáp án cho chỗ trống (${q.no})` : part <= 2 ? "Chọn đáp án đúng" : ""}</div>
      ${st.review ? "" : `<button class="flag ${st.flagged ? "on" : ""}" data-act="rt-flag" data-q="${q.id}" aria-label="Đánh dấu xem lại">🚩</button>`}
    </div>
    <div class="opts ${hideText ? "row-opts" : ""}">${opts}</div>
    ${
      st.reveal
        ? `<div class="explain ${ok ? "good" : "warn"}"><span>${st.chosen == null ? "⏭️" : ok ? "✅" : "❌"}</span>
            <div class="grow">${st.chosen == null ? "<b>Bỏ trống.</b> " : ""}Đáp án: <b>${LETTERS[q.answer]}</b>. ${esc(q.explain || "")}
            ${q.vocab?.length ? `<div class="vocab">${q.vocab.map(([w, m]) => `<span><b>${esc(w)}</b>: ${esc(m)}</span>`).join("")}</div>` : ""}</div></div>
           <div class="q-meta small muted">${esc(T.typeLabel(q.type))}</div>`
        : ""
    }
    ${
      st.review && !ok
        ? `<div class="reasons"><span class="small muted">Lý do sai:</span>${Object.entries(REASONS)
            .map(([k, l]) => `<button class="chip ${st.reason === k ? "on" : "plain"}" data-act="reason" data-q="${q.id}" data-r="${k}">${l}</button>`)
            .join("")}</div>`
        : ""
    }
  </div>`;
}

function groupHtml(part, g, opts) {
  const { review, answers, exam, flagged, reasons } = opts;
  const qs = opts.only ? g.questions.filter((q) => opts.only.has(q.id)) : g.questions;
  const revealAll = review;
  const evidence = revealAll || g.questions.every((q) => opts.revealed?.(q.id)) ? qs.map((q) => q.evidence).filter(Boolean) : [];
  const gid = g.id;
  const listening = part <= 4;
  return `<section class="group">
    ${groupCaption(part, g) ? `<div class="g-cap">${groupCaption(part, g)}</div>` : ""}
    ${listening ? audioBox(g, gid, { exam, review }) : ""}
    ${g.image ? `<img class="g-img" src="${esc(g.image)}" alt="">` : ""}
    ${(g.passages || []).map((p) => passageHtml(p, evidence)).join("")}
    ${qs
      .map((q) =>
        questionHtml(q, part, {
          chosen: answers[q.id],
          reveal: revealAll || !!opts.revealed?.(q.id),
          flagged: flagged?.includes(q.id),
          review,
          reason: reasons?.[q.id],
        })
      )
      .join("")}
    ${listening && (revealAll || g.questions.every((q) => opts.revealed?.(q.id))) ? transcriptHtml(g, evidence) : ""}
  </section>`;
}

function paletteHtml() {
  const cur = new Set(runPages()[runner.gi].groups.flatMap((g) => g.questions.map((q) => q.id)));
  const byPart = {};
  for (const { q, part } of runFlat()) (byPart[part] || (byPart[part] = [])).push(q);
  const done = Object.keys(runner.answers).length;
  const total = runFlat().length;
  return `<div class="palette">
    <div class="pal-head"><b>Danh sách câu</b><span class="muted small">${done}/${total} đã làm</span></div>
    ${Object.entries(byPart)
      .map(
        ([p, qs]) => `<div class="pal-part">Part ${p}</div><div class="pal-grid">${qs
          .map((q) => {
            const a = runner.answers[q.id];
            let cls = a != null ? "answered" : "";
            if (runner.mode === "practice" && a != null) cls = a === q.answer ? "ok" : "bad";
            return `<button class="${cls} ${runner.flagged.includes(q.id) ? "flagged" : ""} ${cur.has(q.id) ? "cur" : ""}" data-act="rt-goto" data-q="${q.id}">${q.no}</button>`;
          })
          .join("")}</div>`
      )
      .join("")}
    <div class="pal-legend small muted"><span><i class="lg answered"></i>Đã làm</span><span><i class="lg flagged"></i>Đánh dấu</span><span><i class="lg"></i>Chưa làm</span></div>
    <button class="btn primary block" data-act="rt-submit">Nộp bài</button>
  </div>`;
}

function viewRun() {
  if (!runner) {
    go("#/tests");
    return "";
  }
  resumeRunner();
  const pages = runPages();
  runner.gi = Math.min(runner.gi, pages.length - 1);
  const cur = pages[runner.gi];
  const exam = runner.mode === "exam";
  const total = runFlat().length;
  const done = Object.keys(runner.answers).length;
  const nums = cur.groups.flatMap((g) => g.questions.map((q) => q.no));
  return `<div class="runner">
    <div class="rt-top">
      <button class="icon-btn" data-act="rt-exit" aria-label="Thoát">✕</button>
      <div class="grow" style="min-width:0">
        <div class="rt-title">${esc(runner.test.title)}</div>
        <div class="muted small">Part ${cur.part} · Câu ${nums[0]}${nums.length > 1 ? "–" + nums[nums.length - 1] : ""} · ${done}/${total}</div>
      </div>
      <div class="timer ${exam && runner.limit && runner.limit - elapsed() < 300 ? "late" : ""}" id="rt-time">${timerText()}</div>
      <button class="btn primary sm" data-act="rt-submit">Nộp</button>
    </div>
    <div class="rt-progress">${bar(done, total)}</div>
    <div class="rt-body">
      <div class="rt-main">
        ${cur.directions ? `<details class="directions"><summary>Part ${cur.part} · ${PARTS[cur.part].short} — Hướng dẫn</summary><p>${esc(cur.directions)}</p></details>` : ""}
        ${cur.groups
          .map((g) =>
            groupHtml(cur.part, g, {
              answers: runner.answers,
              exam,
              flagged: runner.flagged,
              revealed: exam ? null : (qid) => runner.answers[qid] != null,
            })
          )
          .join("")}
      </div>
      <aside class="rt-side">${paletteHtml()}</aside>
    </div>
    <div class="rt-bottom">
      <button class="btn" data-act="rt-prev" ${runner.gi === 0 ? "disabled" : ""}>← Trước</button>
      <button class="btn pal-btn" data-act="rt-palette">☰ ${done}/${total}</button>
      ${
        runner.gi < pages.length - 1
          ? `<button class="btn primary" data-act="rt-next">Sau →</button>`
          : `<button class="btn primary" data-act="rt-submit">Nộp bài</button>`
      }
    </div>
    ${runner.palette ? `<div class="sheet-bg" data-act="rt-palette"></div><div class="sheet">${paletteHtml()}</div>` : ""}
  </div>`;
}

function timerText() {
  if (!runner) return "";
  const e = elapsed();
  return runner.mode === "exam" && runner.limit ? "⏱ " + fmtDuration(runner.limit - e) : "⏱ " + fmtDuration(e);
}

setInterval(() => {
  if (!runner || !currentHash.startsWith("#/run")) return;
  const el = document.getElementById("rt-time");
  if (el) {
    el.textContent = timerText();
    el.classList.toggle("late", runner.mode === "exam" && !!runner.limit && runner.limit - elapsed() < 300);
  }
  if (runner.mode === "exam" && runner.limit && elapsed() >= runner.limit) {
    toast("Hết giờ! Bài đã được nộp tự động");
    finishRun();
  }
}, 1000);

function finishRun() {
  stopAudio?.();
  const r = runner;
  const a = T.saveAttempt(r.test, r.answers, { startedAt: r.startedAt, elapsed: elapsed(), flagged: r.flagged });
  runner = null;
  saveRunner();
  go("#/result/" + a.id);
}

function playGroup(gid, slow) {
  const g = (runner && currentHash.startsWith("#/run") ? runner.test.parts.flatMap((p) => p.groups).find((x) => x.id === gid) : null) || T.bank.questions.get(reviewGroupQ(gid))?.group;
  if (!g) return;
  stopAudio?.();
  playing = gid;
  if (runner && runner.mode === "exam" && currentHash.startsWith("#/run")) {
    runner.played[gid] = true;
    saveRunner();
  }
  stopAudio = speakLines(g.script, {
    rate: slow ? 0.75 : 0.95,
    onEnd: () => {
      if (playing === gid) {
        playing = null;
        stopAudio = null;
        rerender();
      }
    },
  });
  rerender();
}

// Tìm một câu bất kỳ của nhóm (dùng khi phát audio trong trang xem đáp án).
function reviewGroupQ(gid) {
  for (const [qid, v] of T.bank.questions) if (v.group.id === gid) return qid;
  return null;
}

// ================= KẾT QUẢ & XEM ĐÁP ÁN =================

function viewResult(id) {
  const a = T.attempt(id);
  if (!a) return viewTests();
  const types = Object.entries(a.perType || {})
    .filter(([k]) => k)
    .sort((x, y) => x[1].c / x[1].t - y[1].c / y[1].t);
  const wrong = Object.values(a.res).filter((v) => !v).length;
  const hasL = a.sec?.L?.t > 0;
  const hasR = a.sec?.R?.t > 0;
  const showScore = a.kind === "full" || a.kind === "mini";
  return `${header("Kết quả", `${esc(a.title)} · ${dayLabel(a.finishedAt)}`, { back: true })}
    <div class="card result-hero">
      ${
        showScore && (hasL || hasR)
          ? `<div class="muted small">Điểm ước tính${a.kind === "mini" ? " (quy đổi từ mini test)" : ""}</div>
             <div class="score">${a.est.total ?? (a.est.L ?? a.est.R)}<small>${a.est.total != null ? " / 990" : " / 495"}</small></div>
             <div class="row" style="justify-content:center;gap:16px">
               ${hasL ? `<span>🎧 Listening <b>${a.est.L}</b></span>` : ""}${hasR ? `<span>📖 Reading <b>${a.est.R}</b></span>` : ""}</div>`
          : `<div class="muted small">Độ chính xác</div><div class="score">${pct(a.correct, a.total)}<small>%</small></div>`
      }
      <div class="kpis" style="margin-top:14px">
        <div><b style="color:var(--good)">${a.correct}</b><span>đúng</span></div>
        <div><b style="color:var(--bad)">${wrong - Object.keys(a.res).filter((q) => a.answers[q] == null).length}</b><span>sai</span></div>
        <div><b>${Object.keys(a.res).filter((q) => a.answers[q] == null).length}</b><span>bỏ trống</span></div>
        <div><b>${fmtDuration(a.elapsed)}</b><span>thời gian</span></div>
      </div>
    </div>
    <div class="btns" style="margin-bottom:12px">
      <a class="btn primary" href="#/review/${a.id}">📖 Xem đáp án & giải thích</a>
      ${wrong ? `<button class="btn" data-act="drill-wrong" data-id="${a.id}">♻️ Làm lại ${wrong} câu sai</button>` : ""}
    </div>
    <div class="section-title">Theo Part</div>
    <div class="card">
      ${Object.entries(a.perPart)
        .map(
          ([p, v]) => `<div class="part-line"><div class="pl-name"><b>Part ${p}</b><span class="muted small">${PARTS[p].name}</span></div>
          <div class="grow">${bar(v.c, v.t, accClass(v.c, v.t))}</div><span class="pl-val">${v.c}/${v.t}</span></div>`
        )
        .join("")}
    </div>
    <div class="section-title">Theo dạng câu <span class="muted small">(yếu nhất ở trên)</span></div>
    <div class="card" style="padding:4px 12px">
      ${types
        .map(
          ([k, v]) => `<button class="list-row plain-btn" data-act="drill-type" data-type="${k}">
          <div class="grow"><div class="t">${esc(T.typeLabel(k))}</div><div class="muted small">Part ${TYPES[k]?.[0] ?? "?"} · ${v.c}/${v.t} đúng</div></div>
          <span class="chip ${accClass(v.c, v.t)}">${pct(v.c, v.t)}%</span></button>`
        )
        .join("")}
    </div>
    <a class="btn block" href="#/tests">Về Luyện đề</a>`;
}

let reviewFilter = "all";

function attemptGroups(a) {
  const out = [];
  const seen = new Map();
  for (const qid of Object.keys(a.res)) {
    const info = T.bank.questions.get(qid);
    if (!info) continue;
    let entry = seen.get(info.group.id);
    if (!entry) {
      entry = { part: info.part, group: info.group, only: new Set() };
      seen.set(info.group.id, entry);
      out.push(entry);
    }
    entry.only.add(qid);
  }
  return out;
}

function viewReview(id) {
  const a = T.attempt(id);
  if (!a) return viewTests();
  const groups = attemptGroups(a);
  const flagged = new Set(a.flagged || []);
  const reasons = Object.fromEntries(Object.entries(T.mistakes).map(([k, m]) => [k, m.reason]));
  const keep = (qid) => reviewFilter === "all" || (reviewFilter === "wrong" ? !a.res[qid] : flagged.has(qid));
  const wrongN = Object.values(a.res).filter((v) => !v).length;
  let lastPart = null;
  const body = groups
    .map((g) => {
      const only = new Set([...g.only].filter(keep));
      if (!only.size) return "";
      const partHead = g.part !== lastPart ? `<div class="part-head">Part ${g.part} · ${PARTS[g.part].name}</div>` : "";
      lastPart = g.part;
      return partHead + groupHtml(g.part, g.group, { review: true, answers: a.answers, only, reasons, exam: false });
    })
    .join("");
  return `${header("Đáp án & giải thích", esc(a.title), { back: true })}
    <div class="chips" style="margin-bottom:12px">
      <button class="chip ${reviewFilter === "all" ? "on" : "plain"}" data-act="rv-filter" data-f="all">Tất cả (${Object.keys(a.res).length})</button>
      <button class="chip ${reviewFilter === "wrong" ? "on" : "plain"}" data-act="rv-filter" data-f="wrong">Sai / bỏ trống (${wrongN})</button>
      <button class="chip ${reviewFilter === "flag" ? "on" : "plain"}" data-act="rv-filter" data-f="flag">🚩 Đánh dấu (${flagged.size})</button>
    </div>
    <div class="muted small" style="margin-bottom:10px">Với mỗi câu sai, chọn lý do sai. Báo cáo tuần sẽ dựa vào đây để biết bạn yếu ở đâu.</div>
    ${body || `<div class="done"><div class="emo">🎉</div><p class="muted">Không có câu nào trong mục này.</p></div>`}`;
}

// ================= SỔ LỖI SAI =================

function viewMistakes() {
  const open = T.openMistakes();
  const byPart = {};
  const byReason = {};
  for (const m of open) {
    const p = T.bank.questions.get(m.qid).part;
    byPart[p] = (byPart[p] || 0) + 1;
    byReason[m.reason || "none"] = (byReason[m.reason || "none"] || 0) + 1;
  }
  const resolved = Object.values(T.mistakes).filter((m) => m.resolved).length;
  return `${header("📕 Sổ lỗi sai", `${open.length} câu cần làm lại · ${resolved} câu đã khắc phục`, { back: true })}
    ${
      !open.length
        ? `<div class="done"><div class="emo">✨</div><h2>Sổ lỗi sai đang trống</h2><p class="muted">Câu nào làm sai sẽ tự vào đây. Làm đúng lại 2 lần thì câu đó được tính là đã khắc phục.</p></div>`
        : `<div class="card">
        <div class="small muted" style="margin-bottom:6px">Theo Part</div>
        <div class="chips">${Object.entries(byPart).map(([p, n]) => `<button class="chip plain" data-act="drill-mistakes" data-part="${p}">Part ${p}: <b>${n}</b></button>`).join("")}</div>
        <div class="small muted" style="margin:12px 0 6px">Theo lý do</div>
        <div class="chips">${Object.entries(byReason).map(([r, n]) => `<span class="chip ${r === "none" ? "plain" : "warn"}">${r === "none" ? "Chưa ghi lý do" : REASONS[r]}: <b>${n}</b></span>`).join("")}</div>
      </div>
      <button class="btn primary block" data-act="drill-mistakes">♻️ Làm lại tất cả (${open.length} câu)</button>
      <div class="section-title">Danh sách</div>
      <div class="card" style="padding:4px 12px">${open
        .map((m) => {
          const { q, part, group } = T.bank.questions.get(m.qid);
          const text = q.prompt || (group.script?.[0]?.text ?? "") || `Câu ${q.no}`;
          return `<div class="list-row"><span class="chip plain">P${part}</span>
            <div class="grow"><div class="t clamp">${esc(text)}</div>
            <div class="muted small">${esc(T.typeLabel(q.type))} · sai ${m.wrong} lần${m.reason ? " · " + REASONS[m.reason] : ""}</div></div></div>`;
        })
        .join("")}</div>`
    }`;
}

// ================= TIẾN ĐỘ =================

function scoreChart() {
  const pts = T.scorePoints();
  const start = T.mondayOf(localDay(T.plan.start));
  const weekOf = (ts) => Math.max(1, (ts - start) / (7 * 86400) + 1);
  const W = 340, H = 190, L = 34, R = 10, TP = 12, B = 24;
  const x = (w) => L + ((Math.min(w, 48) - 1) / 47) * (W - L - R);
  const y = (s) => TP + (1 - (Math.max(10, s) - 10) / (990 - 10)) * (H - TP - B);
  const expected = [];
  for (let w = 1; w <= 48; w++) expected.push(`${x(w).toFixed(1)},${y(T.expectedScore(w)).toFixed(1)}`);
  const cw = T.currentWeek();
  const actual = pts.map((p) => [x(weekOf(p.ts)), y(p.score), p]);
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Biểu đồ điểm thi thử theo tuần">
    ${[200, 400, 600, 800, 990]
      .map((s) => `<line x1="${L}" x2="${W - R}" y1="${y(s)}" y2="${y(s)}" class="grid ${s === T.plan.target ? "target" : ""}"/><text x="${L - 4}" y="${y(s) + 4}" class="ax" text-anchor="end">${s}</text>`)
      .join("")}
    ${[1, 12, 24, 38, 48].map((w) => `<text x="${x(w)}" y="${H - 6}" class="ax" text-anchor="middle">T${w}</text>`).join("")}
    ${cw <= 48 ? `<line x1="${x(cw)}" x2="${x(cw)}" y1="${TP}" y2="${H - B}" class="now"/>` : ""}
    <polyline points="${expected.join(" ")}" class="exp"/>
    ${actual.length > 1 ? `<polyline points="${actual.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(" ")}" class="act"/>` : ""}
    ${actual.map(([a, b, p]) => `<circle cx="${a.toFixed(1)}" cy="${b.toFixed(1)}" r="4" class="dot ${p.src === "Study4" ? "s4" : ""}"><title>${esc(p.src)} ${p.score}</title></circle>`).join("")}
  </svg>
  <div class="legend-row small muted"><span><i class="lg-line exp"></i>Lộ trình</span><span><i class="lg-dot"></i>Đề trong app</span><span><i class="lg-dot s4"></i>Study4</span><span><i class="lg-line target"></i>Mục tiêu ${T.plan.target}</span></div>`;
}

function viewProgress() {
  const latest = T.latestScore();
  const acc = T.partAccuracy();
  const acc7 = T.partAccuracy(nowSecs() - 7 * 86400);
  const totalQ = T.attempts.reduce((s, a) => s + a.total, 0);
  const totalMin = T.attempts.reduce((s, a) => s + a.elapsed / 60, 0);
  const s = progress.stats(content.allIds);
  const cw = T.currentWeek();
  const phase = T.phaseOf(cw);
  return `${header("Tiến độ", `Tuần ${Math.min(cw, 48)}/48 · mục tiêu TOEIC ${T.plan.target}`)}
    <div class="stats">
      <div class="stat"><span class="i">🏁</span><div class="v">${latest ? latest.score : "—"}</div><div class="l">Điểm gần nhất</div></div>
      <div class="stat"><span class="i">🎯</span><div class="v">${T.expectedScore(cw)}</div><div class="l">Mốc tuần ${Math.min(cw, 48)}</div></div>
      <div class="stat"><span class="i">📝</span><div class="v">${totalQ}</div><div class="l">Câu đã luyện · ${fmtMinutes(totalMin)}</div></div>
      <div class="stat"><span class="i">📖</span><div class="v">${s.seen}</div><div class="l">Từ đã học / ${phase.words} mục tiêu GĐ</div></div>
    </div>
    <div class="section-title">📈 Điểm thi thử theo tuần</div>
    <div class="card">${scoreChart()}</div>
    <a class="card row link-card" href="#/report"><span style="font-size:26px">📊</span><div class="grow"><b>Báo cáo tuần</b><div class="muted small">So sánh với tuần trước + kế hoạch tuần sau</div></div><span class="muted">→</span></a>

    <div class="section-title">🎯 Độ chính xác theo Part</div>
    <div class="card">
      <div class="part-line head small muted"><div class="pl-name">Part</div><div class="grow">Tất cả</div><span class="pl-val">7 ngày</span></div>
      ${[1, 2, 3, 4, 5, 6, 7]
        .map((p) => {
          const v = acc[p];
          const w = acc7[p];
          return `<div class="part-line"><div class="pl-name"><b>Part ${p}</b><span class="muted small">${PARTS[p].name}</span></div>
            <div class="grow">${v ? bar(v.c, v.t, accClass(v.c, v.t)) : '<span class="muted small">Chưa làm</span>'}</div>
            <span class="pl-val">${v ? pct(v.c, v.t) + "%" : ""}${w ? ` · <b>${pct(w.c, w.t)}%</b>` : ""}</span></div>`;
        })
        .join("")}
    </div>

    <div class="section-title">🗺️ Lộ trình 48 tuần</div>
    <div class="card roadmap">
      ${PHASES.map(
        (p) => `<div class="phase ${p === phase ? "cur" : cw > p.to ? "past" : ""}">
          <div class="ph-dot">${cw > p.to ? "✓" : p.n}</div>
          <div class="grow"><div class="row"><b class="grow">${p.name}</b><span class="muted small">Tuần ${p.from}–${p.to}</span></div>
          <div class="small">${p.score[0]} → <b>${p.score[1]}</b> điểm · ${p.words.toLocaleString("vi-VN")} từ</div>
          <div class="muted small">${esc(p.focus)}</div></div></div>`
      ).join("")}
    </div>

    <div class="section-title row"><span class="grow">🌐 Điểm Study4</span><a class="link" href="#/study4/add">＋ Nhập điểm</a></div>
    <div class="card" style="padding:4px 12px">
      ${
        T.study4.length
          ? T.study4
              .slice()
              .reverse()
              .map(
                (e) => `<div class="list-row"><div class="grow"><div class="t">${esc(e.name || "Đề Study4")}</div>
              <div class="muted small">${dayLabel(e.ts)} · L ${e.L ?? "—"} · R ${e.R ?? "—"}${e.note ? " · " + esc(e.note) : ""}</div></div>
              <span class="chip purple">${(e.L || 0) + (e.R || 0)}</span>
              ${e.url ? `<a class="icon-btn sm" href="${esc(e.url)}" target="_blank" rel="noopener" aria-label="Mở đề">↗</a>` : ""}
              <button class="icon-btn sm" data-act="s4-del" data-id="${e.id}" aria-label="Xóa">🗑️</button></div>`
              )
              .join("")
          : `<div class="muted small" style="padding:10px 0">Chưa có. Làm đề trên Study4 rồi bấm "Nhập điểm".</div>`
      }
    </div>`;
}

// ================= BÁO CÁO TUẦN =================

function viewReport(offset = 0) {
  offset = Math.min(0, offset);
  const w = T.weekStats(offset);
  const p = T.weekStats(offset - 1);
  const target = T.plan.weeklyHours * 60;
  const weekNo = T.currentWeek() + offset;
  const expected = T.expectedScore(Math.max(1, weekNo));
  const weak = Object.entries(w.perType)
    .filter(([k, v]) => k && v.t >= 2)
    .map(([type, v]) => ({ type, ...v }))
    .sort((a, b) => a.c / a.t - b.c / b.t)
    .slice(0, 3);
  const retention = w.reviews ? pct(w.good, w.reviews) : null;
  const retentionPrev = p.reviews ? pct(p.good, p.reviews) : null;
  const best = w.mocks.length ? Math.max(...w.mocks.map((m) => m.score)) : null;
  const open = T.openMistakes().length;
  if (offset === 0 && new Date().getDay() === 0) T.toggleTick("report", true);

  // Gợi ý tuần sau.
  const tips = [];
  if (w.minutes < target * 0.8) tips.push(`⏱️ Mới học ${fmtMinutes(w.minutes)} / ${fmtMinutes(target)}. Tuần sau ưu tiên giữ đủ 4 khung giờ mỗi ngày, kể cả chỉ 10–15 phút.`);
  else tips.push(`✅ Đủ thời lượng (${fmtMinutes(w.minutes)}). Giữ nhịp này!`);
  const parts = Object.entries(w.perPart).filter(([, v]) => v.t >= 3).sort((a, b) => a[1].c / a[1].t - b[1].c / b[1].t);
  if (parts.length) tips.push(`🎯 Part yếu nhất tuần này: Part ${parts[0][0]} (${pct(parts[0][1].c, parts[0][1].t)}%). Thêm 1 buổi tối luyện riêng Part ${parts[0][0]}.`);
  if (weak.length) tips.push(`🔬 Dạng câu cần ôn: ${weak.map((x) => T.typeLabel(x.type)).join(", ")}.`);
  if (retention != null && retention < 80) tips.push(`🃏 Tỉ lệ nhớ từ ${retention}% (< 80%). Giảm số từ mới mỗi ngày xuống còn ${Math.max(5, progress.settings.dailyNewLimit - 5)} để ôn kỹ hơn.`);
  if (open > 15) tips.push(`📕 Sổ lỗi sai đang có ${open} câu. Chủ nhật dành 30 phút làm lại.`);
  if (!w.mocks.length) tips.push("📝 Tuần này chưa có điểm thi thử. Thứ 7 làm 1 đề full (Study4 hoặc trong app).");
  else if (best < expected) tips.push(`📉 Điểm thi thử ${best} thấp hơn mốc lộ trình ${expected}. Chưa sao: tập trung vào phần sai nhiều nhất thay vì làm thêm đề.`);
  else tips.push(`📈 Điểm thi thử ${best} đạt mốc lộ trình (${expected}). Tuyệt vời!`);

  const range = `${dayLabel(w.from)} – ${dayLabel(w.to - 86400)}`;
  return `${header("📊 Báo cáo tuần", `${range} · tuần ${Math.max(1, weekNo)} của lộ trình`, { back: true })}
    <div class="week-nav">
      <a class="btn sm" href="#/report/${offset - 1}">← Tuần trước</a>
      <span class="grow center muted small">${offset === 0 ? "Tuần này" : `${-offset} tuần trước`}</span>
      ${offset < 0 ? `<a class="btn sm" href="#/report/${offset + 1}">Tuần sau →</a>` : `<span class="btn sm ghost">Tuần sau →</span>`}
    </div>

    <div class="section-title">⏱️ Thời gian & đều đặn</div>
    <div class="stats">
      <div class="stat"><div class="v">${fmtMinutes(w.minutes)}</div><div class="l">/ ${fmtMinutes(target)} · ${delta(w.minutes, p.minutes, "′")}</div>${bar(w.minutes, target)}</div>
      <div class="stat"><div class="v">${w.days}/7</div><div class="l">ngày có học · ${delta(w.days, p.days)}</div>${bar(w.days, 7)}</div>
    </div>

    <div class="section-title">📖 Từ vựng</div>
    <div class="stats three">
      <div class="stat"><div class="v">${w.newWords}</div><div class="l">từ mới ${delta(w.newWords, p.newWords)}</div></div>
      <div class="stat"><div class="v">${w.reviews}</div><div class="l">lượt ôn ${delta(w.reviews, p.reviews)}</div></div>
      <div class="stat"><div class="v">${retention != null ? retention + "%" : "—"}</div><div class="l">tỉ lệ nhớ ${delta(retention, retentionPrev, "%")}</div></div>
    </div>

    <div class="section-title">📝 Luyện đề</div>
    <div class="card">
      <div class="row" style="margin-bottom:8px"><div class="grow"><b>${w.total}</b> câu · đúng <b>${w.total ? pct(w.correct, w.total) : 0}%</b></div>
        ${delta(w.total ? pct(w.correct, w.total) : null, p.total ? pct(p.correct, p.total) : null, "%")}</div>
      ${[1, 2, 3, 4, 5, 6, 7]
        .filter((x) => w.perPart[x] || p.perPart[x])
        .map((x) => {
          const v = w.perPart[x];
          const pv = p.perPart[x];
          return `<div class="part-line"><div class="pl-name"><b>Part ${x}</b><span class="muted small">${PARTS[x].name}</span></div>
            <div class="grow">${v ? bar(v.c, v.t, accClass(v.c, v.t)) : '<span class="muted small">Không làm</span>'}</div>
            <span class="pl-val">${v ? pct(v.c, v.t) + "%" : "—"} ${v && pv ? delta(pct(v.c, v.t), pct(pv.c, pv.t), "%") : ""}</span></div>`;
        })
        .join("") || `<div class="muted small">Tuần này chưa làm bài nào.</div>`}
      <div class="muted small" style="margin-top:8px">${w.newMistakes} câu sai mới vào sổ lỗi</div>
    </div>

    <div class="section-title">🏁 Thi thử</div>
    <div class="card">
      ${
        w.mocks.length
          ? w.mocks.map((m) => `<div class="list-row"><div class="grow"><b>${m.score}</b> <span class="muted small">${esc(m.src)}${m.estimate ? " (ước tính)" : ""} · L ${m.L ?? "—"} · R ${m.R ?? "—"}</span></div>
              <span class="chip ${m.score >= expected ? "good" : "warn"}">${m.score >= expected ? "Đạt mốc" : `Mốc ${expected}`}</span></div>`).join("")
          : `<div class="muted small">Chưa có điểm thi thử tuần này. Mốc lộ trình: <b>${expected}</b>.</div>`
      }
    </div>

    ${
      weak.length
        ? `<div class="section-title">🩺 Dạng câu yếu nhất tuần</div><div class="card" style="padding:4px 12px">${weak
            .map(
              (x) => `<button class="list-row plain-btn" data-act="drill-type" data-type="${x.type}"><span class="chip ${accClass(x.c, x.t)}">${pct(x.c, x.t)}%</span>
          <div class="grow"><div class="t">${esc(T.typeLabel(x.type))}</div><div class="muted small">${x.c}/${x.t} đúng</div></div><span class="muted">Luyện →</span></button>`
            )
            .join("")}</div>`
        : ""
    }

    <div class="section-title">🧭 Kế hoạch tuần sau</div>
    <div class="card tips">${tips.map((t) => `<div>${esc(t)}</div>`).join("")}</div>`;
}

// ================= NHẬP ĐIỂM STUDY4 =================

function viewStudy4Add() {
  const today = new Date();
  const p = (n) => String(n).padStart(2, "0");
  const d = `${today.getFullYear()}-${p(today.getMonth() + 1)}-${p(today.getDate())}`;
  return `${header("Nhập điểm Study4", "Điểm được lưu trên máy này để vẽ biểu đồ tiến độ.", { back: true })}
    <form class="card stack" data-form="study4">
      <label class="lbl">Tên đề<input class="field" name="name" placeholder="VD: ETS 2024 – Test 3" required></label>
      <label class="lbl">Link đề (không bắt buộc)<input class="field" name="url" type="url" placeholder="https://study4.com/tests/…" autocapitalize="off"></label>
      <div class="two">
        <label class="lbl">🎧 Listening<input class="field" name="L" type="number" min="5" max="495" step="5" inputmode="numeric" placeholder="5–495" required></label>
        <label class="lbl">📖 Reading<input class="field" name="R" type="number" min="5" max="495" step="5" inputmode="numeric" placeholder="5–495" required></label>
      </div>
      <label class="lbl">Ngày làm<input class="field" name="date" type="date" value="${d}"></label>
      <details><summary class="small">Số câu đúng từng Part (không bắt buộc, giúp phân tích điểm yếu)</summary>
        <div class="part-inputs">${[1, 2, 3, 4, 5, 6, 7]
          .map((x) => `<label class="lbl small">Part ${x} <span class="muted">/${PART_SIZE[x]}</span><input class="field" name="p${x}" type="number" min="0" max="${PART_SIZE[x]}" inputmode="numeric"></label>`)
          .join("")}</div>
      </details>
      <label class="lbl">Ghi chú<input class="field" name="note" placeholder="VD: Part 3 bị rối thời gian"></label>
      <button class="btn primary block" type="submit">Lưu điểm</button>
    </form>`;
}

function saveStudy4Form(form) {
  const f = new FormData(form);
  const num = (k) => (f.get(k) === "" || f.get(k) == null ? null : Number(f.get(k)));
  const L = num("L");
  const R = num("R");
  if (L == null || R == null || L < 5 || L > 495 || R < 5 || R > 495) {
    toast("Điểm mỗi phần phải từ 5 đến 495");
    return;
  }
  const perPart = {};
  for (let x = 1; x <= 7; x++) {
    const v = num("p" + x);
    if (v != null) perPart[x] = { c: v, t: PART_SIZE[x] };
  }
  const dateStr = f.get("date");
  // Nhập cho hôm nay thì lấy giờ hiện tại để thứ tự trên biểu đồ đúng với các bài làm trong app.
  const ts = !dateStr || localDay(dateStr) === startOfDay(0) ? nowSecs() : localDay(dateStr) + 12 * 3600;
  T.addStudy4({ name: String(f.get("name") || "").trim(), url: String(f.get("url") || "").trim(), L, R, perPart, note: String(f.get("note") || "").trim(), ts });
  toast("Đã lưu điểm Study4");
  go("#/progress");
}

// ================= CÀI ĐẶT LỘ TRÌNH =================

export function settingsCard() {
  return `<div class="card stack">
    <b>🎯 Mục tiêu & lộ trình</b>
    <label class="lbl">Điểm mục tiêu
      <select class="field" data-plan="target">${[600, 650, 700, 750, 800, 850, 900, 950]
        .map((v) => `<option value="${v}" ${T.plan.target === v ? "selected" : ""}>${v}</option>`)
        .join("")}</select></label>
    <label class="lbl">Ngày bắt đầu lộ trình (tuần 1)<input class="field" type="date" data-plan="start" value="${esc(T.plan.start)}"></label>
    <label class="lbl">Ngày thi dự kiến<input class="field" type="date" data-plan="examDate" value="${esc(T.plan.examDate)}"></label>
    <div class="row"><div class="grow">Số giờ học mỗi tuần<div class="muted small">Gợi ý cho người đi làm: 12–15 giờ</div></div>
      <div class="stepper"><button data-act="plan-hours" data-d="-0.5">−</button><b>${T.plan.weeklyHours}</b><button data-act="plan-hours" data-d="0.5">+</button></div></div>
  </div>`;
}

// ================= ĐIỀU HƯỚNG & SỰ KIỆN =================

export const routes = [
  [/^#?\/?$/, "home", () => viewToday()],
  [/^#\/tests$/, "tests", () => viewTests()],
  [/^#\/test\/([\w-]+)$/, "tests", (m) => viewTestIntro(m[1])],
  [/^#\/run$/, "run", () => viewRun()],
  [/^#\/result\/([\w-]+)$/, "tests", (m) => viewResult(m[1])],
  [/^#\/review\/([\w-]+)$/, "tests", (m) => viewReview(m[1])],
  [/^#\/mistakes$/, "tests", () => viewMistakes()],
  [/^#\/study4\/add$/, "tests", () => viewStudy4Add()],
  [/^#\/progress$/, "progress", () => viewProgress()],
  [/^#\/report(?:\/(-?\d+))?$/, "progress", (m) => viewReport(Number(m[1] || 0))],
];

export async function init(renderFn) {
  rerender = renderFn;
  try {
    await T.bank.load();
  } catch (e) {
    console.warn("Không tải được ngân hàng đề", e);
  }
}

export function onRoute(hash) {
  if (currentHash.startsWith("#/run") && !hash.startsWith("#/run")) {
    stopAudio?.();
    pauseRunner();
  }
  if (currentHash !== hash && hash.startsWith("#/review")) reviewFilter = "all";
  currentHash = hash;
}

function startDrill(opts) {
  const test = T.bank.drill(opts);
  if (!T.flatQuestions(test).length) {
    toast("Chưa có câu hỏi cho mục này");
    return;
  }
  startRun(test, "practice");
}

function scrollToQuestion(qid) {
  requestAnimationFrame(() => document.getElementById("q-" + qid)?.scrollIntoView({ block: "center" }));
}

document.addEventListener("click", (ev) => {
  const el = ev.target.closest("[data-act]");
  if (!el) return;
  const act = el.dataset.act;
  switch (act) {
    case "tick":
      T.toggleTick(el.dataset.id);
      rerender();
      break;
    case "drill-part":
      startDrill({ part: el.dataset.parts.split(",").map(Number), count: 10 });
      break;
    case "drill-type":
      startDrill({ type: el.dataset.type, count: 10 });
      break;
    case "drill-mistakes": {
      let open = T.openMistakes();
      if (el.dataset.part) open = open.filter((m) => T.bank.questions.get(m.qid).part === Number(el.dataset.part));
      if (!open.length) {
        toast("Không có câu sai nào cần làm lại 🎉");
        break;
      }
      startDrill({ qids: open.map((m) => m.qid), count: 999, title: "Làm lại câu sai" });
      break;
    }
    case "drill-wrong": {
      const a = T.attempt(el.dataset.id);
      const qids = Object.keys(a.res).filter((q) => !a.res[q]);
      startDrill({ qids, count: 999, title: "Làm lại câu sai · " + a.title });
      break;
    }
    case "intro-mode":
      introParts.mode = el.dataset.mode;
      rerender();
      break;
    case "intro-all": {
      const t = T.bank.test(introParts.id);
      introParts.sel = introParts.sel.size === t.parts.length ? new Set() : new Set(t.parts.map((p) => p.part));
      rerender();
      break;
    }
    case "intro-start": {
      const t = T.bank.test(introParts.id);
      if (runner && !confirm("Bạn đang có một bài làm dở. Bỏ bài đó để bắt đầu bài mới?")) break;
      const all = introParts.sel.size === t.parts.length;
      startRun(t, introParts.mode, all ? null : [...introParts.sel]);
      break;
    }
    case "rt-resume":
      go("#/run");
      break;
    case "rt-discard":
      if (confirm("Bỏ bài đang làm dở? Các câu đã chọn sẽ mất.")) {
        runner = null;
        saveRunner();
        rerender();
      }
      break;
    case "rt-exit":
      pauseRunner();
      toast("Đã lưu bài làm, có thể làm tiếp sau");
      go("#/tests");
      break;
    case "rt-choose": {
      if (!runner) break;
      const qid = el.dataset.q;
      if (runner.mode === "practice" && runner.answers[qid] != null) break; // đã chốt đáp án
      runner.answers[qid] = Number(el.dataset.i);
      saveRunner();
      rerender();
      break;
    }
    case "rt-flag": {
      const qid = el.dataset.q;
      const i = runner.flagged.indexOf(qid);
      if (i >= 0) runner.flagged.splice(i, 1);
      else runner.flagged.push(qid);
      saveRunner();
      rerender();
      break;
    }
    case "rt-prev":
    case "rt-next":
      stopAudio?.();
      runner.gi += act === "rt-next" ? 1 : -1;
      saveRunner();
      rerender();
      window.scrollTo(0, 0);
      break;
    case "rt-palette":
      runner.palette = !runner.palette;
      rerender();
      break;
    case "rt-goto": {
      const qid = el.dataset.q;
      const gi = runPages().findIndex((pg) => pg.groups.some((g) => g.questions.some((q) => q.id === qid)));
      if (gi >= 0) {
        if (gi !== runner.gi) stopAudio?.();
        runner.gi = gi;
        runner.palette = false;
        saveRunner();
        rerender();
        scrollToQuestion(qid);
      }
      break;
    }
    case "rt-play":
      playGroup(el.dataset.g, !!el.dataset.slow);
      break;
    case "rt-stop":
      stopAudio?.();
      break;
    case "rt-submit": {
      if (!runner) break;
      const total = runFlat().length;
      const left = total - Object.keys(runner.answers).length;
      if (confirm(left ? `Còn ${left} câu chưa làm. Vẫn nộp bài?` : "Nộp bài và xem kết quả?")) finishRun();
      break;
    }
    case "rv-filter":
      reviewFilter = el.dataset.f;
      rerender();
      break;
    case "reason":
      T.setReason(el.dataset.q, el.dataset.r);
      rerender();
      break;
    case "s4-del":
      if (confirm("Xóa điểm này?")) {
        T.removeStudy4(el.dataset.id);
        rerender();
      }
      break;
    case "plan-hours":
      T.plan.weeklyHours = Math.min(40, Math.max(3, T.plan.weeklyHours + Number(el.dataset.d)));
      T.savePlan();
      rerender();
      break;
  }
});

document.addEventListener("change", (ev) => {
  const t = ev.target;
  if (t.dataset.introPart && introParts) {
    const p = Number(t.dataset.introPart);
    if (t.checked) introParts.sel.add(p);
    else introParts.sel.delete(p);
    rerender();
  } else if (t.dataset.plan) {
    const k = t.dataset.plan;
    T.plan[k] = k === "target" ? Number(t.value) : t.value;
    if (k === "start" && !t.value) T.plan.start = T.plan.start || new Date().toISOString().slice(0, 10);
    T.savePlan();
    toast("Đã lưu");
  }
});

document.addEventListener("submit", (ev) => {
  if (ev.target.dataset.form === "study4") {
    ev.preventDefault();
    saveStudy4Form(ev.target);
  }
});

document.addEventListener("visibilitychange", () => {
  if (!runner) return;
  // Lưu thời gian đã làm khi rời app; quay lại thì đồng hồ chạy tiếp.
  if (document.visibilityState === "hidden") saveRunner();
});

// Phím tắt trên máy tính khi làm bài: A–D chọn đáp án câu đầu tiên chưa làm, ←/→ chuyển nhóm.
document.addEventListener("keydown", (ev) => {
  if (!runner || !currentHash.startsWith("#/run") || ev.target.matches("input, select, textarea")) return;
  if (ev.key === "ArrowRight") document.querySelector('[data-act="rt-next"]')?.click();
  else if (ev.key === "ArrowLeft") document.querySelector('[data-act="rt-prev"]')?.click();
  else {
    const i = "abcd".indexOf(ev.key.toLowerCase());
    if (i < 0) return;
    const q = runPages()[runner.gi].groups.flatMap((g) => g.questions).find((x) => runner.answers[x.id] == null);
    if (q) document.querySelector(`[data-act="rt-choose"][data-q="${q.id}"][data-i="${i}"]`)?.click();
  }
});

export const isBusy = () => currentHash.startsWith("#/run");
