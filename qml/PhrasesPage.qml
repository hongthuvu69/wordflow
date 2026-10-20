import QtQuick
import QtQuick.Controls
import QtQuick.Layouts

// Mẫu câu giao tiếp theo tình huống, mỗi tình huống có 3 sắc thái: trang trọng / bình thường / thân mật.
Item {
    id: page

    property string topicId: ""
    readonly property var topics: ContentStore.topics
    readonly property bool pushed: StackView.view ? StackView.view.depth > 1 : false

    Component.onCompleted: if (!topicId && topics.length > 0) topicId = topics[0].id

    ColumnLayout {
        anchors.fill: parent
        anchors.margins: 32
        anchors.topMargin: 24
        spacing: 16

        PageHeader {
            Layout.fillWidth: true
            showBack: page.pushed
            title: "💬 Mẫu câu giao tiếp"
            subtitle: "Cùng một ý, nói theo 3 mức độ. Nghe – nhắc lại to – rồi tự thay từ để nói câu của bạn."
        }

        Flow {
            Layout.fillWidth: true
            spacing: 8
            Repeater {
                model: page.topics
                Chip {
                    required property var modelData
                    text: modelData.icon + "  " + modelData.title_vi
                    fontSize: 14
                    clickable: true
                    textColor: modelData.id === page.topicId ? "white" : Theme.text
                    fill: modelData.id === page.topicId ? Theme.accent : Theme.surfaceAlt
                    onClicked: page.topicId = modelData.id
                }
            }
        }

        ListView {
            id: list
            Layout.fillWidth: true
            Layout.fillHeight: true
            clip: true
            spacing: 14
            model: ContentStore.phrases(page.topicId)
            ScrollBar.vertical: ScrollBar {}

            delegate: Card {
                id: phraseCard
                required property var modelData
                required property int index
                width: list.width - 14
                implicitHeight: phraseCol.implicitHeight + 32

                ColumnLayout {
                    id: phraseCol
                    anchors.fill: parent
                    anchors.margins: 16
                    spacing: 10

                    RowLayout {
                        Layout.fillWidth: true
                        spacing: 10
                        Text {
                            text: (phraseCard.index + 1) + ". " + phraseCard.modelData.situation_vi
                            color: Theme.text
                            font.pixelSize: 18
                            font.bold: true
                        }
                        Text {
                            Layout.fillWidth: true
                            text: phraseCard.modelData.situation
                            color: Theme.subtext
                            font.pixelSize: 14
                            font.italic: true
                            elide: Text.ElideRight
                        }
                    }

                    Repeater {
                        model: [
                            { key: "formal", label: "Trang trọng", color: Theme.info, soft: Theme.infoSoft },
                            { key: "neutral", label: "Bình thường", color: Theme.accent, soft: Theme.accentSoft },
                            { key: "casual", label: "Thân mật", color: Theme.warn, soft: Theme.warnSoft }
                        ]
                        RowLayout {
                            id: regRow
                            required property var modelData
                            readonly property string sentence: phraseCard.modelData[modelData.key] || ""
                            visible: sentence.length > 0
                            Layout.fillWidth: true
                            spacing: 10
                            Chip {
                                Layout.preferredWidth: 104
                                text: regRow.modelData.label
                                textColor: regRow.modelData.color
                                fill: regRow.modelData.soft
                                fontSize: 12
                            }
                            Text {
                                Layout.fillWidth: true
                                text: regRow.sentence
                                color: Theme.text
                                font.pixelSize: 16
                                wrapMode: Text.WordWrap
                            }
                            SpeakButton { speakText: regRow.sentence; size: 30 }
                            SpeakButton { speakText: regRow.sentence; slow: true; size: 30 }
                        }
                    }

                    Text {
                        Layout.fillWidth: true
                        text: "Nghĩa: " + (phraseCard.modelData.vi || "")
                        color: Theme.subtext
                        font.pixelSize: 14
                        wrapMode: Text.WordWrap
                    }

                    Rectangle {
                        visible: !!phraseCard.modelData.reply
                        Layout.fillWidth: true
                        implicitHeight: replyRow.implicitHeight + 16
                        radius: 8
                        color: Theme.surfaceAlt
                        RowLayout {
                            id: replyRow
                            anchors.fill: parent
                            anchors.margins: 8
                            spacing: 8
                            Text {
                                Layout.fillWidth: true
                                text: "↩️ <b>Người kia có thể đáp:</b> " + (phraseCard.modelData.reply || "")
                                textFormat: Text.StyledText
                                color: Theme.text
                                font.pixelSize: 14
                                wrapMode: Text.WordWrap
                            }
                            SpeakButton { speakText: phraseCard.modelData.reply || ""; size: 28 }
                        }
                    }

                    Text {
                        Layout.fillWidth: true
                        visible: !!phraseCard.modelData.note
                        text: "💡 " + (phraseCard.modelData.note || "")
                        color: Theme.warn
                        font.pixelSize: 14
                        wrapMode: Text.WordWrap
                    }
                }
            }
        }
    }
}
