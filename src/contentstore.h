#pragma once

#include <QHash>
#include <QObject>
#include <QStringList>
#include <QVariantList>
#include <QVariantMap>
#include <QtQml/qqmlregistration.h>

// Đọc bộ nội dung học (chủ đề, từ vựng, mẫu câu) từ các file JSON trong :/content/.
class ContentStore : public QObject
{
    Q_OBJECT
    QML_ELEMENT
    QML_SINGLETON

    Q_PROPERTY(QVariantList topics READ topics CONSTANT)
    Q_PROPERTY(int totalWords READ totalWords CONSTANT)

public:
    explicit ContentStore(QObject *parent = nullptr);

    QVariantList topics() const;
    int totalWords() const { return m_allIds.size(); }

    Q_INVOKABLE QVariantMap topic(const QString &topicId) const;
    Q_INVOKABLE QVariantList words(const QString &topicId) const;
    Q_INVOKABLE QVariantMap word(const QString &wordId) const;
    // Rỗng = toàn bộ từ, theo thứ tự chủ đề.
    Q_INVOKABLE QStringList wordIds(const QString &topicId = QString()) const;
    Q_INVOKABLE QVariantList phrases(const QString &topicId) const;
    // Lấy ngẫu nhiên các từ khác để làm đáp án nhiễu cho quiz.
    Q_INVOKABLE QVariantList randomWords(int count, const QString &excludeId,
                                         const QString &topicId = QString()) const;

private:
    void load();

    QVariantList m_topics;
    QHash<QString, QVariantMap> m_words;
    QHash<QString, QStringList> m_topicWords;
    QHash<QString, QVariantList> m_topicPhrases;
    QStringList m_allIds;
};
