import QtQuick
import QtQuick.Controls
import QtQuick.Layouts

RowLayout {
    id: root

    property string title
    property string subtitle
    property bool showBack: false
    default property alias extras: extraRow.data

    spacing: 12

    ToolButton {
        visible: root.showBack
        text: "←"
        font.pixelSize: 22
        focusPolicy: Qt.NoFocus
        onClicked: AppNav.back()
    }

    ColumnLayout {
        Layout.fillWidth: true
        spacing: 2
        Text {
            Layout.fillWidth: true
            text: root.title
            color: Theme.text
            font.pixelSize: 26
            font.bold: true
            elide: Text.ElideRight
        }
        Text {
            Layout.fillWidth: true
            visible: root.subtitle.length > 0
            text: root.subtitle
            color: Theme.subtext
            font.pixelSize: 14
            elide: Text.ElideRight
        }
    }

    RowLayout {
        id: extraRow
        spacing: 8
    }
}
