import QtQuick
import QtQuick.Layouts

Card {
    id: root

    property string icon
    property string value
    property string label
    property color tint: Theme.accent
    property color tintSoft: Theme.accentSoft

    implicitHeight: 96
    Layout.fillWidth: true

    RowLayout {
        anchors.fill: parent
        anchors.margins: 16
        spacing: 14

        Rectangle {
            Layout.preferredWidth: 46
            Layout.preferredHeight: 46
            radius: 12
            color: root.tintSoft
            Text {
                anchors.centerIn: parent
                text: root.icon
                font.pixelSize: 22
            }
        }

        ColumnLayout {
            Layout.fillWidth: true
            spacing: 2
            Text {
                text: root.value
                color: Theme.text
                font.pixelSize: 26
                font.bold: true
            }
            Text {
                Layout.fillWidth: true
                text: root.label
                color: Theme.subtext
                font.pixelSize: 13
                elide: Text.ElideRight
            }
        }
    }
}
