import QtQuick

Rectangle {
    id: chip

    property alias text: label.text
    property color textColor: Theme.accent
    property color fill: Theme.accentSoft
    property int fontSize: 13
    property bool clickable: false
    signal clicked()

    implicitWidth: label.implicitWidth + 20
    implicitHeight: label.implicitHeight + 8
    radius: height / 2
    color: mouse.containsMouse && clickable ? Qt.darker(fill, Theme.dark ? 0.8 : 1.06) : fill

    Text {
        id: label
        anchors.centerIn: parent
        color: chip.textColor
        font.pixelSize: chip.fontSize
        font.weight: Font.Medium
    }

    MouseArea {
        id: mouse
        anchors.fill: parent
        hoverEnabled: chip.clickable
        enabled: chip.clickable
        cursorShape: chip.clickable ? Qt.PointingHandCursor : Qt.ArrowCursor
        onClicked: chip.clicked()
    }
}
