#pragma once

#include <QObject>
#include <QSqlDatabase>
#include <QStringList>
#include <QVariantMap>
#include <QtQml/qqmlregistration.h>

// Lưu tiến độ học (SQLite) và lập lịch ôn tập theo thuật toán lặp lại ngắt quãng (biến thể SM-2).
// Mỗi dòng có updated_at để sau này đồng bộ với Supabase.
class ProgressStore : public QObject
{
    Q_OBJECT
    QML_ELEMENT
    QML_SINGLETON

    // Tăng mỗi khi dữ liệu thay đổi; QML dùng để tính lại các binding.
    Q_PROPERTY(int revision READ revision NOTIFY changed)
    Q_PROPERTY(int dailyNewLimit READ dailyNewLimit WRITE setDailyNewLimit NOTIFY changed)
    Q_PROPERTY(bool autoSpeak READ autoSpeak WRITE setAutoSpeak NOTIFY changed)
    Q_PROPERTY(QString dataPath READ dataPath CONSTANT)

public:
    enum State { New = 0, Learning = 1, Review = 2, Mastered = 3 };
    Q_ENUM(State)

    enum Rating { Again = 1, Hard = 2, Good = 3, Easy = 4 };
    Q_ENUM(Rating)

    explicit ProgressStore(QObject *parent = nullptr);
    ~ProgressStore() override;

    int revision() const { return m_revision; }
    int dailyNewLimit() const;
    void setDailyNewLimit(int limit);
    bool autoSpeak() const;
    void setAutoSpeak(bool on);
    QString dataPath() const { return m_dataPath; }

    Q_INVOKABLE void review(const QString &wordId, int rating);
    Q_INVOKABLE QStringList intervalPreview(const QString &wordId) const;
    Q_INVOKABLE QVariantMap wordState(const QString &wordId) const;

    // Từ cần ôn (đến hạn) trước, sau đó tới tối đa newCount từ mới theo thứ tự trong candidates.
    Q_INVOKABLE QStringList buildSession(const QStringList &candidates, int newCount) const;
    Q_INVOKABLE QStringList seenIds(const QStringList &candidates) const;
    Q_INVOKABLE int newRemainingToday() const;

    Q_INVOKABLE QVariantMap stats(const QStringList &allIds) const;
    Q_INVOKABLE QVariantMap topicStats(const QStringList &ids) const;

    Q_INVOKABLE void resetProgress();

    QString setting(const QString &key, const QString &fallback = QString()) const;
    // notify = false: lưu mà không làm QML tính lại (dùng cho dữ liệu nội bộ của đồng bộ).
    void setSetting(const QString &key, const QString &value, bool notify = true);

    // ---- Đồng bộ (SyncClient dùng) ----
    QVariantList progressRows() const;
    // Ghi đè các dòng mà bản từ server mới hơn (updated_at lớn hơn). Trả về số dòng đã áp dụng.
    int mergeRemoteProgress(const QVariantList &rows);
    QVariantList unsyncedReviews(int limit) const;
    void markReviewsSynced(const QStringList &uids);
    int insertRemoteReviews(const QVariantList &rows);

signals:
    void changed();
    // Người dùng vừa chấm một thẻ (khác changed(): không phát khi đổi cài đặt).
    void progressEdited();

private:
    struct Row {
        int state = New;
        double ease = 2.5;
        double interval = 0;
        int reps = 0;
        int lapses = 0;
        qint64 due = 0;
        bool exists = false;
    };

    Row loadRow(const QString &wordId) const;
    QHash<QString, Row> loadAll() const;
    static Row schedule(Row row, int rating, qint64 now);
    static QString intervalLabel(const Row &row, int rating);
    void bump();

    QSqlDatabase m_db;
    QString m_dataPath;
    int m_revision = 0;
};
