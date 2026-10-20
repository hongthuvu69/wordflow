import QtQuick
import QtQuick.Controls

// Nút loa: bấm để nghe câu/từ. slow = đọc chậm.
ToolButton {
    id: btn

    property string speakText
    property bool slow: false
    property int size: 34

    text: slow ? "🐢" : "🔊"
    font.pixelSize: size * 0.5
    implicitWidth: size
    implicitHeight: size
    padding: 0
    focusPolicy: Qt.NoFocus
    enabled: Speech.available
    onClicked: Speech.speak(speakText, slow)

    ToolTip.visible: hovered
    ToolTip.delay: 600
    ToolTip.text: slow ? "Nghe chậm" : "Nghe phát âm"
}
