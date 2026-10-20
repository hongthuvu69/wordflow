#include "speech.h"

#include <QRegularExpression>

#ifdef Q_OS_WIN
#include <windows.h>
#include <sapi.h>
#endif

Speech::Speech(QObject *parent)
    : QObject(parent)
{
#ifdef Q_OS_WIN
    const HRESULT init = CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED);
    m_comInitialized = SUCCEEDED(init);

    if (FAILED(CoCreateInstance(__uuidof(SpVoice), nullptr, CLSCTX_ALL, __uuidof(ISpVoice),
                                reinterpret_cast<void **>(&m_voice)))) {
        m_voice = nullptr;
        return;
    }

    // Chọn giọng tiếng Anh Mỹ (Language=409) nếu máy có.
    ISpObjectTokenCategory *category = nullptr;
    if (SUCCEEDED(CoCreateInstance(__uuidof(SpObjectTokenCategory), nullptr, CLSCTX_ALL,
                                   __uuidof(ISpObjectTokenCategory),
                                   reinterpret_cast<void **>(&category)))) {
        IEnumSpObjectTokens *tokens = nullptr;
        if (SUCCEEDED(category->SetId(SPCAT_VOICES, FALSE))
            && SUCCEEDED(category->EnumTokens(L"Language=409", nullptr, &tokens)) && tokens) {
            ISpObjectToken *token = nullptr;
            ULONG fetched = 0;
            if (tokens->Next(1, &token, &fetched) == S_OK && token) {
                m_voice->SetVoice(token);
                LPWSTR name = nullptr;
                if (SUCCEEDED(token->GetStringValue(nullptr, &name)) && name) {
                    m_voiceName = QString::fromWCharArray(name);
                    CoTaskMemFree(name);
                }
                token->Release();
            }
            tokens->Release();
        }
        category->Release();
    }
#endif
}

Speech::~Speech()
{
#ifdef Q_OS_WIN
    if (m_voice) {
        m_voice->Release();
        m_voice = nullptr;
    }
    if (m_comInitialized)
        CoUninitialize();
#endif
}

void Speech::speak(const QString &text, bool slow)
{
#ifdef Q_OS_WIN
    if (!m_voice)
        return;
    QString clean = text;
    clean.remove(QRegularExpression(QStringLiteral("[*_]")));
    m_voice->SetRate(slow ? -5 : -1);
    const std::wstring w = clean.toStdWString();
    m_voice->Speak(w.c_str(), SPF_ASYNC | SPF_PURGEBEFORESPEAK | SPF_IS_NOT_XML, nullptr);
#else
    Q_UNUSED(text);
    Q_UNUSED(slow);
#endif
}

void Speech::stop()
{
#ifdef Q_OS_WIN
    if (m_voice)
        m_voice->Speak(nullptr, SPF_PURGEBEFORESPEAK, nullptr);
#endif
}
