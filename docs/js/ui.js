// Tiện ích giao diện dùng chung: escape HTML, tiêu đề trang, thanh tiến độ, phát âm, thông báo.

export const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
export const hl = (s) => esc(s).replace(/\*(.+?)\*/g, '<b class="hl">$1</b>');
export const plain = (s) => String(s ?? "").replace(/\*/g, "");
export const go = (hash) => (location.hash = hash);

export function header(title, sub = "", { back = false, right = "" } = {}) {
  return `<div class="head">
    ${back ? `<button class="icon-btn" data-act="back" aria-label="Quay lại">←</button>` : ""}
    <div class="grow"><h1>${title}</h1>${sub ? `<div class="sub">${sub}</div>` : ""}</div>
    ${right}
  </div>`;
}

export const GEAR = `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>`;

export const bar = (value, max, cls = "") =>
  `<div class="bar ${cls}"><i style="width:${max ? Math.min(100, Math.round((100 * value) / max)) : 0}%"></i></div>`;

export const pct = (c, t) => (t ? Math.round((100 * c) / t) : 0);

// ---------------- Phát âm ----------------

const ACCENT_LANG = { us: "en-US", uk: "en-GB", au: "en-AU", ca: "en-CA" };
let voices = [];
function loadVoices() {
  voices = speechSynthesis.getVoices().filter((v) => v.lang && v.lang.replace("_", "-").startsWith("en"));
}
if ("speechSynthesis" in window) {
  loadVoices();
  speechSynthesis.onvoiceschanged = loadVoices;
}

// Chọn giọng theo vùng (us/uk/au/ca); thiếu giọng vùng đó thì lùi về giọng Mỹ.
function voiceFor(accent = "us", index = 0) {
  const lang = ACCENT_LANG[accent] || "en-US";
  const norm = (v) => v.lang.replace("_", "-");
  const same = voices.filter((v) => norm(v) === lang);
  const pool = same.length ? same : voices.filter((v) => norm(v) === "en-US");
  const preferred = pool.filter((v) => /Samantha|Daniel|Karen|Google|Aaron|Nicky|Moira|Kate|Serena/i.test(v.name));
  const list = preferred.length ? preferred : pool.length ? pool : voices;
  return list.length ? list[index % list.length] : null;
}

export function speak(text, slow = false, accent = "us") {
  if (!("speechSynthesis" in window) || !text) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(plain(text));
  const v = voiceFor(accent);
  u.lang = v ? v.lang : "en-US";
  if (v) u.voice = v;
  u.rate = slow ? 0.6 : 0.95;
  speechSynthesis.speak(u);
}

// Đọc lần lượt từng lượt lời (hội thoại Part 2/3/4). Giọng nam đọc trầm hơn để dễ phân biệt.
// Trả về hàm dừng. onEnd gọi khi đọc xong hoặc bị dừng.
export function speakLines(lines, { rate = 0.95, onEnd } = {}) {
  if (!("speechSynthesis" in window) || !lines?.length) {
    onEnd?.();
    return () => {};
  }
  speechSynthesis.cancel();
  let stopped = false;
  const speakers = [...new Set(lines.map((l) => l.sp || ""))];
  const finish = () => {
    if (stopped) return;
    stopped = true;
    onEnd?.();
  };
  lines.forEach((l, i) => {
    const u = new SpeechSynthesisUtterance(plain(l.text));
    const v = voiceFor(l.accent, speakers.indexOf(l.sp || ""));
    u.lang = v ? v.lang : "en-US";
    if (v) u.voice = v;
    u.rate = rate;
    u.pitch = /^M/.test(l.sp || "") ? 0.8 : 1.05;
    if (i === lines.length - 1) {
      u.onend = finish;
      u.onerror = finish;
    }
    speechSynthesis.speak(u);
  });
  return () => {
    speechSynthesis.cancel();
    finish();
  };
}

export const spk = (text, slow = false) =>
  `<button class="spk" data-say="${esc(plain(text))}"${slow ? ' data-slow="1"' : ""} aria-label="${slow ? "Nghe chậm" : "Nghe"}">${slow ? "🐢" : "🔊"}</button>`;

export function toast(text) {
  let el = document.getElementById("toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    document.body.appendChild(el);
  }
  el.textContent = text;
  el.classList.add("show");
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove("show"), 2200);
}

export function fmtDuration(sec) {
  sec = Math.max(0, Math.round(sec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const p = (n) => String(n).padStart(2, "0");
  return h ? `${h}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`;
}

export function fmtMinutes(min) {
  min = Math.round(min);
  if (min < 60) return `${min} phút`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h} giờ`;
}
