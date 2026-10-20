// Nội dung học + tiến độ (localStorage) + lịch ôn tập SM-2.
// Thuật toán và cấu trúc dữ liệu khớp với src/progressstore.cpp của app Qt để đồng bộ được.

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

export const State = { New: 0, Learning: 1, Review: 2, Mastered: 3 };
const KEEP_REVIEWS_SECONDS = 3 * 86400;

const nowSecs = () => Math.floor(Date.now() / 1000);

export function startOfDay(offsetDays = 0) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  return Math.floor(d.getTime() / 1000);
}

export function dateKey(secs) {
  const d = new Date(secs * 1000);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function uuid() {
  if (globalThis.crypto && crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// ---------------- Nội dung ----------------

export const content = {
  topics: [],
  words: new Map(),
  topicWords: new Map(),
  phrases: new Map(),
  allIds: [],

  async load() {
    const index = await (await fetch("content/index.json")).json();
    const docs = await Promise.all(index.files.map((f) => fetch("content/" + f).then((r) => r.json())));
    docs.sort((a, b) => (a.order || 0) - (b.order || 0));
    for (const t of docs) {
      const ids = [];
      for (const w of t.words || []) {
        if (!w.id || this.words.has(w.id)) continue;
        this.words.set(w.id, { ...w, topicId: t.id, topicTitle: t.title_vi });
        ids.push(w.id);
      }
      this.topicWords.set(t.id, ids);
      this.phrases.set(t.id, t.phrases || []);
      const { words, phrases, ...meta } = t;
      this.topics.push({ ...meta, wordCount: ids.length, phraseCount: (t.phrases || []).length });
      this.allIds.push(...ids);
    }
  },

  topic(id) {
    return this.topics.find((t) => t.id === id);
  },
  word(id) {
    return this.words.get(id);
  },
  wordIds(topicId) {
    return topicId ? this.topicWords.get(topicId) || [] : this.allIds;
  },
  randomWords(count, excludeId, topicId) {
    let pool = this.wordIds(topicId);
    if (pool.length <= count) pool = this.allIds;
    return shuffle(pool.filter((id) => id !== excludeId))
      .slice(0, count)
      .map((id) => this.words.get(id));
  },
};

export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------------- Tiến độ ----------------

const listeners = new Set();

export const progress = {
  rows: LS.get("wf.progress", {}), // word_id -> row (cùng cột với bảng progress)
  reviews: LS.get("wf.reviews", []), // lượt ôn gần đây + chưa đồng bộ: {uid, word_id, rating, ts, synced}
  days: new Set(LS.get("wf.days", [])), // các ngày (YYYY-MM-DD) có học, để tính chuỗi ngày
  settings: { dailyNewLimit: 15, autoSpeak: true, ...LS.get("wf.settings", {}) },

  onChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  emit(kind) {
    for (const fn of listeners) fn(kind);
  },

  saveRows() {
    LS.set("wf.progress", this.rows);
  },
  saveReviews() {
    const cutoff = nowSecs() - KEEP_REVIEWS_SECONDS;
    this.reviews = this.reviews.filter((r) => !r.synced || r.ts >= cutoff);
    LS.set("wf.reviews", this.reviews);
    LS.set("wf.days", [...this.days]);
  },
  saveSettings() {
    LS.set("wf.settings", this.settings);
  },
  setSetting(key, value) {
    this.settings[key] = value;
    this.saveSettings();
    this.emit("settings");
  },

  // ---- SM-2 (giống ProgressStore::schedule) ----
  schedule(row, rating, now) {
    const r = row
      ? { ...row }
      : { state: 0, ease: 2.5, interval_days: 0, reps: 0, lapses: 0, due: 0 };
    if (rating <= 1) {
      if (r.reps > 0) r.lapses++;
      r.reps = 0;
      r.interval_days = 0;
      r.ease = Math.max(1.3, r.ease - 0.2);
      r.state = State.Learning;
      r.due = now + 60;
      return r;
    }
    let interval;
    if (rating === 2) {
      interval = r.reps === 0 ? 1 : Math.max(r.interval_days + 1, r.interval_days * 1.2);
      r.ease = Math.max(1.3, r.ease - 0.15);
    } else if (rating === 3) {
      interval = r.reps === 0 ? 1 : r.reps === 1 ? 3 : r.interval_days * r.ease;
    } else {
      interval = r.reps === 0 ? 4 : r.reps === 1 ? 6 : r.interval_days * r.ease * 1.3;
      r.ease += 0.15;
    }
    r.interval_days = Math.min(365, Math.max(1, Math.round(interval)));
    r.reps++;
    r.state = r.interval_days >= 21 ? State.Mastered : State.Review;
    r.due = startOfDay(r.interval_days);
    return r;
  },

  intervalLabel(r, rating) {
    if (rating <= 1) return "<1 phút";
    const d = r.interval_days;
    if (d < 30) return `${d} ngày`;
    if (d < 365) return `${(d / 30).toFixed(d < 60 ? 1 : 0)} tháng`;
    return "1 năm";
  },

  intervalPreview(id) {
    const now = nowSecs();
    return [1, 2, 3, 4].map((rating) => this.intervalLabel(this.schedule(this.rows[id], rating, now), rating));
  },

  review(id, rating) {
    const now = nowSecs();
    const before = this.rows[id];
    const r = this.schedule(before, rating, now);
    r.first_seen = before ? before.first_seen : now;
    r.last_review = now;
    r.updated_at = now;
    this.rows[id] = r;
    this.reviews.push({ uid: uuid(), word_id: id, rating, ts: now, synced: false });
    this.days.add(dateKey(now));
    this.saveRows();
    this.saveReviews();
    this.emit("review");
  },

  wordState(id) {
    const r = this.rows[id];
    if (!r) return { exists: false };
    const dueDay = new Date(r.due * 1000);
    dueDay.setHours(0, 0, 0, 0);
    const days = Math.round((dueDay.getTime() / 1000 - startOfDay(0)) / 86400);
    return {
      exists: true,
      state: r.state,
      interval: r.interval_days,
      reps: r.reps,
      due: r.due <= nowSecs(),
      dueText: days <= 0 ? "hôm nay" : days === 1 ? "ngày mai" : `${days} ngày nữa`,
    };
  },

  buildSession(candidates, newCount) {
    const now = nowSecs();
    const due = [];
    const fresh = [];
    for (const id of candidates) {
      const r = this.rows[id];
      if (!r) {
        if (fresh.length < newCount) fresh.push(id);
      } else if (r.due <= now) {
        due.push([r.due, id]);
      }
    }
    due.sort((a, b) => a[0] - b[0]);
    return due.map((d) => d[1]).concat(fresh);
  },

  seenIds(candidates) {
    return candidates.filter((id) => this.rows[id]);
  },

  newToday() {
    const today = startOfDay(0);
    let n = 0;
    for (const id in this.rows) if (this.rows[id].first_seen >= today) n++;
    return n;
  },

  newRemainingToday() {
    return Math.max(0, this.settings.dailyNewLimit - this.newToday());
  },

  streak() {
    // Tính cả hôm qua nếu hôm nay chưa học (giống app Qt).
    const start = this.days.has(dateKey(startOfDay(0))) ? 0 : -1;
    let n = 0;
    while (this.days.has(dateKey(startOfDay(start - n)))) n++;
    return n;
  },

  topicStats(ids) {
    const now = nowSecs();
    let seen = 0, mastered = 0, due = 0;
    for (const id of ids) {
      const r = this.rows[id];
      if (!r) continue;
      seen++;
      if (r.state === State.Mastered) mastered++;
      if (r.due <= now) due++;
    }
    return { total: ids.length, seen, mastered, due };
  },

  stats(allIds) {
    const s = this.topicStats(allIds);
    const today = startOfDay(0);
    const newToday = this.newToday();
    return {
      ...s,
      newToday,
      newRemaining: Math.min(Math.max(0, this.settings.dailyNewLimit - newToday), s.total - s.seen),
      reviewedToday: this.reviews.filter((r) => r.ts >= today).length,
      streak: this.streak(),
    };
  },

  resetLocal() {
    this.rows = {};
    this.reviews = [];
    this.days = new Set();
    this.settings.reviewsPulledId = 0;
    this.saveRows();
    this.saveReviews();
    this.saveSettings();
    this.emit("reset");
  },

  // ---- Đồng bộ ----
  mergeRemote(rows) {
    let applied = 0;
    for (const m of rows) {
      const local = this.rows[m.word_id];
      if (local && local.updated_at >= m.updated_at) continue;
      const { word_id, user_id, ...row } = m;
      this.rows[word_id] = row;
      applied++;
    }
    if (applied) {
      this.saveRows();
      this.emit("sync");
    }
    return applied;
  },

  unsyncedReviews(limit) {
    return this.reviews.filter((r) => !r.synced).slice(0, limit);
  },

  markSynced(uids) {
    const set = new Set(uids);
    for (const r of this.reviews) if (set.has(r.uid)) r.synced = true;
    this.saveReviews();
  },

  addRemoteReviews(rows) {
    const cutoff = nowSecs() - KEEP_REVIEWS_SECONDS;
    const known = new Set(this.reviews.map((r) => r.uid));
    let added = 0;
    for (const r of rows) {
      this.days.add(dateKey(r.ts));
      if (r.ts >= cutoff && !known.has(r.uid)) {
        this.reviews.push({ uid: r.uid, word_id: r.word_id, rating: r.rating, ts: r.ts, synced: true });
        added++;
      }
    }
    this.saveReviews();
    if (rows.length) this.emit("sync");
    return added;
  },
};
