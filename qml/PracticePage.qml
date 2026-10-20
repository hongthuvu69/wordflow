import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import "practice.js" as P

// Luyện viết: dịch câu Việt→Anh, sắp xếp từ thành câu, tự đặt câu.
Item {
    id: page

    property string topicId: ""
    property bool autoStart: false
    property string mode: "mix"

    property var items: []
    property int index: 0
    property bool checked: false
    property var picked: []
    property int correctCount: 0
    property var wrongIds: []

    readonly property bool running: items.length > 0 && index < items.length
    readonly property bool finished: items.length > 0 && index >= items.length
    readonly property var it: running ? items[index] : null
    readonly property var result: it && it.type === "translate" && checked ? P.compare(answerArea.text, it.example.en) : null

    readonly property var typeLabels: ({
        translate: "✍️ Dịch sang tiếng Anh",
        reorder: "🧩 Sắp xếp thành câu đúng",
        write: "💡 Tự đặt câu của bạn"
    })

    // Phần sắp xếp
    readonly property bool reorderDone: it && it.type === "reorder" && picked.length === it.pieces.length
    readonly property string built: it && it.type === "reorder" ? picked.map(i => it.pieces[i]).join(" ") : ""
    readonly property bool reorderCorrect: reorderDone && P.tokens(built).join(" ") === P.tokens(it.example.en).join(" ")

    function start() {
        let ids = topicId ? ContentStore.wordIds(topicId) : ProgressStore.seenIds(ContentStore.wordIds(""))
        if (ids.length < 5)
            ids = topicId ? ids : ContentStore.wordIds("").slice(0, 30)
        items = P.buildPractice(ids.map(id => ContentStore.word(id)), mode, 8)
        index = 0
        correctCount = 0
        wrongIds = []
        resetItem()
    }

    function resetItem() {
        checked = false
        picked = []
        answerArea.text = ""
    }

    function check() {
        if (!answerArea.text.trim().length) {
            statusText.show("Hãy viết câu của bạn trước nhé")
            return
        }
        checked = true
    }

    function next(ok) {
        if (ok)
            correctCount++
        else if (wrongIds.indexOf(it.word.id) < 0)
            wrongIds = wrongIds.concat([it.word.id])
        index++
        resetItem()
        scroll.contentItem.contentY = 0
    }

    function copyText(text) {
        clip.text = text
        clip.selectAll()
        clip.copy()
        statusText.show("Đã copy! Mở Claude và dán vào nhé")
    }

    Component.onCompleted: if (autoStart) start()

    TextEdit { id: clip; visible: false }

    ColumnLayout {
        anchors.fill: parent
        anchors.margins: 32
        anchors.topMargin: 24
        spacing: 14

        PageHeader {
            Layout.fillWidth: true
            showBack: page.autoStart
            title: "✍️ Luyện viết" + (page.topicId ? " · " + ContentStore.topic(page.topicId).title_vi : "")
            subtitle: page.running ? "Câu " + (page.index + 1) + "/" + page.items.length + " · Đúng " + page.correctCount
                                   : "Áp dụng từ đã học vào câu: dịch, sắp xếp, tự đặt câu."
        }

        ProgressBar {
            Layout.fillWidth: true
            visible: page.running
            from: 0
            to: Math.max(1, page.items.length)
            value: page.index
        }

        // ---------- Chọn bài ----------
        Card {
            visible: page.items.length === 0
            Layout.fillWidth: true
            implicitHeight: setupCol.implicitHeight + 48
            ColumnLayout {
                id: setupCol
                anchors.fill: parent
                anchors.margins: 24
                spacing: 12
                Text { text: "Phạm vi"; color: Theme.text; font.pixelSize: 16; font.bold: true }
                ComboBox {
                    id: scope
                    Layout.preferredWidth: 360
                    textRole: "label"
                    model: [{ label: "Các từ bạn đã học", id: "" }].concat(
                               ContentStore.topics.map(t => ({ label: t.icon + "  " + t.title_vi, id: t.id })))
                }
                Text { text: "Dạng bài"; color: Theme.text; font.pixelSize: 16; font.bold: true }
                ComboBox {
                    id: modeBox
                    Layout.preferredWidth: 360
                    textRole: "label"
                    model: [
                        { label: "🎲 Trộn các dạng", id: "mix" },
                        { label: "✍️ Dịch câu Việt → Anh", id: "translate" },
                        { label: "🧩 Sắp xếp từ thành câu", id: "reorder" },
                        { label: "💡 Tự đặt câu", id: "write" }
                    ]
                }
                Button {
                    highlighted: true
                    text: "Bắt đầu 8 câu  →"
                    onClicked: {
                        page.topicId = scope.model[scope.currentIndex].id
                        page.mode = modeBox.model[modeBox.currentIndex].id
                        page.start()
                    }
                }
                Text {
                    Layout.fillWidth: true
                    text: "Mẹo: nói câu trong đầu trước khi gõ. Sai cũng không sao, so với câu mẫu là cách học nhanh nhất."
                    color: Theme.subtext
                    font.pixelSize: 13
                    wrapMode: Text.WordWrap
                }
            }
        }
        Item { visible: page.items.length === 0; Layout.fillHeight: true }

        // ---------- Bài tập ----------
        Card {
            visible: page.running
            Layout.fillWidth: true
            Layout.fillHeight: true

            ScrollView {
                id: scroll
                anchors.fill: parent
                anchors.margins: 24
                contentWidth: availableWidth

                ColumnLayout {
                    width: scroll.availableWidth - 8
                    spacing: 12

                    Chip {
                        text: page.it ? page.typeLabels[page.it.type] : ""
                        textColor: Theme.purple
                        fill: Theme.purpleSoft
                    }

                    // Đề bài
                    Text {
                        Layout.fillWidth: true
                        text: !page.it ? ""
                              : page.it.type === "translate" ? page.it.example.vi
                              : page.it.type === "reorder" ? "Nghĩa: " + page.it.example.vi
                              : "Đặt một câu về chính bạn có dùng từ “" + page.it.word.word + "”"
                        color: Theme.text
                        font.pixelSize: page.it && page.it.type === "reorder" ? 16 : 22
                        font.bold: !(page.it && page.it.type === "reorder")
                        wrapMode: Text.WordWrap
                    }
                    Text {
                        Layout.fillWidth: true
                        visible: page.it && page.it.type !== "reorder"
                        text: page.it ? "Từ cần dùng: <b><font color='" + Theme.accent + "'>" + page.it.word.word + "</font></b> ("
                                        + page.it.word.pos + ") – " + page.it.word.meaning : ""
                        textFormat: Text.StyledText
                        color: Theme.subtext
                        font.pixelSize: 14
                        wrapMode: Text.WordWrap
                    }
                    Flow {
                        Layout.fillWidth: true
                        visible: page.it && page.it.type === "write" && !page.checked
                        spacing: 8
                        Repeater {
                            model: page.it && page.it.type === "write" ? (page.it.word.collocations || []) : []
                            Chip { required property string modelData; text: modelData }
                        }
                    }

                    // Ô nhập (dịch / tự đặt câu)
                    TextArea {
                        id: answerArea
                        Layout.fillWidth: true
                        Layout.preferredHeight: 96
                        visible: page.it && page.it.type !== "reorder" && !page.checked
                        placeholderText: page.it && page.it.type === "write"
                                         ? "Ví dụ: kể về công việc, gia đình, sở thích của bạn…" : "Viết câu tiếng Anh của bạn…"
                        wrapMode: TextEdit.Wrap
                        font.pixelSize: 17
                    }
                    RowLayout {
                        visible: page.it && page.it.type !== "reorder" && !page.checked
                        spacing: 10
                        Button {
                            highlighted: true
                            text: "Kiểm tra  (Ctrl+Enter)"
                            onClicked: page.check()
                        }
                        Button {
                            visible: page.it && page.it.type === "translate"
                            text: "Mình chịu, xem đáp án"
                            onClicked: page.checked = true
                        }
                    }

                    // ----- Kết quả dịch câu -----
                    ColumnLayout {
                        visible: page.result !== null
                        Layout.fillWidth: true
                        spacing: 8

                        Rectangle {
                            Layout.fillWidth: true
                            implicitHeight: verdictText.implicitHeight + 20
                            radius: 10
                            color: page.result && P.verdict(page.result.score).good ? Theme.goodSoft : Theme.warnSoft
                            Text {
                                id: verdictText
                                anchors.fill: parent
                                anchors.margins: 10
                                text: page.result ? "<b>" + Math.round(page.result.score * 100) + "%</b> · " + P.verdict(page.result.score).label : ""
                                textFormat: Text.StyledText
                                color: Theme.text
                                font.pixelSize: 15
                                wrapMode: Text.WordWrap
                            }
                        }
                        Text { text: "Câu của bạn:"; color: Theme.subtext; font.pixelSize: 13 }
                        Text {
                            Layout.fillWidth: true
                            text: page.result ? (page.result.user.length ? P.tokenHtml(page.result.user, page.result.userMatch, Theme.good, Theme.warn) : "<i>(bỏ trống)</i>") : ""
                            textFormat: Text.StyledText
                            font.pixelSize: 18
                            wrapMode: Text.WordWrap
                        }
                        Text { text: "Câu mẫu:"; color: Theme.subtext; font.pixelSize: 13 }
                        RowLayout {
                            Layout.fillWidth: true
                            Text {
                                Layout.fillWidth: true
                                text: page.result ? P.tokenHtml(page.result.model, page.result.modelMatch, Theme.good, Theme.accent) : ""
                                textFormat: Text.StyledText
                                font.pixelSize: 18
                                wrapMode: Text.WordWrap
                            }
                            SpeakButton { speakText: page.it && page.it.example ? page.it.example.en : "" }
                        }
                        Text {
                            text: page.it && page.result ? (P.usesWord(answerArea.text, page.it.target) ? "✅ Có dùng" : "⚠️ Chưa dùng") + " từ <b>" + page.it.target + "</b>" : ""
                            textFormat: Text.StyledText
                            color: Theme.text
                            font.pixelSize: 14
                        }
                        Text {
                            text: "<font color='" + Theme.good + "'>khớp</font> · <b><u><font color='" + Theme.accent + "'>thiếu so với mẫu</font></u></b> · <b><u><font color='" + Theme.warn + "'>khác mẫu</font></u></b>"
                            textFormat: Text.StyledText
                            font.pixelSize: 12
                        }
                    }

                    // ----- Kết quả tự đặt câu -----
                    ColumnLayout {
                        visible: page.it && page.it.type === "write" && page.checked
                        Layout.fillWidth: true
                        spacing: 8
                        Rectangle {
                            Layout.fillWidth: true
                            implicitHeight: writeCol.implicitHeight + 20
                            radius: 10
                            color: Theme.surfaceAlt
                            ColumnLayout {
                                id: writeCol
                                anchors.fill: parent
                                anchors.margins: 10
                                Text { text: "Câu của bạn:"; color: Theme.subtext; font.pixelSize: 13 }
                                Text {
                                    Layout.fillWidth: true
                                    text: answerArea.text
                                    color: Theme.text
                                    font.pixelSize: 17
                                    wrapMode: Text.WordWrap
                                }
                                Text {
                                    text: page.it && page.it.type === "write" ? (P.usesWord(answerArea.text, page.it.word.word) ? "✅ Có dùng" : "⚠️ Chưa thấy") + " từ <b>" + page.it.word.word + "</b>" : ""
                                    textFormat: Text.StyledText
                                    color: Theme.text
                                    font.pixelSize: 14
                                }
                            }
                        }
                        Text {
                            Layout.fillWidth: true
                            text: !page.it ? "" : "<b>Tự kiểm tra:</b><br>☐ Động từ đã chia đúng thì chưa? (hôm qua → quá khứ, thói quen → hiện tại đơn)<br>"
                                  + "☐ Có dùng cụm từ đi kèm tự nhiên không? <i>" + (page.it.word.collocations || []).slice(0, 3).join(", ") + "</i>"
                                  + (page.it.word.mistake ? "<br>☐ Tránh lỗi: <s>" + page.it.word.mistake.wrong + "</s> → <b>" + page.it.word.mistake.right + "</b>" : "")
                            textFormat: Text.StyledText
                            color: Theme.text
                            font.pixelSize: 14
                            wrapMode: Text.WordWrap
                        }
                        Text { text: "Câu mẫu để so sánh"; color: Theme.text; font.bold: true; font.pixelSize: 15 }
                        Repeater {
                            model: page.it && page.it.type === "write" ? page.it.word.examples : []
                            RowLayout {
                                required property var modelData
                                Layout.fillWidth: true
                                SpeakButton { speakText: modelData.en }
                                Text {
                                    Layout.fillWidth: true
                                    text: Theme.highlight(modelData.en) + "<br><font color='" + Theme.subtext + "'>" + modelData.vi + "</font>"
                                    textFormat: Text.StyledText
                                    color: Theme.text
                                    font.pixelSize: 15
                                    wrapMode: Text.WordWrap
                                }
                            }
                        }
                    }

                    // Hỏi Claude (dịch + tự đặt câu)
                    Rectangle {
                        visible: page.checked && page.it && page.it.type !== "reorder" && answerArea.text.trim().length > 0
                        Layout.fillWidth: true
                        implicitHeight: claudeCol.implicitHeight + 24
                        radius: 10
                        color: Theme.purpleSoft
                        ColumnLayout {
                            id: claudeCol
                            anchors.fill: parent
                            anchors.margins: 12
                            spacing: 8
                            Text {
                                Layout.fillWidth: true
                                text: "<b>🤖 Muốn AI chấm kỹ hơn?</b> Copy đề kèm câu của bạn, rồi dán vào Claude chat."
                                textFormat: Text.StyledText
                                color: Theme.text
                                font.pixelSize: 14
                                wrapMode: Text.WordWrap
                            }
                            RowLayout {
                                spacing: 8
                                Button {
                                    text: "📋 Copy để hỏi Claude"
                                    onClicked: page.copyText(P.claudePrompt(page.it, answerArea.text))
                                }
                                Button {
                                    text: "Mở Claude ↗"
                                    onClicked: Qt.openUrlExternally("https://claude.ai/new")
                                }
                            }
                        }
                    }

                    // ----- Sắp xếp từ -----
                    Rectangle {
                        visible: page.it && page.it.type === "reorder"
                        Layout.fillWidth: true
                        implicitHeight: Math.max(64, builtFlow.implicitHeight + 24)
                        radius: 12
                        color: "transparent"
                        border.width: 2
                        border.color: page.reorderDone ? (page.reorderCorrect ? Theme.good : Theme.bad) : Theme.border
                        Flow {
                            id: builtFlow
                            anchors.fill: parent
                            anchors.margins: 12
                            spacing: 8
                            Text {
                                visible: page.picked.length === 0
                                text: "Bấm các từ bên dưới theo đúng thứ tự…"
                                color: Theme.subtext
                                font.pixelSize: 14
                            }
                            Repeater {
                                model: page.it && page.it.type === "reorder" ? page.picked : []
                                Chip {
                                    required property int modelData
                                    required property int index
                                    text: page.it.pieces[modelData]
                                    fontSize: 17
                                    clickable: !page.reorderDone
                                    onClicked: {
                                        const p = page.picked.slice()
                                        p.splice(index, 1)
                                        page.picked = p
                                    }
                                }
                            }
                        }
                    }
                    Flow {
                        visible: page.it && page.it.type === "reorder"
                        Layout.fillWidth: true
                        spacing: 8
                        Repeater {
                            model: page.it && page.it.type === "reorder" ? page.it.pieces : []
                            Chip {
                                required property string modelData
                                required property int index
                                visible: page.picked.indexOf(index) < 0
                                text: modelData
                                fontSize: 17
                                textColor: Theme.text
                                fill: Theme.surfaceAlt
                                clickable: true
                                onClicked: page.picked = page.picked.concat([index])
                            }
                        }
                    }
                    Rectangle {
                        visible: page.reorderDone
                        Layout.fillWidth: true
                        implicitHeight: reorderRow.implicitHeight + 20
                        radius: 10
                        color: page.reorderCorrect ? Theme.goodSoft : Theme.warnSoft
                        RowLayout {
                            id: reorderRow
                            anchors.fill: parent
                            anchors.margins: 10
                            Text {
                                Layout.fillWidth: true
                                text: page.reorderCorrect ? "🎉 Chính xác!" : "💡 Chưa đúng. Câu đúng: <b>" + (page.it ? P.plain(page.it.example.en) : "") + "</b>"
                                textFormat: Text.StyledText
                                color: Theme.text
                                font.pixelSize: 15
                                wrapMode: Text.WordWrap
                            }
                            SpeakButton { speakText: page.it && page.it.example ? page.it.example.en : "" }
                        }
                    }

                    // ----- Nút điều hướng -----
                    RowLayout {
                        spacing: 10
                        visible: page.checked || page.reorderDone || (page.it && page.it.type === "reorder" && page.picked.length > 0)
                        Button {
                            visible: page.it && page.it.type === "reorder" && !page.reorderCorrect
                            text: "↺ Xếp lại"
                            onClicked: page.picked = []
                        }
                        Button {
                            visible: page.checked || page.reorderDone
                            highlighted: true
                            text: page.it && page.it.type === "reorder" ? "Tiếp  →" : "✓ Mình viết đúng"
                            onClicked: page.next(page.it.type === "reorder" ? page.reorderCorrect : true)
                        }
                        Button {
                            visible: page.checked && page.it && page.it.type !== "reorder"
                            text: "✗ Cần ôn lại"
                            onClicked: page.next(false)
                        }
                    }

                    Text {
                        id: statusText
                        visible: text.length > 0
                        color: Theme.accent
                        font.pixelSize: 14
                        function show(msg) { text = msg; statusTimer.restart() }
                        Timer { id: statusTimer; interval: 2500; onTriggered: statusText.text = "" }
                    }
                }
            }
        }

        // ---------- Kết quả ----------
        ColumnLayout {
            visible: page.finished
            Layout.fillWidth: true
            Layout.fillHeight: true
            spacing: 14
            Item { Layout.fillHeight: true }
            Text {
                Layout.alignment: Qt.AlignHCenter
                text: page.correctCount >= page.items.length * 0.7 ? "🏆" : "💪"
                font.pixelSize: 64
            }
            Text {
                Layout.alignment: Qt.AlignHCenter
                text: "Đúng " + page.correctCount + "/" + page.items.length + " câu"
                color: Theme.text
                font.pixelSize: 26
                font.bold: true
            }
            Text {
                Layout.alignment: Qt.AlignHCenter
                visible: page.wrongIds.length > 0
                text: "Cần ôn lại: " + page.wrongIds.map(id => ContentStore.word(id).word).join(", ")
                color: Theme.subtext
                font.pixelSize: 15
            }
            RowLayout {
                Layout.alignment: Qt.AlignHCenter
                spacing: 10
                Button {
                    visible: page.wrongIds.length > 0
                    highlighted: true
                    text: "🃏 Ôn lại các từ này"
                    onClicked: AppNav.startStudy(page.wrongIds, "Ôn lại sau luyện viết")
                }
                Button {
                    text: "🔁 Luyện tiếp"
                    onClicked: page.start()
                }
            }
            Item { Layout.fillHeight: true }
        }
    }

    Shortcut {
        sequence: "Ctrl+Return"
        enabled: page.StackView.status === StackView.Active && page.running && !page.checked && page.it.type !== "reorder"
        onActivated: page.check()
    }
}
