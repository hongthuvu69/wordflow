// Đồng bộ với Supabase (REST + Auth). Cùng thuật toán với src/syncclient.cpp:
// kéo progress → gộp theo updated_at → đẩy những dòng mới hơn → đẩy lượt ôn → kéo lượt ôn mới.
import { SUPABASE_URL, SUPABASE_KEY } from "./config.js";
import { progress } from "./store.js";

const PAGE = 1000;
const BATCH = 500;
const listeners = new Set();

export const sync = {
  busy: false,
  pending: false,
  status: "",
  ok: true,
  timer: null,

  get url() {
    return (progress.settings.supabaseUrl || SUPABASE_URL || "").replace(/\/+$/, "");
  },
  get key() {
    return progress.settings.supabaseKey || SUPABASE_KEY || "";
  },
  get configured() {
    return !!(this.url && this.key);
  },
  get session() {
    return progress.settings.session || null;
  },
  get signedIn() {
    return !!(this.session && this.session.refresh);
  },
  get email() {
    return this.session ? this.session.email : "";
  },

  onChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  setStatus(text, ok = true) {
    this.status = text;
    this.ok = ok;
    for (const fn of listeners) fn();
  },
  setBusy(b) {
    this.busy = b;
    for (const fn of listeners) fn();
  },

  configure(url, key) {
    url = (url || "").trim().replace(/\/+$/, "");
    key = (key || "").trim();
    // http chỉ được phép cho máy chủ thử nghiệm chạy trên chính máy này.
    const local = /^http:\/\/(localhost|127\.0\.0\.1)/.test(url);
    if ((!url.startsWith("https://") && !local) || !key) {
      this.setStatus("Địa chỉ phải bắt đầu bằng https:// và cần có API key", false);
      return false;
    }
    if (url !== this.url) this.signOut(true);
    progress.settings.supabaseUrl = url;
    progress.settings.supabaseKey = key;
    progress.saveSettings();
    this.setStatus("Đã lưu cấu hình máy chủ");
    return true;
  },

  async http(method, path, { body, headers = {}, auth = true } = {}) {
    const token = auth ? this.session.access : this.key;
    let res;
    try {
      res = await fetch(this.url + path, {
        method,
        headers: {
          apikey: this.key,
          Authorization: "Bearer " + token,
          "Content-Type": "application/json",
          ...headers,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw { status: 0, message: "Không kết nối được máy chủ (kiểm tra mạng)" };
    }
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {}
    if (!res.ok) {
      const msg = (data && (data.error_description || data.msg || data.message || data.error)) || "Lỗi";
      throw { status: res.status, message: `${msg} (HTTP ${res.status})` };
    }
    return data;
  },

  saveSession(data) {
    if (!data || !data.access_token || !data.refresh_token) return false;
    const prev = this.session || {};
    progress.settings.session = {
      access: data.access_token,
      refresh: data.refresh_token,
      expiry: Math.floor(Date.now() / 1000) + (data.expires_in || 3600),
      userId: data.user ? data.user.id : prev.userId,
      email: data.user ? data.user.email : prev.email,
    };
    progress.saveSettings();
    return true;
  },

  async signIn(email, password) {
    if (!this.configured || this.busy) return;
    this.setBusy(true);
    this.setStatus("Đang đăng nhập…");
    try {
      const data = await this.http("POST", "/auth/v1/token?grant_type=password", {
        body: { email: email.trim().toLowerCase(), password },
        auth: false,
      });
      this.saveSession(data);
      progress.settings.reviewsPulledId = 0;
      progress.saveSettings();
      this.setBusy(false);
      this.setStatus("Đăng nhập thành công");
      this.syncNow();
    } catch (e) {
      this.setBusy(false);
      this.setStatus("Đăng nhập thất bại: " + e.message, false);
    }
  },

  async signUp(email, password) {
    if (!this.configured || this.busy) return;
    this.setBusy(true);
    this.setStatus("Đang tạo tài khoản…");
    try {
      const data = await this.http("POST", "/auth/v1/signup", {
        body: { email: email.trim().toLowerCase(), password },
        auth: false,
      });
      this.setBusy(false);
      if (this.saveSession(data)) {
        progress.settings.reviewsPulledId = 0;
        progress.saveSettings();
        this.setStatus("Tạo tài khoản thành công");
        this.syncNow();
      } else {
        this.setStatus("Đã tạo tài khoản. Hãy mở email để xác nhận, rồi quay lại đăng nhập.");
      }
    } catch (e) {
      this.setBusy(false);
      this.setStatus("Tạo tài khoản thất bại: " + e.message, false);
    }
  },

  signOut(silent = false) {
    clearTimeout(this.timer);
    delete progress.settings.session;
    progress.saveSettings();
    if (!silent) this.setStatus("Đã đăng xuất. Dữ liệu trên máy vẫn được giữ nguyên.");
  },

  async ensureToken() {
    const s = this.session;
    if (s.access && s.expiry > Math.floor(Date.now() / 1000) + 60) return;
    try {
      const data = await this.http("POST", "/auth/v1/token?grant_type=refresh_token", {
        body: { refresh_token: s.refresh },
        auth: false,
      });
      this.saveSession(data);
    } catch (e) {
      if (e.status === 400 || e.status === 401) {
        this.signOut(true);
        throw { status: e.status, message: "Phiên đăng nhập đã hết hạn, hãy đăng nhập lại" };
      }
      throw e;
    }
  },

  // Đồng bộ sau 15 giây kể từ lần chấm thẻ cuối.
  schedule() {
    if (!this.configured || !this.signedIn) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.syncNow(), 15000);
  },

  async syncNow() {
    if (!this.configured || !this.signedIn) return;
    if (this.busy) {
      this.pending = true;
      return;
    }
    clearTimeout(this.timer);
    this.setBusy(true);
    this.setStatus("Đang đồng bộ…");
    try {
      await this.ensureToken();
      const userId = this.session.userId;

      // 1) Kéo toàn bộ progress (phân trang) rồi gộp.
      const remote = [];
      for (let offset = 0; ; offset += PAGE) {
        const page = await this.http(
          "GET",
          `/rest/v1/progress?select=word_id,state,ease,interval_days,reps,lapses,due,first_seen,last_review,updated_at&order=word_id&limit=${PAGE}&offset=${offset}`
        );
        remote.push(...page);
        if (page.length < PAGE) break;
      }
      progress.mergeRemote(remote);

      // 2) Đẩy các dòng trên máy mới hơn server.
      const remoteUpdated = new Map(remote.map((r) => [r.word_id, r.updated_at]));
      const toPush = [];
      for (const [word_id, row] of Object.entries(progress.rows)) {
        const ru = remoteUpdated.get(word_id);
        if (ru === undefined || row.updated_at > ru) toPush.push({ user_id: userId, word_id, ...row });
      }
      for (let i = 0; i < toPush.length; i += BATCH) {
        await this.http("POST", "/rest/v1/progress?on_conflict=user_id,word_id", {
          body: toPush.slice(i, i + BATCH),
          headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        });
      }

      // 3) Đẩy lượt ôn chưa đồng bộ.
      for (;;) {
        const batch = progress.unsyncedReviews(BATCH);
        if (!batch.length) break;
        await this.http("POST", "/rest/v1/reviews?on_conflict=uid", {
          body: batch.map(({ uid, word_id, rating, ts }) => ({ uid, user_id: userId, word_id, rating, ts })),
          headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
        });
        progress.markSynced(batch.map((r) => r.uid));
      }

      // 4) Kéo lượt ôn mới từ các thiết bị khác.
      for (;;) {
        const last = progress.settings.reviewsPulledId || 0;
        const page = await this.http(
          "GET",
          `/rest/v1/reviews?select=id,uid,word_id,rating,ts&id=gt.${last}&order=id&limit=${PAGE}`
        );
        progress.addRemoteReviews(page);
        if (page.length) progress.settings.reviewsPulledId = Math.max(last, ...page.map((r) => r.id));
        progress.saveSettings();
        if (page.length < PAGE) break;
      }

      const d = new Date();
      const p = (n) => String(n).padStart(2, "0");
      progress.settings.lastSync = `${p(d.getHours())}:${p(d.getMinutes())} ${p(d.getDate())}/${p(d.getMonth() + 1)}`;
      progress.saveSettings();
      this.setBusy(false);
      this.setStatus("Đã đồng bộ lúc " + progress.settings.lastSync);
    } catch (e) {
      if (e.status === 401 && this.session) {
        this.session.access = "";
        progress.saveSettings();
      }
      this.pending = false;
      this.setBusy(false);
      this.setStatus("Đồng bộ lỗi: " + (e.message || e), false);
      return;
    }
    if (this.pending) {
      this.pending = false;
      this.syncNow();
    }
  },

  async deleteRemoteData() {
    if (!this.configured || !this.signedIn || this.busy) return;
    this.setBusy(true);
    try {
      await this.ensureToken();
      const filter = "?user_id=eq." + this.session.userId;
      await this.http("DELETE", "/rest/v1/reviews" + filter);
      await this.http("DELETE", "/rest/v1/progress" + filter);
      progress.settings.reviewsPulledId = 0;
      progress.saveSettings();
      this.setBusy(false);
      this.setStatus("Đã xóa dữ liệu trên máy chủ");
    } catch (e) {
      this.setBusy(false);
      this.setStatus("Xóa dữ liệu lỗi: " + e.message, false);
    }
  },
};

if (progress.settings.lastSync) sync.status = "Lần đồng bộ gần nhất: " + progress.settings.lastSync;
progress.onChange((kind) => {
  if (kind === "review") sync.schedule();
});
