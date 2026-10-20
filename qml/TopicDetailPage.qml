import QtQuick
import QtQuick.Controls
import QtQuick.Layouts

Item {
    id: page

    property string topicId
    readonly property var topic: ContentStore.topic(topicId)
    readonly property var ids: ContentStore.wordIds(topicId)
    readonly property var ts: ProgressStore.revision >= 0 ? ProgressStore.topicStats(ids) : ({})

    ColumnLayout {
        anchors.fill: parent
        anchors.margins: 32
        anchors.topMargin: 24
        spacing: 18

        PageHeader {
            Layout.fillWidth: true
            showBack: true
            title: (page.topic.icon || "") + "  " + (page.topic.title_vi || "")
            subtitle: (page.topic.title || "") + " · " + page.ts.seen + "/" + page.ts.total + " từ đã học · " + page.ts.mastered + " thành thạo"
        }

        RowLayout {
            Layout.fillWidth: true
            spacing: 10

            Button {
                highlighted: true
                text: "🃏  Học chủ đề này"
                onClicked: {
                    const sess = ProgressStore.buildSession(page.ids, 10)
                    AppNav.startStudy(sess, page.topic.title_vi)
                }
            }
            Button {
                text: "🎯  Quiz"
                onClicked: AppNav.startQuiz(page.topicId)
            }
            Button {
                text: "✍️  Luyện viết"
                onClicked: AppNav.startPractice(page.topicId)
            }
            Button {
                text: "💬  Mẫu câu (" + (page.topic.phraseCount || 0) + ")"
                onClicked: AppNav.openPhrases(page.topicId)
            }
            Item { Layout.fillWidth: true }
            TextField {
                id: filter
                Layout.preferredWidth: 220
                placeholderText: "🔍 Tìm từ…"
            }
        }

        Card {
            Layout.fillWidth: true
            Layout.fillHeight: true

            ListView {
                id: list
                anchors.fill: parent
                anchors.margins: 6
                clip: true
                spacing: 2
                model: {
                    const q = filter.text.trim().toLowerCase()
                    const all = ContentStore.words(page.topicId)
                    if (!q)
                        return all
                    return all.filter(w => w.word.toLowerCase().indexOf(q) >= 0 || w.meaning.toLowerCase().indexOf(q) >= 0)
                }
                ScrollBar.vertical: ScrollBar {}

                delegate: Rectangle {
                    id: row
                    required property var modelData
                    required property int index
                    readonly property var st: ProgressStore.revision >= 0 ? ProgressStore.wordState(modelData.id) : ({})

                    width: list.width
                    height: 58
                    radius: 8
                    color: rowMouse.containsMouse ? Theme.surfaceAlt : "transparent"

                    RowLayout {
                        anchors.fill: parent
                        anchors.leftMargin: 14
                        anchors.rightMargin: 14
                        spacing: 14

                        Text {
                            Layout.preferredWidth: 28
                            text: row.index + 1
                            color: Theme.subtext
                            font.pixelSize: 13
                        }
                        SpeakButton { speakText: row.modelData.word; size: 30 }
                        ColumnLayout {
                            Layout.preferredWidth: 240
                            spacing: 0
                            Text {
                                text: row.modelData.word
                                color: Theme.text
                                font.pixelSize: 17
                                font.bold: true
                            }
                            Text {
                                text: row.modelData.ipa + "  ·  " + row.modelData.pos
                                color: Theme.subtext
                                font.pixelSize: 12
                            }
                        }
                        Text {
                            Layout.fillWidth: true
                            text: row.modelData.meaning
                            color: Theme.text
                            font.pixelSize: 15
                            elide: Text.ElideRight
                        }
                        Chip {
                            text: Theme.stateLabel(row.st)
                            textColor: Theme.stateColor(row.st)
                            fill: Theme.stateSoft(row.st)
                            fontSize: 12
                        }
                    }

                    MouseArea {
                        id: rowMouse
                        anchors.fill: parent
                        anchors.leftMargin: 90
                        hoverEnabled: true
                        cursorShape: Qt.PointingHandCursor
                        onClicked: AppNav.openWord(row.modelData.id)
                    }
                }
            }
        }
    }
}
