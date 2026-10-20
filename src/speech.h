#pragma once

#include <QObject>
#include <QtQml/qqmlregistration.h>

struct ISpVoice;

// Phát âm tiếng Anh bằng giọng đọc có sẵn của Windows (SAPI).
class Speech : public QObject
{
    Q_OBJECT
    QML_ELEMENT
    QML_SINGLETON

    Q_PROPERTY(bool available READ available CONSTANT)
    Q_PROPERTY(QString voiceName READ voiceName CONSTANT)

public:
    explicit Speech(QObject *parent = nullptr);
    ~Speech() override;

    bool available() const { return m_voice != nullptr; }
    QString voiceName() const { return m_voiceName; }

    Q_INVOKABLE void speak(const QString &text, bool slow = false);
    Q_INVOKABLE void stop();

private:
    ISpVoice *m_voice = nullptr;
    QString m_voiceName;
    bool m_comInitialized = false;
};
