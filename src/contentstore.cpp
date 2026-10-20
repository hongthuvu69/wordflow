#include "contentstore.h"

#include <QDir>
#include <QFile>
#include <QJsonDocument>
#include <QJsonObject>
#include <QRandomGenerator>
#include <algorithm>

ContentStore::ContentStore(QObject *parent)
    : QObject(parent)
{
    load();
}

void ContentStore::load()
{
    QDir dir(":/content");
    const QStringList files = dir.entryList({"*.json"}, QDir::Files, QDir::Name);

    QList<QVariantMap> topics;
    for (const QString &name : files) {
        QFile file(dir.filePath(name));
        if (!file.open(QIODevice::ReadOnly)) {
            qWarning() << "Cannot open content file" << name;
            continue;
        }
        QJsonParseError err;
        const QJsonDocument doc = QJsonDocument::fromJson(file.readAll(), &err);
        if (err.error != QJsonParseError::NoError) {
            qWarning() << "Invalid JSON in" << name << ":" << err.errorString() << "at" << err.offset;
            continue;
        }

        QVariantMap topic = doc.object().toVariantMap();
        const QString topicId = topic.value("id").toString();

        QStringList ids;
        const QVariantList words = topic.take("words").toList();
        for (const QVariant &v : words) {
            QVariantMap w = v.toMap();
            const QString id = w.value("id").toString();
            if (id.isEmpty() || m_words.contains(id)) {
                qWarning() << "Missing or duplicate word id" << id << "in" << name;
                continue;
            }
            w.insert("topicId", topicId);
            w.insert("topicTitle", topic.value("title_vi"));
            m_words.insert(id, w);
            ids << id;
        }
        m_topicWords.insert(topicId, ids);

        const QVariantList phrases = topic.take("phrases").toList();
        m_topicPhrases.insert(topicId, phrases);

        topic.insert("wordCount", ids.size());
        topic.insert("phraseCount", phrases.size());
        topics << topic;
    }

    std::sort(topics.begin(), topics.end(), [](const QVariantMap &a, const QVariantMap &b) {
        return a.value("order").toInt() < b.value("order").toInt();
    });
    for (const QVariantMap &t : std::as_const(topics)) {
        m_topics << t;
        m_allIds << m_topicWords.value(t.value("id").toString());
    }
}

QVariantList ContentStore::topics() const
{
    return m_topics;
}

QVariantMap ContentStore::topic(const QString &topicId) const
{
    for (const QVariant &t : m_topics) {
        const QVariantMap m = t.toMap();
        if (m.value("id").toString() == topicId)
            return m;
    }
    return {};
}

QVariantList ContentStore::words(const QString &topicId) const
{
    QVariantList out;
    for (const QString &id : m_topicWords.value(topicId))
        out << m_words.value(id);
    return out;
}

QVariantMap ContentStore::word(const QString &wordId) const
{
    return m_words.value(wordId);
}

QStringList ContentStore::wordIds(const QString &topicId) const
{
    return topicId.isEmpty() ? m_allIds : m_topicWords.value(topicId);
}

QVariantList ContentStore::phrases(const QString &topicId) const
{
    return m_topicPhrases.value(topicId);
}

QVariantList ContentStore::randomWords(int count, const QString &excludeId, const QString &topicId) const
{
    QStringList pool = wordIds(topicId);
    if (pool.size() <= count)
        pool = m_allIds;
    pool.removeAll(excludeId);
    std::shuffle(pool.begin(), pool.end(), *QRandomGenerator::global());

    QVariantList out;
    for (int i = 0; i < pool.size() && out.size() < count; ++i)
        out << m_words.value(pool.at(i));
    return out;
}
