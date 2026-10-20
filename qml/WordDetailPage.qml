import QtQuick
import QtQuick.Controls
import QtQuick.Layouts

Item {
    id: page

    property string wordId
    readonly property var w: ContentStore.word(wordId)
    readonly property var st: ProgressStore.revision >= 0 ? ProgressStore.wordState(wordId) : ({})

    ColumnLayout {
        anchors.fill: parent
        anchors.margins: 32
        anchors.topMargin: 24
        spacing: 14

        PageHeader {
            Layout.fillWidth: true
            showBack: true
            title: page.w.topicTitle || ""
            subtitle: page.st.exists
                      ? "Trạng thái: " + Theme.stateLabel(page.st) + " · Lần ôn tiếp: " + page.st.dueText + " · Đã ôn " + page.st.reps + " lần"
                      : "Bạn chưa học từ này"

            Button {
                highlighted: true
                text: page.st.exists ? "Ôn từ này ngay" : "Học từ này"
                onClicked: AppNav.startStudy([page.wordId], page.w.word)
            }
        }

        ScrollView {
            id: sv
            Layout.fillWidth: true
            Layout.fillHeight: true
            contentWidth: availableWidth

            WordCardContent {
                width: Math.min(sv.availableWidth - 16, 860)
                w: page.w
            }
        }
    }

    Component.onCompleted: if (ProgressStore.autoSpeak) Speech.speak(w.word)
}
