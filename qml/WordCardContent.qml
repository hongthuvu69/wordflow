import QtQuick
import QtQuick.Controls
import QtQuick.Layouts

// Toàn bộ thông tin của một từ: nghĩa, phát âm, collocations, ví dụ, cách dùng, lỗi hay gặp.
ColumnLayout {
    id: root

    property var w: ({})
    property bool showHeader: true

    spacing: 14

    // ---- Tiêu đề: từ + IPA + loa ----
    ColumnLayout {
        visible: root.showHeader
        Layout.fillWidth: true
        spacing: 6

        RowLayout {
            spacing: 10
            Text {
                text: root.w.word || ""
                color: Theme.text
                font.pixelSize: 36
                font.bold: true
            }
            Chip {
                text: root.w.pos || ""
                visible: text.length > 0
                textColor: Theme.purple
                fill: Theme.purpleSoft
            }
            Chip {
                text: root.w.level || ""
                visible: text.length > 0
                textColor: Theme.info
                fill: Theme.infoSoft
            }
        }
        RowLayout {
            spacing: 4
            Text {
                text: root.w.ipa || ""
                color: Theme.subtext
                font.pixelSize: 18
            }
            SpeakButton { speakText: root.w.word || "" }
            SpeakButton { speakText: root.w.word || ""; slow: true }
        }
    }

    // ---- Nghĩa ----
    Card {
        Layout.fillWidth: true
        implicitHeight: meaningCol.implicitHeight + 28
        color: Theme.accentSoft
        border.width: 0

        ColumnLayout {
            id: meaningCol
            anchors.fill: parent
            anchors.margins: 14
            spacing: 4
            Text {
                Layout.fillWidth: true
                text: root.w.meaning || ""
                color: Theme.text
                font.pixelSize: 22
                font.bold: true
                wrapMode: Text.WordWrap
            }
            Text {
                Layout.fillWidth: true
                visible: text.length > 0
                text: root.w.definition || ""
                color: Theme.subtext
                font.pixelSize: 15
                font.italic: true
                wrapMode: Text.WordWrap
            }
        }
    }

    // ---- Collocations ----
    ColumnLayout {
        Layout.fillWidth: true
        visible: (root.w.collocations || []).length > 0
        spacing: 8
        Text {
            text: "🔗 Cụm từ hay đi kèm (collocations)"
            color: Theme.text
            font.pixelSize: 16
            font.bold: true
        }
        Flow {
            Layout.fillWidth: true
            spacing: 8
            Repeater {
                model: root.w.collocations || []
                Chip {
                    required property string modelData
                    text: "🔊 " + modelData
                    fontSize: 14
                    clickable: true
                    onClicked: Speech.speak(modelData)
                }
            }
        }
    }

    // ---- Ví dụ ----
    ColumnLayout {
        Layout.fillWidth: true
        visible: (root.w.examples || []).length > 0
        spacing: 8
        Text {
            text: "📝 Ví dụ trong ngữ cảnh"
            color: Theme.text
            font.pixelSize: 16
            font.bold: true
        }
        Repeater {
            model: root.w.examples || []
            Card {
                id: exCard
                required property var modelData
                Layout.fillWidth: true
                implicitHeight: exRow.implicitHeight + 20
                color: Theme.surfaceAlt
                border.width: 0

                RowLayout {
                    id: exRow
                    anchors.fill: parent
                    anchors.margins: 10
                    spacing: 8
                    SpeakButton {
                        Layout.alignment: Qt.AlignTop
                        speakText: exCard.modelData.en
                    }
                    ColumnLayout {
                        Layout.fillWidth: true
                        spacing: 3
                        Text {
                            Layout.fillWidth: true
                            text: Theme.highlight(exCard.modelData.en)
                            textFormat: Text.StyledText
                            color: Theme.text
                            font.pixelSize: 16
                            wrapMode: Text.WordWrap
                        }
                        Text {
                            Layout.fillWidth: true
                            text: exCard.modelData.vi || ""
                            color: Theme.subtext
                            font.pixelSize: 14
                            wrapMode: Text.WordWrap
                        }
                    }
                    Chip {
                        Layout.alignment: Qt.AlignTop
                        visible: !!exCard.modelData.context
                        text: exCard.modelData.context || ""
                        fontSize: 12
                        textColor: Theme.subtext
                        fill: Theme.surface
                    }
                }
            }
        }
    }

    // ---- Cách dùng ----
    Card {
        Layout.fillWidth: true
        visible: !!root.w.note
        implicitHeight: noteCol.implicitHeight + 24
        color: Theme.warnSoft
        border.width: 0
        ColumnLayout {
            id: noteCol
            anchors.fill: parent
            anchors.margins: 12
            spacing: 4
            Text {
                text: "💡 Cách dùng"
                color: Theme.warn
                font.pixelSize: 15
                font.bold: true
            }
            Text {
                Layout.fillWidth: true
                text: Theme.highlight(root.w.note || "", Theme.warn)
                textFormat: Text.StyledText
                color: Theme.text
                font.pixelSize: 15
                wrapMode: Text.WordWrap
            }
        }
    }

    // ---- Lỗi người Việt hay mắc ----
    Card {
        Layout.fillWidth: true
        visible: !!root.w.mistake
        implicitHeight: mistakeCol.implicitHeight + 24
        color: Theme.badSoft
        border.width: 0
        ColumnLayout {
            id: mistakeCol
            anchors.fill: parent
            anchors.margins: 12
            spacing: 6
            Text {
                text: "⚠️ Lỗi hay gặp"
                color: Theme.bad
                font.pixelSize: 15
                font.bold: true
            }
            Text {
                Layout.fillWidth: true
                text: "❌ <s>" + (root.w.mistake ? root.w.mistake.wrong : "") + "</s>"
                textFormat: Text.StyledText
                color: Theme.bad
                font.pixelSize: 15
                wrapMode: Text.WordWrap
            }
            Text {
                Layout.fillWidth: true
                text: "✅ " + (root.w.mistake ? root.w.mistake.right : "")
                color: Theme.good
                font.pixelSize: 15
                font.bold: true
                wrapMode: Text.WordWrap
            }
            Text {
                Layout.fillWidth: true
                text: root.w.mistake ? root.w.mistake.explain : ""
                color: Theme.text
                font.pixelSize: 14
                wrapMode: Text.WordWrap
            }
        }
    }

    // ---- Đồng nghĩa / trái nghĩa ----
    Text {
        Layout.fillWidth: true
        visible: (root.w.synonyms || []).length > 0
        text: "<b>≈ Đồng nghĩa:</b> " + (root.w.synonyms || []).join(", ")
        textFormat: Text.StyledText
        color: Theme.text
        font.pixelSize: 15
        wrapMode: Text.WordWrap
    }
    Text {
        Layout.fillWidth: true
        visible: (root.w.antonyms || []).length > 0
        text: "<b>↔ Trái nghĩa:</b> " + (root.w.antonyms || []).join(", ")
        textFormat: Text.StyledText
        color: Theme.text
        font.pixelSize: 15
        wrapMode: Text.WordWrap
    }
}
