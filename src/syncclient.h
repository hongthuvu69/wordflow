#pragma once

#include <QNetworkAccessManager>
#include <QObject>
#include <QTimer>
#include <QVariantList>
#include <QtQml/qqmlregistration.h>
#include <functional>

class ProgressStore;
class QQmlEngine;
class QJSEngine;

// Đồng bộ tiến độ học với Supabase (REST API + Auth bằng email/mật khẩu).
// Quy tắc gộp: mỗi từ lấy bản có updated_at mới nhất; lịch sử ôn gộp theo uid.
class SyncClient : public QObject
{
    Q_OBJECT
    QML_NAMED_ELEMENT(Sync)
    QML_SINGLETON

    Q_PROPERTY(bool configured READ configured NOTIFY stateChanged)
    Q_PROPERTY(QString serverUrl READ serverUrl NOTIFY stateChanged)
    Q_PROPERTY(bool signedIn READ signedIn NOTIFY stateChanged)
    Q_PROPERTY(QString email READ email NOTIFY stateChanged)
    Q_PROPERTY(bool busy READ busy NOTIFY stateChanged)
    Q_PROPERTY(QString status READ status NOTIFY stateChanged)
    Q_PROPERTY(bool lastOk READ lastOk NOTIFY stateChanged)

public:
    explicit SyncClient(ProgressStore *store, QObject *parent = nullptr);
    static SyncClient *create(QQmlEngine *qmlEngine, QJSEngine *jsEngine);

    bool configured() const { return !m_url.isEmpty() && !m_key.isEmpty(); }
    QString serverUrl() const { return m_url; }
    bool signedIn() const { return !m_refresh.isEmpty(); }
    QString email() const { return m_email; }
    bool busy() const { return m_busy; }
    QString status() const { return m_status; }
    bool lastOk() const { return m_lastOk; }

    Q_INVOKABLE bool configure(const QString &url, const QString &key);
    Q_INVOKABLE void signIn(const QString &email, const QString &password);
    Q_INVOKABLE void signUp(const QString &email, const QString &password);
    Q_INVOKABLE void signOut();
    // Đặt mật khẩu mới bằng phiên đăng nhập hiện tại (không cần mật khẩu cũ).
    Q_INVOKABLE void changePassword(const QString &newPassword);
    Q_INVOKABLE void syncNow();
    Q_INVOKABLE void deleteRemoteData();

signals:
    void stateChanged();

private:
    using Callback = std::function<void(int status, const QByteArray &body)>;
    using Headers = QList<QPair<QByteArray, QByteArray>>;

    void request(const QByteArray &verb, const QString &path, const QByteArray &body,
                 const Headers &headers, bool withUserToken, Callback cb);
    void ensureToken(std::function<void(bool ok)> cb);
    bool handleSession(const QByteArray &body);
    void setStatus(const QString &text, bool ok = true);
    void setBusy(bool busy);
    void fail(const QString &step, int status, const QByteArray &body);
    static QString errorText(int status, const QByteArray &body);

    void pullProgress(int offset, QVariantList rows);
    void pushProgress(QVariantList rows, int index);
    void pushReviews();
    void pullReviews();
    void finishSync();

    ProgressStore *m_store;
    QNetworkAccessManager m_net;
    QTimer m_debounce;

    QString m_url;
    QString m_key;
    QString m_email;
    QString m_userId;
    QString m_refresh;
    QString m_access;
    qint64 m_accessExpiry = 0;

    bool m_busy = false;
    bool m_pending = false;
    bool m_lastOk = true;
    QString m_status;
};
