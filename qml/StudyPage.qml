import QtQuick
import QtQuick.Controls
import QtQuick.Controls.Material
import QtQuick.Layouts

// Buổi học flashcard: xem từ → nhớ nghĩa → lật thẻ → tự chấm (1–4).
Item {
    id: page

    property var ids: []
    property string title: "Ôn tập"

    property var queue: []
    property int total: 0
    property int done: 0
    property var current: null
    property bool revealed: false
    property var previews: []
    property var counts: [0, 0, 0, 0]
    readonly property bool active: StackView.status === StackView.Active
    readonly property bool finished: total > 0 && queue.length === 0

    function showNext() {
        if (queue.length === 0) {
            current = null
            return
        }
        current = ContentStore.word(queue[0])
        previews = ProgressStore.intervalPreview(queue[0])
        revealed = false
        if (ProgressStore.autoSpeak)
            Speech.speak(current.word)
    }

    function reveal() {
        if (current && !revealed)
            revealed = true
    }

    function rate(r) {
        if (!current || !revealed)
            return
        const id = queue[0]
        ProgressStore.review(id, r)
        const c = counts.slice()
        c[r - 1]++
        counts = c

        const q = queue.slice(1)
        if (r === 1)
            q.splice(Math.min(q.length, 3), 0, id) // gặp lại sau ~3 thẻ
        else
            done++
        queue = q
        showNext()
    }

    Component.onCompleted: {
        queue = ids.slice()
        total = queue.length
        showNext()
    }

    Shortcut { sequence: "Space"; enabled: page.active && !page.revealed; onActivated: page.reveal() }
    Shortcut { sequence: "Return"; enabled: page.active && !page.revealed; onActivated: page.reveal() }
    Shortcut { sequence: "1"; enabled: page.active && page.revealed; onActivated: page.rate(1) }
    Shortcut { sequence: "2"; enabled: page.active && page.revealed; onActivated: page.rate(2) }
    Shortcut { sequence: "3"; enabled: page.active && page.revealed; onActivated: page.rate(3) }
    Shortcut { sequence: "4"; enabled: page.active && page.revealed; onActivated: page.rate(4) }
    Shortcut { sequence: "R"; enabled: page.active && !!page.current; onActivated: Speech.speak(page.current.word) }

    ColumnLayout {
        anchors.fill: parent
        anchors.margins: 32
        anchors.topMargin: 24
        spacing: 16

        PageHeader {
            Layout.fillWidth: true
            showBack: true
            title: page.title
            subtitle: page.total > 0 ? "Đã xong " + page.done + "/" + page.total + " · còn " + page.queue.length + " thẻ trong hàng đợi" : ""
        }

        ProgressBar {
            Layout.fillWidth: true
            visible: page.total > 0
            from: 0
            to: Math.max(1, page.total)
            value: page.done
        }

        // ---------- Không có gì để học ----------
        ColumnLayout {
            visible: page.total === 0
            Layout.fillWidth: true
            Layout.fillHeight: true
            spacing: 14
            Item { Layout.fillHeight: true }
            Text {
                Layout.alignment: Qt.AlignHCenter
                text: "🎉"
                font.pixelSize: 64
            }
            Text {
                Layout.alignment: Qt.AlignHCenter
                text: "Hôm nay không còn từ nào cần học!"
                color: Theme.text
                font.pixelSize: 22
                font.bold: true
            }
            Text {
                Layout.alignment: Qt.AlignHCenter
                text: "Bạn đã đạt giới hạn từ mới trong ngày. Có thể học thêm, nhưng ôn đều quan trọng hơn học nhiều."
                color: Theme.subtext
                font.pixelSize: 15
            }
            RowLayout {
                Layout.alignment: Qt.AlignHCenter
                spacing: 10
                Button {
                    highlighted: true
                    text: "Học thêm 5 từ mới"
                    onClicked: {
                        const more = ProgressStore.buildSession(ContentStore.wordIds(""), 5)
                        if (more.length > 0) {
                            page.queue = more
                            page.total = more.length
                            page.done = 0
                            page.showNext()
                        }
                    }
                }
                Button {
                    text: "🎯 Làm Quiz"
                    onClicked: AppNav.goTo(3)
                }
            }
            Item { Layout.fillHeight: true }
        }

        // ---------- Hoàn thành ----------
        ColumnLayout {
            visible: page.finished
            Layout.fillWidth: true
            Layout.fillHeight: true
            spacing: 14
            Item { Layout.fillHeight: true }
            Text {
                Layout.alignment: Qt.AlignHCenter
                text: "🏁"
                font.pixelSize: 64
            }
            Text {
                Layout.alignment: Qt.AlignHCenter
                text: "Hoàn thành " + page.total + " thẻ!"
                color: Theme.text
                font.pixelSize: 24
                font.bold: true
            }
            RowLayout {
                Layout.alignment: Qt.AlignHCenter
                spacing: 10
                Chip { text: "Quên: " + page.counts[0]; textColor: Theme.bad; fill: Theme.badSoft }
                Chip { text: "Khó: " + page.counts[1]; textColor: Theme.warn; fill: Theme.warnSoft }
                Chip { text: "Nhớ: " + page.counts[2]; textColor: Theme.accent; fill: Theme.accentSoft }
                Chip { text: "Dễ: " + page.counts[3]; textColor: Theme.good; fill: Theme.goodSoft }
            }
            Text {
                Layout.alignment: Qt.AlignHCenter
                text: "Mẹo: làm Quiz ngay sau khi học giúp nhớ lâu hơn nhiều."
                color: Theme.subtext
                font.pixelSize: 15
            }
            RowLayout {
                Layout.alignment: Qt.AlignHCenter
                spacing: 10
                Button {
                    highlighted: true
                    text: "🎯 Làm Quiz"
                    onClicked: AppNav.startQuiz("")
                }
                Button {
                    text: "Về trang chủ"
                    onClicked: AppNav.goTo(0)
                }
            }
            Item { Layout.fillHeight: true }
        }

        // ---------- Thẻ học ----------
        Card {
            visible: !!page.current && !page.finished
            Layout.fillWidth: true
            Layout.fillHeight: true

            // Mặt trước
            ColumnLayout {
                visible: !page.revealed
                anchors.centerIn: parent
                width: parent.width - 64
                spacing: 12

                Chip {
                    Layout.alignment: Qt.AlignHCenter
                    text: page.current ? page.current.topicTitle : ""
                    textColor: Theme.subtext
                    fill: Theme.surfaceAlt
                }
                Text {
                    Layout.alignment: Qt.AlignHCenter
                    text: page.current ? page.current.word : ""
                    color: Theme.text
                    font.pixelSize: 54
                    font.bold: true
                }
                Text {
                    Layout.alignment: Qt.AlignHCenter
                    text: page.current ? page.current.ipa + "  ·  " + page.current.pos : ""
                    color: Theme.subtext
                    font.pixelSize: 20
                }
                RowLayout {
                    Layout.alignment: Qt.AlignHCenter
                    SpeakButton { speakText: page.current ? page.current.word : ""; size: 44 }
                    SpeakButton { speakText: page.current ? page.current.word : ""; slow: true; size: 44 }
                }
                Text {
                    Layout.alignment: Qt.AlignHCenter
                    Layout.topMargin: 20
                    text: "Bạn có nhớ nghĩa và cách dùng từ này không? Hãy thử nói một câu với nó."
                    color: Theme.subtext
                    font.pixelSize: 15
                }
                Button {
                    Layout.alignment: Qt.AlignHCenter
                    highlighted: true
                    text: "Hiện đáp án  (Space)"
                    font.pixelSize: 16
                    implicitHeight: 52
                    leftPadding: 30
                    rightPadding: 30
                    focusPolicy: Qt.NoFocus
                    onClicked: page.reveal()
                }
            }

            // Mặt sau
            ColumnLayout {
                visible: page.revealed
                anchors.fill: parent
                anchors.margins: 20
                spacing: 12

                ScrollView {
                    id: backScroll
                    Layout.fillWidth: true
                    Layout.fillHeight: true
                    contentWidth: availableWidth
                    WordCardContent {
                        width: backScroll.availableWidth - 12
                        w: page.current || ({})
                    }
                }

                Text {
                    Layout.alignment: Qt.AlignHCenter
                    text: "Bạn nhớ từ này tới mức nào?"
                    color: Theme.subtext
                    font.pixelSize: 14
                }

                RowLayout {
                    Layout.fillWidth: true
                    spacing: 10
                    Repeater {
                        model: [
                            // Màu đậm cố định để chữ trắng luôn dễ đọc ở cả nền sáng lẫn tối.
                            { label: "Quên", key: 1, color: "#DC2626" },
                            { label: "Khó", key: 2, color: "#D97706" },
                            { label: "Nhớ", key: 3, color: "#0F9D8A" },
                            { label: "Dễ", key: 4, color: "#16A34A" }
                        ]
                        Rectangle {
                            id: rateBtn
                            required property var modelData
                            Layout.fillWidth: true
                            implicitHeight: 62
                            radius: 12
                            color: rateMouse.pressed ? Qt.darker(modelData.color, 1.2)
                                 : rateMouse.containsMouse ? Qt.darker(modelData.color, 1.08) : modelData.color

                            ColumnLayout {
                                anchors.centerIn: parent
                                spacing: 1
                                Text {
                                    Layout.alignment: Qt.AlignHCenter
                                    text: rateBtn.modelData.label + "  (" + rateBtn.modelData.key + ")"
                                    color: "white"
                                    font.pixelSize: 16
                                    font.bold: true
                                }
                                Text {
                                    Layout.alignment: Qt.AlignHCenter
                                    text: page.previews[rateBtn.modelData.key - 1] || ""
                                    color: "white"
                                    opacity: 0.85
                                    font.pixelSize: 13
                                }
                            }
                            MouseArea {
                                id: rateMouse
                                anchors.fill: parent
                                hoverEnabled: true
                                cursorShape: Qt.PointingHandCursor
                                onClicked: page.rate(rateBtn.modelData.key)
                            }
                        }
                    }
                }
            }
        }
    }
}
