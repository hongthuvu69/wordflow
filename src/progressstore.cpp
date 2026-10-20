#include "progressstore.h"

#include <QDate>
#include <QDateTime>
#include <QDir>
#include <QSqlError>
#include <QSqlQuery>
#include <QStandardPaths>
#include <QUuid>
#include <algorithm>
#include <cmath>

namespace {
const char *kConnection = "wordflow";

qint64 nowSecs()
{
    return QDateTime::currentSecsSinceEpoch();
}

qint64 startOfToday()
{
    return QDate::currentDate().startOfDay().toSecsSinceEpoch();
}

void exec(QSqlQuery &q)
{
    if (!q.exec())
        qWarning() << "SQL error:" << q.lastError().text() << q.lastQuery();
}
} // namespace

ProgressStore::ProgressStore(QObject *parent)
    : QObject(parent)
{
    const QString dir = QStandardPaths::writableLocation(QStandardPaths::AppDataLocation);
    QDir().mkpath(dir);
    m_dataPath = QDir(dir).filePath("wordflow.db");

    m_db = QSqlDatabase::addDatabase("QSQLITE", kConnection);
    m_db.setDatabaseName(m_dataPath);
    if (!m_db.open()) {
        qWarning() << "Cannot open database" << m_dataPath << m_db.lastError().text();
        return;
    }

    QSqlQuery q(m_db);
    q.prepare("CREATE TABLE IF NOT EXISTS progress ("
              " word_id TEXT PRIMARY KEY,"
              " state INTEGER NOT NULL DEFAULT 0,"
              " ease REAL NOT NULL DEFAULT 2.5,"
              " interval_days REAL NOT NULL DEFAULT 0,"
              " reps INTEGER NOT NULL DEFAULT 0,"
              " lapses INTEGER NOT NULL DEFAULT 0,"
              " due INTEGER NOT NULL DEFAULT 0,"
              " first_seen INTEGER NOT NULL,"
              " last_review INTEGER NOT NULL,"
              " updated_at INTEGER NOT NULL)");
    exec(q);
    q.prepare("CREATE TABLE IF NOT EXISTS reviews ("
              " id INTEGER PRIMARY KEY AUTOINCREMENT,"
              " word_id TEXT NOT NULL,"
              " rating INTEGER NOT NULL,"
              " ts INTEGER NOT NULL)");
    exec(q);

    // Nâng cấp DB cũ: mỗi lượt ôn có uid để đồng bộ không bị trùng, synced = đã đẩy lên server.
    QStringList columns;
    q.prepare("PRAGMA table_info(reviews)");
    exec(q);
    while (q.next())
        columns << q.value(1).toString();
    if (!columns.contains("uid")) {
        q.prepare("ALTER TABLE reviews ADD COLUMN uid TEXT");
        exec(q);
        q.prepare("UPDATE reviews SET uid = lower(hex(randomblob(16))) WHERE uid IS NULL");
        exec(q);
    }
    if (!columns.contains("synced")) {
        q.prepare("ALTER TABLE reviews ADD COLUMN synced INTEGER NOT NULL DEFAULT 0");
        exec(q);
    }

    q.prepare("CREATE INDEX IF NOT EXISTS idx_reviews_ts ON reviews(ts)");
    exec(q);
    q.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_uid ON reviews(uid)");
    exec(q);
    q.prepare("CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)");
    exec(q);
}

ProgressStore::~ProgressStore()
{
    m_db.close();
    m_db = QSqlDatabase();
    QSqlDatabase::removeDatabase(kConnection);
}

QString ProgressStore::setting(const QString &key, const QString &fallback) const
{
    QSqlQuery q(m_db);
    q.prepare("SELECT value FROM settings WHERE key = ?");
    q.addBindValue(key);
    exec(q);
    return q.next() ? q.value(0).toString() : fallback;
}

void ProgressStore::setSetting(const QString &key, const QString &value, bool notify)
{
    QSqlQuery q(m_db);
    q.prepare("INSERT INTO settings(key, value) VALUES(?, ?)"
              " ON CONFLICT(key) DO UPDATE SET value = excluded.value");
    q.addBindValue(key);
    q.addBindValue(value);
    exec(q);
    if (notify)
        bump();
}

void ProgressStore::bump()
{
    ++m_revision;
    emit changed();
}

int ProgressStore::dailyNewLimit() const
{
    return setting("daily_new_limit", "15").toInt();
}

void ProgressStore::setDailyNewLimit(int limit)
{
    limit = std::clamp(limit, 1, 100);
    if (limit != dailyNewLimit())
        setSetting("daily_new_limit", QString::number(limit));
}

bool ProgressStore::autoSpeak() const
{
    return setting("auto_speak", "1") == "1";
}

void ProgressStore::setAutoSpeak(bool on)
{
    if (on != autoSpeak())
        setSetting("auto_speak", on ? "1" : "0");
}

ProgressStore::Row ProgressStore::loadRow(const QString &wordId) const
{
    QSqlQuery q(m_db);
    q.prepare("SELECT state, ease, interval_days, reps, lapses, due FROM progress WHERE word_id = ?");
    q.addBindValue(wordId);
    exec(q);
    Row r;
    if (q.next()) {
        r.state = q.value(0).toInt();
        r.ease = q.value(1).toDouble();
        r.interval = q.value(2).toDouble();
        r.reps = q.value(3).toInt();
        r.lapses = q.value(4).toInt();
        r.due = q.value(5).toLongLong();
        r.exists = true;
    }
    return r;
}

QHash<QString, ProgressStore::Row> ProgressStore::loadAll() const
{
    QHash<QString, Row> out;
    QSqlQuery q(m_db);
    q.prepare("SELECT word_id, state, ease, interval_days, reps, lapses, due FROM progress");
    exec(q);
    while (q.next()) {
        Row r;
        r.state = q.value(1).toInt();
        r.ease = q.value(2).toDouble();
        r.interval = q.value(3).toDouble();
        r.reps = q.value(4).toInt();
        r.lapses = q.value(5).toInt();
        r.due = q.value(6).toLongLong();
        r.exists = true;
        out.insert(q.value(0).toString(), r);
    }
    return out;
}

ProgressStore::Row ProgressStore::schedule(Row r, int rating, qint64 now)
{
    if (rating <= Again) {
        // Quên: học lại ngay trong buổi này, giảm độ dễ.
        if (r.reps > 0)
            ++r.lapses;
        r.reps = 0;
        r.interval = 0;
        r.ease = std::max(1.3, r.ease - 0.2);
        r.state = Learning;
        r.due = now + 60;
        return r;
    }

    double interval = 1;
    switch (rating) {
    case Hard:
        interval = r.reps == 0 ? 1 : std::max(r.interval + 1, r.interval * 1.2);
        r.ease = std::max(1.3, r.ease - 0.15);
        break;
    case Good:
        interval = r.reps == 0 ? 1 : r.reps == 1 ? 3 : r.interval * r.ease;
        break;
    default: // Easy
        interval = r.reps == 0 ? 4 : r.reps == 1 ? 6 : r.interval * r.ease * 1.3;
        r.ease += 0.15;
        break;
    }

    r.interval = std::clamp(std::round(interval), 1.0, 365.0);
    ++r.reps;
    r.state = r.interval >= 21 ? Mastered : Review;
    // Đến hạn từ đầu ngày, để buổi học nào trong ngày đó cũng thấy.
    r.due = QDate::currentDate().addDays(qint64(r.interval)).startOfDay().toSecsSinceEpoch();
    Q_UNUSED(now);
    return r;
}

QString ProgressStore::intervalLabel(const Row &r, int rating)
{
    if (rating <= Again)
        return QStringLiteral("<1 phút");
    const int days = int(r.interval);
    if (days < 30)
        return QStringLiteral("%1 ngày").arg(days);
    if (days < 365)
        return QStringLiteral("%1 tháng").arg(QString::number(days / 30.0, 'f', days < 60 ? 1 : 0));
    return QStringLiteral("1 năm");
}

void ProgressStore::review(const QString &wordId, int rating)
{
    const qint64 now = nowSecs();
    const Row before = loadRow(wordId);
    const Row r = schedule(before, rating, now);

    QSqlQuery q(m_db);
    q.prepare("INSERT INTO progress(word_id, state, ease, interval_days, reps, lapses, due,"
              " first_seen, last_review, updated_at)"
              " VALUES(:id, :state, :ease, :interval, :reps, :lapses, :due, :now, :now, :now)"
              " ON CONFLICT(word_id) DO UPDATE SET state = excluded.state, ease = excluded.ease,"
              " interval_days = excluded.interval_days, reps = excluded.reps,"
              " lapses = excluded.lapses, due = excluded.due,"
              " last_review = excluded.last_review, updated_at = excluded.updated_at");
    q.bindValue(":id", wordId);
    q.bindValue(":state", r.state);
    q.bindValue(":ease", r.ease);
    q.bindValue(":interval", r.interval);
    q.bindValue(":reps", r.reps);
    q.bindValue(":lapses", r.lapses);
    q.bindValue(":due", r.due);
    q.bindValue(":now", now);
    exec(q);

    q.prepare("INSERT INTO reviews(uid, word_id, rating, ts, synced) VALUES(?, ?, ?, ?, 0)");
    q.addBindValue(QUuid::createUuid().toString(QUuid::WithoutBraces));
    q.addBindValue(wordId);
    q.addBindValue(rating);
    q.addBindValue(now);
    exec(q);

    bump();
    emit progressEdited();
}

QStringList ProgressStore::intervalPreview(const QString &wordId) const
{
    const Row r = loadRow(wordId);
    const qint64 now = nowSecs();
    QStringList out;
    for (int rating = Again; rating <= Easy; ++rating)
        out << intervalLabel(schedule(r, rating, now), rating);
    return out;
}

QVariantMap ProgressStore::wordState(const QString &wordId) const
{
    const Row r = loadRow(wordId);
    QVariantMap m;
    m["exists"] = r.exists;
    m["state"] = r.state;
    m["interval"] = r.interval;
    m["reps"] = r.reps;
    m["lapses"] = r.lapses;
    m["due"] = r.exists && r.due <= nowSecs();
    if (r.exists) {
        const QDate dueDate = QDateTime::fromSecsSinceEpoch(r.due).date();
        const qint64 days = QDate::currentDate().daysTo(dueDate);
        m["dueText"] = days <= 0 ? QStringLiteral("hôm nay")
                       : days == 1 ? QStringLiteral("ngày mai")
                                   : QStringLiteral("%1 ngày nữa").arg(days);
    }
    return m;
}

QStringList ProgressStore::buildSession(const QStringList &candidates, int newCount) const
{
    const QHash<QString, Row> rows = loadAll();
    const qint64 now = nowSecs();

    QList<QPair<qint64, QString>> due;
    QStringList fresh;
    for (const QString &id : candidates) {
        auto it = rows.constFind(id);
        if (it == rows.constEnd()) {
            if (fresh.size() < newCount)
                fresh << id;
        } else if (it->due <= now) {
            due.append({it->due, id});
        }
    }
    std::sort(due.begin(), due.end());

    QStringList out;
    for (const auto &p : std::as_const(due))
        out << p.second;
    out << fresh;
    return out;
}

QStringList ProgressStore::seenIds(const QStringList &candidates) const
{
    const QHash<QString, Row> rows = loadAll();
    QStringList out;
    for (const QString &id : candidates)
        if (rows.contains(id))
            out << id;
    return out;
}

int ProgressStore::newRemainingToday() const
{
    QSqlQuery q(m_db);
    q.prepare("SELECT COUNT(*) FROM progress WHERE first_seen >= ?");
    q.addBindValue(startOfToday());
    exec(q);
    const int newToday = q.next() ? q.value(0).toInt() : 0;
    return std::max(0, dailyNewLimit() - newToday);
}

QVariantMap ProgressStore::stats(const QStringList &allIds) const
{
    const QHash<QString, Row> rows = loadAll();
    const qint64 now = nowSecs();
    const qint64 today = startOfToday();

    int seen = 0, mastered = 0, due = 0;
    for (const QString &id : allIds) {
        auto it = rows.constFind(id);
        if (it == rows.constEnd())
            continue;
        ++seen;
        if (it->state == Mastered)
            ++mastered;
        if (it->due <= now)
            ++due;
    }

    QSqlQuery q(m_db);
    q.prepare("SELECT COUNT(*) FROM reviews WHERE ts >= ?");
    q.addBindValue(today);
    exec(q);
    const int reviewedToday = q.next() ? q.value(0).toInt() : 0;

    q.prepare("SELECT COUNT(*) FROM progress WHERE first_seen >= ?");
    q.addBindValue(today);
    exec(q);
    const int newToday = q.next() ? q.value(0).toInt() : 0;

    // Chuỗi ngày học liên tiếp (tính cả hôm qua nếu hôm nay chưa học).
    q.prepare("SELECT DISTINCT date(ts, 'unixepoch', 'localtime') AS d FROM reviews ORDER BY d DESC");
    exec(q);
    int streak = 0;
    QDate expected = QDate::currentDate();
    bool first = true;
    while (q.next()) {
        const QDate d = QDate::fromString(q.value(0).toString(), Qt::ISODate);
        if (first && d == expected.addDays(-1))
            expected = d;
        first = false;
        if (d != expected)
            break;
        ++streak;
        expected = expected.addDays(-1);
    }

    QVariantMap m;
    m["total"] = allIds.size();
    m["seen"] = seen;
    m["mastered"] = mastered;
    m["due"] = due;
    m["reviewedToday"] = reviewedToday;
    m["newToday"] = newToday;
    m["newRemaining"] = std::min(std::max(0, dailyNewLimit() - newToday), int(allIds.size()) - seen);
    m["streak"] = streak;
    return m;
}

QVariantMap ProgressStore::topicStats(const QStringList &ids) const
{
    const QHash<QString, Row> rows = loadAll();
    const qint64 now = nowSecs();
    int seen = 0, mastered = 0, due = 0;
    for (const QString &id : ids) {
        auto it = rows.constFind(id);
        if (it == rows.constEnd())
            continue;
        ++seen;
        if (it->state == Mastered)
            ++mastered;
        if (it->due <= now)
            ++due;
    }
    QVariantMap m;
    m["total"] = ids.size();
    m["seen"] = seen;
    m["mastered"] = mastered;
    m["due"] = due;
    return m;
}

void ProgressStore::resetProgress()
{
    QSqlQuery q(m_db);
    q.prepare("DELETE FROM progress");
    exec(q);
    q.prepare("DELETE FROM reviews");
    exec(q);
    bump();
}

// ---------- Đồng bộ ----------

QVariantList ProgressStore::progressRows() const
{
    QVariantList out;
    QSqlQuery q(m_db);
    q.prepare("SELECT word_id, state, ease, interval_days, reps, lapses, due,"
              " first_seen, last_review, updated_at FROM progress");
    exec(q);
    while (q.next()) {
        QVariantMap m;
        m["word_id"] = q.value(0).toString();
        m["state"] = q.value(1).toInt();
        m["ease"] = q.value(2).toDouble();
        m["interval_days"] = q.value(3).toDouble();
        m["reps"] = q.value(4).toInt();
        m["lapses"] = q.value(5).toInt();
        m["due"] = q.value(6).toLongLong();
        m["first_seen"] = q.value(7).toLongLong();
        m["last_review"] = q.value(8).toLongLong();
        m["updated_at"] = q.value(9).toLongLong();
        out << m;
    }
    return out;
}

int ProgressStore::mergeRemoteProgress(const QVariantList &rows)
{
    QHash<QString, qint64> local;
    {
        QSqlQuery q(m_db);
        q.prepare("SELECT word_id, updated_at FROM progress");
        exec(q);
        while (q.next())
            local.insert(q.value(0).toString(), q.value(1).toLongLong());
    }

    int applied = 0;
    m_db.transaction();
    QSqlQuery q(m_db);
    q.prepare("INSERT OR REPLACE INTO progress(word_id, state, ease, interval_days, reps, lapses,"
              " due, first_seen, last_review, updated_at) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    for (const QVariant &v : rows) {
        const QVariantMap m = v.toMap();
        const QString id = m.value("word_id").toString();
        const qint64 updated = m.value("updated_at").toLongLong();
        auto it = local.constFind(id);
        if (it != local.constEnd() && *it >= updated)
            continue; // bản trên máy mới hơn hoặc bằng
        q.addBindValue(id);
        q.addBindValue(m.value("state").toInt());
        q.addBindValue(m.value("ease").toDouble());
        q.addBindValue(m.value("interval_days").toDouble());
        q.addBindValue(m.value("reps").toInt());
        q.addBindValue(m.value("lapses").toInt());
        q.addBindValue(m.value("due").toLongLong());
        q.addBindValue(m.value("first_seen").toLongLong());
        q.addBindValue(m.value("last_review").toLongLong());
        q.addBindValue(updated);
        exec(q);
        ++applied;
    }
    m_db.commit();

    if (applied > 0)
        bump();
    return applied;
}

QVariantList ProgressStore::unsyncedReviews(int limit) const
{
    QVariantList out;
    QSqlQuery q(m_db);
    q.prepare("SELECT uid, word_id, rating, ts FROM reviews WHERE synced = 0 ORDER BY id LIMIT ?");
    q.addBindValue(limit);
    exec(q);
    while (q.next()) {
        QVariantMap m;
        m["uid"] = q.value(0).toString();
        m["word_id"] = q.value(1).toString();
        m["rating"] = q.value(2).toInt();
        m["ts"] = q.value(3).toLongLong();
        out << m;
    }
    return out;
}

void ProgressStore::markReviewsSynced(const QStringList &uids)
{
    m_db.transaction();
    QSqlQuery q(m_db);
    q.prepare("UPDATE reviews SET synced = 1 WHERE uid = ?");
    for (const QString &uid : uids) {
        q.addBindValue(uid);
        exec(q);
    }
    m_db.commit();
}

int ProgressStore::insertRemoteReviews(const QVariantList &rows)
{
    int inserted = 0;
    m_db.transaction();
    QSqlQuery q(m_db);
    q.prepare("INSERT OR IGNORE INTO reviews(uid, word_id, rating, ts, synced) VALUES(?, ?, ?, ?, 1)");
    for (const QVariant &v : rows) {
        const QVariantMap m = v.toMap();
        q.addBindValue(m.value("uid").toString());
        q.addBindValue(m.value("word_id").toString());
        q.addBindValue(m.value("rating").toInt());
        q.addBindValue(m.value("ts").toLongLong());
        exec(q);
        inserted += q.numRowsAffected() > 0 ? 1 : 0;
    }
    m_db.commit();
    if (inserted > 0)
        bump();
    return inserted;
}
