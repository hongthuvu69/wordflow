pragma Singleton
import QtQuick

// Các trang phát tín hiệu điều hướng; Main.qml lắng nghe và đổi trang.
QtObject {
    signal goTo(int index)
    signal back()
    signal openTopic(string topicId)
    signal openWord(string wordId)
    signal startStudy(var ids, string title)
    signal startQuiz(string topicId)
    signal openPhrases(string topicId)
    signal startPractice(string topicId)
}
