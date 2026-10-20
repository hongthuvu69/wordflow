import QtQuick
import QtQuick.Controls
import QtQuick.Layouts

Item {
    id: page

    ScrollView {
        id: sv
        anchors.fill: parent
        contentWidth: availableWidth

        ColumnLayout {
            width: sv.availableWidth
            spacing: 20

            Item { Layout.preferredHeight: 8 }

            PageHeader {
                Layout.fillWidth: true
                Layout.leftMargin: 32
                Layout.rightMargin: 32
                title: "Chủ đề"
                subtitle: ContentStore.topics.length + " chủ đề · " + ContentStore.totalWords + " từ · Chọn một chủ đề để học từ, làm quiz và luyện mẫu câu."
            }

            GridLayout {
                id: grid
                Layout.fillWidth: true
                Layout.leftMargin: 32
                Layout.rightMargin: 32
                columns: Math.max(1, Math.floor(width / 300))
                columnSpacing: 16
                rowSpacing: 16

                Repeater {
                    model: ContentStore.topics

                    Card {
                        id: topicCard
                        required property var modelData
                        readonly property var ts: ProgressStore.revision >= 0 ? ProgressStore.topicStats(ContentStore.wordIds(modelData.id)) : ({})

                        Layout.fillWidth: true
                        Layout.preferredWidth: 1
                        implicitHeight: 200
                        border.color: cardMouse.containsMouse ? Theme.accent : Theme.border

                        MouseArea {
                            id: cardMouse
                            anchors.fill: parent
                            hoverEnabled: true
                            cursorShape: Qt.PointingHandCursor
                            onClicked: AppNav.openTopic(topicCard.modelData.id)
                        }

                        ColumnLayout {
                            anchors.fill: parent
                            anchors.margins: 18
                            spacing: 8

                            RowLayout {
                                Layout.fillWidth: true
                                Text { text: topicCard.modelData.icon; font.pixelSize: 34 }
                                Item { Layout.fillWidth: true }
                                Chip {
                                    text: topicCard.modelData.level
                                    textColor: Theme.info
                                    fill: Theme.infoSoft
                                }
                            }
                            Text {
                                Layout.fillWidth: true
                                text: topicCard.modelData.title_vi
                                color: Theme.text
                                font.pixelSize: 18
                                font.bold: true
                                elide: Text.ElideRight
                            }
                            Text {
                                Layout.fillWidth: true
                                Layout.fillHeight: true
                                text: topicCard.modelData.description || ""
                                color: Theme.subtext
                                font.pixelSize: 13
                                wrapMode: Text.WordWrap
                                elide: Text.ElideRight
                                maximumLineCount: 2
                            }
                            ProgressBar {
                                Layout.fillWidth: true
                                from: 0
                                to: Math.max(1, topicCard.ts.total)
                                value: topicCard.ts.seen
                            }
                            RowLayout {
                                Layout.fillWidth: true
                                Text {
                                    Layout.fillWidth: true
                                    text: topicCard.ts.seen + "/" + topicCard.ts.total + " từ · " + topicCard.modelData.phraseCount + " tình huống"
                                    color: Theme.subtext
                                    font.pixelSize: 13
                                }
                                Text {
                                    visible: topicCard.ts.due > 0
                                    text: "⏰ " + topicCard.ts.due
                                    color: Theme.warn
                                    font.pixelSize: 13
                                    font.bold: true
                                }
                            }
                        }
                    }
                }
            }

            Item { Layout.preferredHeight: 24 }
        }
    }
}
