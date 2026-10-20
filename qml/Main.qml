import QtQuick
import QtQuick.Controls
import QtQuick.Controls.Material
import QtQuick.Layouts

ApplicationWindow {
    id: window

    width: 1180
    height: 800
    minimumWidth: 900
    minimumHeight: 620
    visible: true
    title: "WordFlow – Học từ vựng tiếng Anh"
    color: Theme.bg

    Material.theme: Theme.dark ? Material.Dark : Material.Light
    Material.accent: Theme.accent
    Material.primary: Theme.accent
    font.family: "Segoe UI"
    font.pixelSize: 15

    property int navIndex: 0

    readonly property var navItems: [
        { icon: "🏠", label: "Trang chủ" },
        { icon: "📚", label: "Chủ đề" },
        { icon: "🃏", label: "Ôn tập" },
        { icon: "🎯", label: "Quiz" },
        { icon: "💬", label: "Mẫu câu" },
        { icon: "⚙️", label: "Cài đặt" }
    ]

    function goTo(index) {
        navIndex = index
        switch (index) {
        case 0: stack.replace(null, homePage); break
        case 1: stack.replace(null, topicsPage); break
        case 2: {
            const ids = ProgressStore.buildSession(ContentStore.wordIds(""), ProgressStore.newRemainingToday())
            stack.replace(null, studyPage, { ids: ids, title: "Bài học hôm nay" })
            break
        }
        case 3: stack.replace(null, quizPage, { topicId: "", autoStart: false }); break
        case 4: stack.replace(null, phrasesPage, { topicId: "" }); break
        case 5: stack.replace(null, settingsPage); break
        }
    }

    Connections {
        target: AppNav
        function onGoTo(index) { window.goTo(index) }
        function onBack() {
            if (stack.depth > 1)
                stack.pop()
            else
                window.goTo(0)
        }
        function onOpenTopic(topicId) { stack.push(topicDetailPage, { topicId: topicId }) }
        function onOpenWord(wordId) { stack.push(wordDetailPage, { wordId: wordId }) }
        function onStartStudy(ids, title) { stack.push(studyPage, { ids: ids, title: title }) }
        function onStartQuiz(topicId) { stack.push(quizPage, { topicId: topicId, autoStart: true }) }
        function onOpenPhrases(topicId) { stack.push(phrasesPage, { topicId: topicId }) }
    }

    Component { id: homePage; HomePage {} }
    Component { id: topicsPage; TopicsPage {} }
    Component { id: topicDetailPage; TopicDetailPage {} }
    Component { id: wordDetailPage; WordDetailPage {} }
    Component { id: studyPage; StudyPage {} }
    Component { id: quizPage; QuizPage {} }
    Component { id: phrasesPage; PhrasesPage {} }
    Component { id: settingsPage; SettingsPage {} }

    Shortcut {
        sequences: [StandardKey.Back, "Backspace"]
        enabled: stack.depth > 1
        onActivated: AppNav.back()
    }

    RowLayout {
        anchors.fill: parent
        spacing: 0

        // ---------- Thanh bên ----------
        Rectangle {
            Layout.preferredWidth: 220
            Layout.fillHeight: true
            color: Theme.surface

            Rectangle {
                anchors.right: parent.right
                width: 1
                height: parent.height
                color: Theme.border
            }

            ColumnLayout {
                anchors.fill: parent
                anchors.margins: 14
                spacing: 4

                RowLayout {
                    Layout.bottomMargin: 18
                    Layout.topMargin: 6
                    spacing: 10
                    Rectangle {
                        Layout.preferredWidth: 40
                        Layout.preferredHeight: 40
                        radius: 11
                        color: Theme.accent
                        Text {
                            anchors.centerIn: parent
                            text: "W"
                            color: "white"
                            font.pixelSize: 22
                            font.bold: true
                        }
                    }
                    ColumnLayout {
                        spacing: 0
                        Text {
                            text: "WordFlow"
                            color: Theme.text
                            font.pixelSize: 19
                            font.bold: true
                        }
                        Text {
                            text: "A2 → B2"
                            color: Theme.subtext
                            font.pixelSize: 12
                        }
                    }
                }

                Repeater {
                    model: window.navItems
                    Rectangle {
                        id: navItem
                        required property var modelData
                        required property int index
                        readonly property bool active: window.navIndex === index

                        Layout.fillWidth: true
                        Layout.preferredHeight: 44
                        radius: 10
                        color: active ? Theme.accentSoft : (navMouse.containsMouse ? Theme.surfaceAlt : "transparent")

                        RowLayout {
                            anchors.fill: parent
                            anchors.leftMargin: 12
                            spacing: 12
                            Text {
                                text: navItem.modelData.icon
                                font.pixelSize: 18
                            }
                            Text {
                                Layout.fillWidth: true
                                text: navItem.modelData.label
                                color: navItem.active ? Theme.accent : Theme.text
                                font.pixelSize: 15
                                font.weight: navItem.active ? Font.DemiBold : Font.Normal
                            }
                        }
                        MouseArea {
                            id: navMouse
                            anchors.fill: parent
                            hoverEnabled: true
                            cursorShape: Qt.PointingHandCursor
                            onClicked: window.goTo(navItem.index)
                        }
                    }
                }

                Item { Layout.fillHeight: true }

                Text {
                    Layout.fillWidth: true
                    visible: Sync.signedIn
                    text: Sync.busy ? "☁️ Đang đồng bộ…" : (Sync.lastOk ? "☁️ " : "⚠️ ") + Sync.status
                    color: Sync.lastOk ? Theme.subtext : Theme.bad
                    font.pixelSize: 12
                    elide: Text.ElideRight
                    MouseArea {
                        anchors.fill: parent
                        cursorShape: Qt.PointingHandCursor
                        onClicked: window.goTo(5)
                    }
                }

                Card {
                    id: streakCard
                    Layout.fillWidth: true
                    implicitHeight: 64
                    color: Theme.warnSoft
                    border.width: 0
                    readonly property var st: ProgressStore.revision >= 0 ? ProgressStore.stats(ContentStore.wordIds("")) : ({})
                    RowLayout {
                        anchors.fill: parent
                        anchors.margins: 12
                        spacing: 10
                        Text { text: "🔥"; font.pixelSize: 26 }
                        ColumnLayout {
                            spacing: 0
                            Text {
                                text: streakCard.st.streak + " ngày liên tiếp"
                                color: Theme.text
                                font.bold: true
                                font.pixelSize: 14
                            }
                            Text {
                                text: "Hôm nay: " + streakCard.st.reviewedToday + " lượt ôn"
                                color: Theme.subtext
                                font.pixelSize: 12
                            }
                        }
                    }
                }
            }
        }

        // ---------- Nội dung ----------
        StackView {
            id: stack
            Layout.fillWidth: true
            Layout.fillHeight: true
            initialItem: homePage

            pushEnter: Transition { NumberAnimation { property: "opacity"; from: 0; to: 1; duration: 160 } }
            pushExit: Transition { NumberAnimation { property: "opacity"; from: 1; to: 0; duration: 120 } }
            popEnter: Transition { NumberAnimation { property: "opacity"; from: 0; to: 1; duration: 160 } }
            popExit: Transition { NumberAnimation { property: "opacity"; from: 1; to: 0; duration: 120 } }
            replaceEnter: Transition { NumberAnimation { property: "opacity"; from: 0; to: 1; duration: 160 } }
            replaceExit: Transition { NumberAnimation { property: "opacity"; from: 1; to: 0; duration: 120 } }
        }
    }
}
