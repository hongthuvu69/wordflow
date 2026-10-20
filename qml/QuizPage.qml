import QtQuick
import QtQuick.Controls
import QtQuick.Controls.Material
import QtQuick.Layouts

// Quiz 10 câu, trộn 5 dạng: nghĩa, ngược, điền từ, nghe, chọn câu đúng.
Item {
    id: page

    property string topicId: ""
    property bool autoStart: false

    property var questions: []
    property int index: 0
    property int score: 0
    property int chosen: -1
    property var wrongIds: []
    readonly property bool active: StackView.status === StackView.Active
    readonly property bool running: questions.length > 0 && index < questions.length
    readonly property bool finished: questions.length > 0 && index >= questions.length
    readonly property var q: running ? questions[index] : null

    readonly property var typeLabels: ({
        meaning: "Chọn nghĩa đúng",
        reverse: "Chọn từ tiếng Anh đúng",
        cloze: "Điền từ vào chỗ trống (từ trong câu có thể đã chia dạng)",
        listen: "Nghe và chọn từ",
        mistake: "Câu nào đúng?"
    })

    function makeQuestion(w, scopeTopic) {
        const types = ["meaning", "reverse", "listen"]
        // Chỉ dùng câu có đúng một cụm được đánh dấu (bỏ qua "*wake* me *up*").
        const clozeable = (w.examples || []).filter(e => (e.en.match(/\*/g) || []).length === 2)
        if (clozeable.length > 0)
            types.push("cloze", "cloze")
        if (w.mistake)
            types.push("mistake")
        const type = types[Math.floor(Math.random() * types.length)]
        const others = ContentStore.randomWords(3, w.id, scopeTopic)

        if (type === "mistake") {
            const opts = Theme.shuffle([w.mistake.right, w.mistake.wrong])
            return { type: type, wordId: w.id, prompt: "Chọn câu đúng ngữ pháp / cách dùng:", sub: "Từ: " + w.word,
                     options: opts, correct: opts.indexOf(w.mistake.right), explain: w.mistake.explain, speak: w.mistake.right }
        }

        let prompt = "", sub = "", options = [], correctText = "", explain = "", speak = ""
        if (type === "meaning") {
            prompt = w.word
            sub = w.ipa
            correctText = w.meaning
            options = [w.meaning].concat(others.map(o => o.meaning))
            explain = w.word + " = " + w.meaning
            speak = w.word
        } else if (type === "reverse") {
            prompt = w.meaning
            sub = w.definition || ""
            correctText = w.word
            options = [w.word].concat(others.map(o => o.word))
            explain = w.meaning + " = " + w.word + "  " + w.ipa
            speak = w.word
        } else if (type === "listen") {
            prompt = "Bạn nghe thấy từ nào? (bấm loa để nghe lại)"
            sub = ""
            correctText = w.word
            options = [w.word].concat(others.map(o => o.word))
            explain = w.word + "  " + w.ipa + " – " + w.meaning
            speak = w.word
        } else {
            const ex = clozeable[Math.floor(Math.random() * clozeable.length)]
            prompt = ex.en.replace(/\*(.+?)\*/, "_____")
            sub = ex.vi || ""
            correctText = w.word
            options = [w.word].concat(others.map(o => o.word))
            explain = Theme.plain(ex.en)
            speak = Theme.plain(ex.en)
        }
        options = Theme.shuffle(options)
        return { type: type, wordId: w.id, prompt: prompt, sub: sub, options: options,
                 correct: options.indexOf(correctText), explain: explain, speak: speak }
    }

    function start() {
        let pool
        if (topicId) {
            pool = ContentStore.wordIds(topicId)
        } else {
            pool = ProgressStore.seenIds(ContentStore.wordIds(""))
            if (pool.length < 6)
                pool = ContentStore.wordIds("")
        }
        pool = Theme.shuffle(pool).slice(0, 10)
        const qs = []
        for (const id of pool)
            qs.push(makeQuestion(ContentStore.word(id), topicId))
        questions = qs
        index = 0
        score = 0
        chosen = -1
        wrongIds = []
        playIfListen()
    }

    function playIfListen() {
        if (running && q.type === "listen")
            Speech.speak(q.speak)
    }

    function choose(i) {
        if (!running || chosen >= 0 || i >= q.options.length)
            return
        chosen = i
        if (i === q.correct) {
            score++
        } else {
            const w = wrongIds.slice()
            if (w.indexOf(q.wordId) < 0)
                w.push(q.wordId)
            wrongIds = w
        }
        if (q.type !== "listen")
            Speech.speak(q.speak)
    }

    function next() {
        if (chosen < 0)
            return
        chosen = -1
        index++
        playIfListen()
    }

    Component.onCompleted: if (autoStart) start()

    Shortcut { sequence: "1"; enabled: page.active && page.running; onActivated: page.choose(0) }
    Shortcut { sequence: "2"; enabled: page.active && page.running; onActivated: page.choose(1) }
    Shortcut { sequence: "3"; enabled: page.active && page.running; onActivated: page.choose(2) }
    Shortcut { sequence: "4"; enabled: page.active && page.running; onActivated: page.choose(3) }
    Shortcut { sequences: ["Return", "Space"]; enabled: page.active && page.running && page.chosen >= 0; onActivated: page.next() }

    ColumnLayout {
        anchors.fill: parent
        anchors.margins: 32
        anchors.topMargin: 24
        spacing: 16

        PageHeader {
            Layout.fillWidth: true
            showBack: page.autoStart
            title: "🎯 Quiz" + (page.topicId ? " · " + ContentStore.topic(page.topicId).title_vi : "")
            subtitle: page.running ? "Câu " + (page.index + 1) + "/" + page.questions.length + " · Đúng " + page.score
                                   : "Kiểm tra nhanh 10 câu: nghĩa, điền từ, nghe, chọn câu đúng."
        }

        ProgressBar {
            Layout.fillWidth: true
            visible: page.running
            from: 0
            to: Math.max(1, page.questions.length)
            value: page.index
        }

        // ---------- Chọn phạm vi ----------
        Card {
            visible: page.questions.length === 0
            Layout.fillWidth: true
            implicitHeight: setupCol.implicitHeight + 48

            ColumnLayout {
                id: setupCol
                anchors.fill: parent
                anchors.margins: 24
                spacing: 14
                Text {
                    text: "Chọn phạm vi"
                    color: Theme.text
                    font.pixelSize: 18
                    font.bold: true
                }
                ComboBox {
                    id: scope
                    Layout.preferredWidth: 360
                    textRole: "label"
                    model: [{ label: "Tất cả từ đã học", id: "" }].concat(
                               ContentStore.topics.map(t => ({ label: t.icon + "  " + t.title_vi, id: t.id })))
                }
                Text {
                    text: "Nếu bạn học chưa đủ 6 từ, quiz sẽ lấy từ toàn bộ kho từ."
                    color: Theme.subtext
                    font.pixelSize: 13
                }
                Button {
                    highlighted: true
                    text: "Bắt đầu  →"
                    onClicked: {
                        page.topicId = scope.model[scope.currentIndex].id
                        page.start()
                    }
                }
            }
        }

        Item {
            visible: page.questions.length === 0
            Layout.fillHeight: true
        }

        // ---------- Câu hỏi ----------
        Card {
            visible: page.running
            Layout.fillWidth: true
            Layout.fillHeight: true

            ColumnLayout {
                anchors.fill: parent
                anchors.margins: 28
                spacing: 14

                Chip {
                    text: page.q ? page.typeLabels[page.q.type] : ""
                    textColor: Theme.purple
                    fill: Theme.purpleSoft
                }

                RowLayout {
                    Layout.fillWidth: true
                    Text {
                        Layout.fillWidth: true
                        text: page.q ? page.q.prompt : ""
                        color: Theme.text
                        font.pixelSize: page.q && (page.q.type === "meaning") ? 40 : 24
                        font.bold: true
                        wrapMode: Text.WordWrap
                    }
                    SpeakButton {
                        visible: page.q && (page.q.type === "listen" || page.q.type === "meaning")
                        speakText: page.q ? page.q.speak : ""
                        size: 48
                    }
                }
                Text {
                    Layout.fillWidth: true
                    visible: text.length > 0
                    text: page.q ? page.q.sub : ""
                    color: Theme.subtext
                    font.pixelSize: 16
                    wrapMode: Text.WordWrap
                }

                Item { Layout.preferredHeight: 6 }

                Repeater {
                    model: page.q ? page.q.options : []
                    Rectangle {
                        id: opt
                        required property string modelData
                        required property int index
                        readonly property bool isCorrect: page.q && index === page.q.correct
                        readonly property bool isChosen: index === page.chosen
                        readonly property bool answered: page.chosen >= 0

                        Layout.fillWidth: true
                        implicitHeight: Math.max(54, optText.implicitHeight + 24)
                        radius: 10
                        color: answered && isCorrect ? Theme.goodSoft
                             : answered && isChosen ? Theme.badSoft
                             : optMouse.containsMouse ? Theme.surfaceAlt : Theme.surface
                        border.width: 2
                        border.color: answered && isCorrect ? Theme.good
                                    : answered && isChosen ? Theme.bad
                                    : Theme.border

                        RowLayout {
                            anchors.fill: parent
                            anchors.leftMargin: 14
                            anchors.rightMargin: 14
                            spacing: 14
                            Rectangle {
                                Layout.preferredWidth: 28
                                Layout.preferredHeight: 28
                                radius: 8
                                color: Theme.surfaceAlt
                                Text {
                                    anchors.centerIn: parent
                                    text: opt.index + 1
                                    color: Theme.subtext
                                    font.bold: true
                                }
                            }
                            Text {
                                id: optText
                                Layout.fillWidth: true
                                text: opt.modelData
                                color: Theme.text
                                font.pixelSize: 17
                                wrapMode: Text.WordWrap
                            }
                            Text {
                                visible: opt.answered && (opt.isCorrect || opt.isChosen)
                                text: opt.isCorrect ? "✅" : "❌"
                                font.pixelSize: 18
                            }
                        }
                        MouseArea {
                            id: optMouse
                            anchors.fill: parent
                            hoverEnabled: true
                            cursorShape: opt.answered ? Qt.ArrowCursor : Qt.PointingHandCursor
                            onClicked: page.choose(opt.index)
                        }
                    }
                }

                // Giải thích sau khi trả lời
                Card {
                    visible: page.chosen >= 0
                    Layout.fillWidth: true
                    implicitHeight: explainRow.implicitHeight + 24
                    color: page.q && page.chosen === page.q.correct ? Theme.goodSoft : Theme.warnSoft
                    border.width: 0
                    RowLayout {
                        id: explainRow
                        anchors.fill: parent
                        anchors.margins: 12
                        spacing: 10
                        Text {
                            text: page.q && page.chosen === page.q.correct ? "🎉" : "💡"
                            font.pixelSize: 22
                        }
                        Text {
                            Layout.fillWidth: true
                            text: page.q ? page.q.explain : ""
                            color: Theme.text
                            font.pixelSize: 15
                            wrapMode: Text.WordWrap
                        }
                        SpeakButton { speakText: page.q ? page.q.speak : "" }
                    }
                }

                Item { Layout.fillHeight: true }

                RowLayout {
                    Layout.fillWidth: true
                    Text {
                        Layout.fillWidth: true
                        text: "Phím tắt: 1–4 để chọn, Enter để sang câu tiếp"
                        color: Theme.subtext
                        font.pixelSize: 13
                    }
                    Button {
                        highlighted: true
                        enabled: page.chosen >= 0
                        focusPolicy: Qt.NoFocus
                        text: page.index + 1 < page.questions.length ? "Câu tiếp  →" : "Xem kết quả"
                        onClicked: page.next()
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
                text: page.score >= page.questions.length * 0.8 ? "🏆" : page.score >= page.questions.length * 0.5 ? "👍" : "💪"
                font.pixelSize: 64
            }
            Text {
                Layout.alignment: Qt.AlignHCenter
                text: "Đúng " + page.score + "/" + page.questions.length + " câu"
                color: Theme.text
                font.pixelSize: 26
                font.bold: true
            }
            Text {
                Layout.alignment: Qt.AlignHCenter
                visible: page.wrongIds.length > 0
                text: "Từ cần xem lại: " + page.wrongIds.map(id => ContentStore.word(id).word).join(", ")
                color: Theme.subtext
                font.pixelSize: 15
            }
            RowLayout {
                Layout.alignment: Qt.AlignHCenter
                spacing: 10
                Button {
                    visible: page.wrongIds.length > 0
                    highlighted: true
                    text: "🃏 Ôn lại các từ sai"
                    onClicked: AppNav.startStudy(page.wrongIds, "Ôn lại từ sai")
                }
                Button {
                    text: "🔁 Làm quiz mới"
                    onClicked: page.start()
                }
                Button {
                    text: "Về trang chủ"
                    onClicked: AppNav.goTo(0)
                }
            }
            Item { Layout.fillHeight: true }
        }
    }
}
