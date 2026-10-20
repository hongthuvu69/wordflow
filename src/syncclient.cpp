#include "syncclient.h"
#include "progressstore.h"

#include <QDateTime>
#include <QJsonArray>
#include <QJsonDocument>
#include <QJsonObject>
#include <QNetworkReply>
#include <QQmlEngine>
#include <QUrlQuery>

namespace {
const int kPageSize = 1000;
const int kPushBatch = 500;

QByteArray toJson(const QVariant &v)
{
    return QJsonDocument::fromVariant(v).toJson(QJsonDocument::Compact);
}
} // namespace

SyncClient::SyncClient(ProgressStore *store, QObject *parent)
    : QObject(parent)
    , m_store(store)
{
    m_url = m_store->setting("supabase_url");
    m_key = m_store->setting("supabase_key");
    m_email = m_store->setting("auth_email");
    m_userId = m_store->setting("auth_user_id");
    m_refresh = m_store->setting("auth_refresh");
    const QString last = m_store->setting("last_sync");
    m_status = last.isEmpty() ? QString() : QStringLiteral("Lần đồng bộ gần nhất: %1").arg(last);

    // Đồng bộ 15 giây sau lần chấm thẻ cuối cùng.
    m_debounce.setSingleShot(true);
    m_debounce.setInterval(15000);
    connect(&m_debounce, &QTimer::timeout, this, &SyncClient::syncNow);
    connect(m_store, &ProgressStore::progressEdited, this, [this] {
        if (configured() && signedIn())
            m_debounce.start();
    });

    if (configured() && signedIn())
        QTimer::singleShot(1500, this, &SyncClient::syncNow);
}

SyncClient *SyncClient::create(QQmlEngine *qmlEngine, QJSEngine *)
{
    auto *store = qmlEngine->singletonInstance<ProgressStore *>("WordFlow", "ProgressStore");
    return new SyncClient(store);
}

// ---------- Trạng thái ----------

void SyncClient::setStatus(const QString &text, bool ok)
{
    m_status = text;
    m_lastOk = ok;
    emit stateChanged();
}

void SyncClient::setBusy(bool busy)
{
    m_busy = busy;
    emit stateChanged();
}

QString SyncClient::errorText(int status, const QByteArray &body)
{
    if (status == 0)
        return QStringLiteral("Không kết nối được máy chủ (kiểm tra mạng / địa chỉ Supabase)");
    const QJsonObject o = QJsonDocument::fromJson(body).object();
    for (const char *k : {"error_description", "msg", "message", "error"}) {
        const QString s = o.value(QLatin1String(k)).toString();
        if (!s.isEmpty())
            return QStringLiteral("%1 (HTTP %2)").arg(s).arg(status);
    }
    return QStringLiteral("Lỗi HTTP %1").arg(status);
}

void SyncClient::fail(const QString &step, int status, const QByteArray &body)
{
    if (status == 401)
        m_access.clear(); // lần sau sẽ làm mới token
    m_pending = false;
    m_busy = false;
    setStatus(QStringLiteral("%1: %2").arg(step, errorText(status, body)), false);
}

// ---------- HTTP ----------

void SyncClient::request(const QByteArray &verb, const QString &path, const QByteArray &body,
                         const Headers &headers, bool withUserToken, Callback cb)
{
    QNetworkRequest req(QUrl(m_url + path));
    req.setTransferTimeout(20000);
    req.setRawHeader("apikey", m_key.toUtf8());
    req.setRawHeader("Authorization", "Bearer " + (withUserToken ? m_access : m_key).toUtf8());
    req.setHeader(QNetworkRequest::ContentTypeHeader, "application/json");
    for (const auto &h : headers)
        req.setRawHeader(h.first, h.second);

    QNetworkReply *reply = m_net.sendCustomRequest(req, verb, body);
    connect(reply, &QNetworkReply::finished, this, [reply, cb] {
        const int status = reply->attribute(QNetworkRequest::HttpStatusCodeAttribute).toInt();
        cb(status, reply->readAll());
        reply->deleteLater();
    });
}

// ---------- Cấu hình & đăng nhập ----------

bool SyncClient::configure(const QString &url, const QString &key)
{
    QString u = url.trimmed();
    while (u.endsWith('/'))
        u.chop(1);
    const QString k = key.trimmed();
    // http chỉ được phép cho máy chủ thử nghiệm chạy trên chính máy này.
    const bool local = u.startsWith("http://localhost") || u.startsWith("http://127.0.0.1");
    if ((!u.startsWith("https://") && !local) || k.isEmpty()) {
        setStatus(QStringLiteral("Địa chỉ phải bắt đầu bằng https:// và cần có API key"), false);
        return false;
    }
    if (u != m_url)
        signOut();
    m_url = u;
    m_key = k;
    m_store->setSetting("supabase_url", m_url, false);
    m_store->setSetting("supabase_key", m_key, false);
    setStatus(QStringLiteral("Đã lưu cấu hình máy chủ"));
    return true;
}

bool SyncClient::handleSession(const QByteArray &body)
{
    const QJsonObject o = QJsonDocument::fromJson(body).object();
    const QString access = o.value("access_token").toString();
    const QString refresh = o.value("refresh_token").toString();
    if (access.isEmpty() || refresh.isEmpty())
        return false;

    m_access = access;
    m_refresh = refresh;
    m_accessExpiry = QDateTime::currentSecsSinceEpoch() + o.value("expires_in").toInt(3600);
    const QJsonObject user = o.value("user").toObject();
    if (!user.isEmpty()) {
        m_userId = user.value("id").toString();
        m_email = user.value("email").toString();
    }
    m_store->setSetting("auth_refresh", m_refresh, false);
    m_store->setSetting("auth_user_id", m_userId, false);
    m_store->setSetting("auth_email", m_email, false);
    emit stateChanged();
    return true;
}

void SyncClient::signIn(const QString &email, const QString &password)
{
    if (!configured() || m_busy)
        return;
    setBusy(true);
    setStatus(QStringLiteral("Đang đăng nhập…"));
    const QByteArray body = toJson(QVariantMap{{"email", email.trimmed().toLower()}, {"password", password}});
    request("POST", "/auth/v1/token?grant_type=password", body, {}, false,
            [this](int status, const QByteArray &resp) {
                setBusy(false);
                if (status == 200 && handleSession(resp)) {
                    // Đăng nhập lần đầu: kéo lại toàn bộ lịch sử ôn của tài khoản này.
                    m_store->setSetting("reviews_pulled_id", "0", false);
                    setStatus(QStringLiteral("Đăng nhập thành công"));
                    syncNow();
                } else {
                    setStatus(QStringLiteral("Đăng nhập thất bại: %1").arg(errorText(status, resp)), false);
                }
            });
}

void SyncClient::signUp(const QString &email, const QString &password)
{
    if (!configured() || m_busy)
        return;
    setBusy(true);
    setStatus(QStringLiteral("Đang tạo tài khoản…"));
    const QByteArray body = toJson(QVariantMap{{"email", email.trimmed().toLower()}, {"password", password}});
    request("POST", "/auth/v1/signup", body, {}, false, [this](int status, const QByteArray &resp) {
        setBusy(false);
        if (status != 200) {
            setStatus(QStringLiteral("Tạo tài khoản thất bại: %1").arg(errorText(status, resp)), false);
        } else if (handleSession(resp)) {
            m_store->setSetting("reviews_pulled_id", "0", false);
            setStatus(QStringLiteral("Tạo tài khoản thành công"));
            syncNow();
        } else {
            setStatus(QStringLiteral("Đã tạo tài khoản. Hãy mở email để xác nhận, rồi quay lại đăng nhập."));
        }
    });
}

void SyncClient::signOut()
{
    m_debounce.stop();
    m_access.clear();
    m_refresh.clear();
    m_userId.clear();
    m_email.clear();
    m_accessExpiry = 0;
    m_store->setSetting("auth_refresh", QString(), false);
    m_store->setSetting("auth_user_id", QString(), false);
    m_store->setSetting("auth_email", QString(), false);
    setStatus(QStringLiteral("Đã đăng xuất. Dữ liệu trên máy vẫn được giữ nguyên."));
}

void SyncClient::changePassword(const QString &newPassword)
{
    if (!configured() || !signedIn() || m_busy)
        return;
    if (newPassword.size() < 6) {
        setStatus(QStringLiteral("Mật khẩu mới phải có ít nhất 6 ký tự"), false);
        return;
    }
    setBusy(true);
    setStatus(QStringLiteral("Đang đổi mật khẩu…"));
    ensureToken([this, newPassword](bool ok) {
        if (!ok)
            return;
        const QByteArray body = toJson(QVariantMap{{"password", newPassword}});
        request("PUT", "/auth/v1/user", body, {}, true, [this](int status, const QByteArray &resp) {
            m_busy = false;
            if (status == 200)
                setStatus(QStringLiteral("Đã đổi mật khẩu. Dùng mật khẩu mới để đăng nhập trên iPhone."));
            else
                setStatus(QStringLiteral("Đổi mật khẩu thất bại: %1").arg(errorText(status, resp)), false);
        });
    });
}

void SyncClient::ensureToken(std::function<void(bool)> cb)
{
    if (!m_access.isEmpty() && m_accessExpiry > QDateTime::currentSecsSinceEpoch() + 60) {
        cb(true);
        return;
    }
    const QByteArray body = toJson(QVariantMap{{"refresh_token", m_refresh}});
    request("POST", "/auth/v1/token?grant_type=refresh_token", body, {}, false,
            [this, cb](int status, const QByteArray &resp) {
                if (status == 200 && handleSession(resp)) {
                    cb(true);
                    return;
                }
                if (status == 400 || status == 401) {
                    // Refresh token hết hạn / bị thu hồi: buộc đăng nhập lại.
                    signOut();
                    m_busy = false;
                    setStatus(QStringLiteral("Phiên đăng nhập đã hết hạn, hãy đăng nhập lại"), false);
                } else {
                    fail(QStringLiteral("Làm mới đăng nhập"), status, resp);
                }
                cb(false);
            });
}

// ---------- Đồng bộ ----------

void SyncClient::syncNow()
{
    if (!configured() || !signedIn())
        return;
    if (m_busy) {
        m_pending = true;
        return;
    }
    m_debounce.stop();
    setBusy(true);
    setStatus(QStringLiteral("Đang đồng bộ…"));
    ensureToken([this](bool ok) {
        if (ok)
            pullProgress(0, {});
    });
}

void SyncClient::pullProgress(int offset, QVariantList rows)
{
    const QString path = QStringLiteral("/rest/v1/progress?select=word_id,state,ease,interval_days,reps,"
                                        "lapses,due,first_seen,last_review,updated_at"
                                        "&order=word_id&limit=%1&offset=%2")
                             .arg(kPageSize)
                             .arg(offset);
    request("GET", path, {}, {}, true, [this, offset, rows](int status, const QByteArray &resp) mutable {
        if (status != 200) {
            fail(QStringLiteral("Tải tiến độ"), status, resp);
            return;
        }
        const QVariantList page = QJsonDocument::fromJson(resp).array().toVariantList();
        rows += page;
        if (page.size() == kPageSize) {
            pullProgress(offset + kPageSize, rows);
            return;
        }

        m_store->mergeRemoteProgress(rows);

        // Đẩy lên những dòng trên máy mới hơn bản trên server (hoặc server chưa có).
        QHash<QString, qint64> remote;
        for (const QVariant &v : std::as_const(rows)) {
            const QVariantMap m = v.toMap();
            remote.insert(m.value("word_id").toString(), m.value("updated_at").toLongLong());
        }
        QVariantList toPush;
        for (const QVariant &v : m_store->progressRows()) {
            QVariantMap m = v.toMap();
            auto it = remote.constFind(m.value("word_id").toString());
            if (it == remote.constEnd() || m.value("updated_at").toLongLong() > *it) {
                m.insert("user_id", m_userId);
                toPush << m;
            }
        }
        pushProgress(toPush, 0);
    });
}

void SyncClient::pushProgress(QVariantList rows, int index)
{
    if (index >= rows.size()) {
        pushReviews();
        return;
    }
    const QVariantList batch = rows.mid(index, kPushBatch);
    request("POST", "/rest/v1/progress?on_conflict=user_id,word_id", toJson(batch),
            {{"Prefer", "resolution=merge-duplicates,return=minimal"}}, true,
            [this, rows, index](int status, const QByteArray &resp) {
                if (status < 200 || status >= 300) {
                    fail(QStringLiteral("Gửi tiến độ"), status, resp);
                    return;
                }
                pushProgress(rows, index + kPushBatch);
            });
}

void SyncClient::pushReviews()
{
    QVariantList batch = m_store->unsyncedReviews(kPushBatch);
    if (batch.isEmpty()) {
        pullReviews();
        return;
    }
    QStringList uids;
    for (QVariant &v : batch) {
        QVariantMap m = v.toMap();
        uids << m.value("uid").toString();
        m.insert("user_id", m_userId);
        v = m;
    }
    request("POST", "/rest/v1/reviews?on_conflict=uid", toJson(batch),
            {{"Prefer", "resolution=ignore-duplicates,return=minimal"}}, true,
            [this, uids](int status, const QByteArray &resp) {
                if (status < 200 || status >= 300) {
                    fail(QStringLiteral("Gửi lịch sử ôn"), status, resp);
                    return;
                }
                m_store->markReviewsSynced(uids);
                pushReviews();
            });
}

void SyncClient::pullReviews()
{
    const qint64 lastId = m_store->setting("reviews_pulled_id", "0").toLongLong();
    const QString path = QStringLiteral("/rest/v1/reviews?select=id,uid,word_id,rating,ts"
                                        "&id=gt.%1&order=id&limit=%2")
                             .arg(lastId)
                             .arg(kPageSize);
    request("GET", path, {}, {}, true, [this, lastId](int status, const QByteArray &resp) {
        if (status != 200) {
            fail(QStringLiteral("Tải lịch sử ôn"), status, resp);
            return;
        }
        const QVariantList page = QJsonDocument::fromJson(resp).array().toVariantList();
        qint64 maxId = lastId;
        for (const QVariant &v : page)
            maxId = std::max(maxId, v.toMap().value("id").toLongLong());
        m_store->insertRemoteReviews(page);
        m_store->setSetting("reviews_pulled_id", QString::number(maxId), false);
        if (page.size() == kPageSize)
            pullReviews();
        else
            finishSync();
    });
}

void SyncClient::finishSync()
{
    const QString now = QDateTime::currentDateTime().toString("HH:mm dd/MM");
    m_store->setSetting("last_sync", now, false);
    m_busy = false;
    setStatus(QStringLiteral("Đã đồng bộ lúc %1").arg(now));
    if (m_pending) {
        m_pending = false;
        syncNow();
    }
}

void SyncClient::deleteRemoteData()
{
    if (!configured() || !signedIn() || m_busy)
        return;
    setBusy(true);
    setStatus(QStringLiteral("Đang xóa dữ liệu trên máy chủ…"));
    ensureToken([this](bool ok) {
        if (!ok)
            return;
        const QString filter = QStringLiteral("?user_id=eq.%1").arg(m_userId);
        request("DELETE", "/rest/v1/reviews" + filter, {}, {}, true, [this, filter](int status, const QByteArray &resp) {
            if (status < 200 || status >= 300) {
                fail(QStringLiteral("Xóa lịch sử ôn"), status, resp);
                return;
            }
            request("DELETE", "/rest/v1/progress" + filter, {}, {}, true, [this](int status, const QByteArray &resp) {
                if (status < 200 || status >= 300) {
                    fail(QStringLiteral("Xóa tiến độ"), status, resp);
                    return;
                }
                m_store->setSetting("reviews_pulled_id", "0", false);
                m_busy = false;
                setStatus(QStringLiteral("Đã xóa dữ liệu trên máy chủ"));
            });
        });
    });
}
