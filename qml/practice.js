.pragma library
// Luyện viết: chấm câu bằng cách so từng từ với câu mẫu. Bản web tương ứng: docs/js/practice.js.

var CONTRACTIONS = {
    "i'm": "i am", "you're": "you are", "he's": "he is", "she's": "she is", "it's": "it is",
    "we're": "we are", "they're": "they are", "i've": "i have", "you've": "you have",
    "we've": "we have", "they've": "they have", "i'll": "i will", "you'll": "you will",
    "we'll": "we will", "they'll": "they will", "i'd": "i would", "don't": "do not",
    "doesn't": "does not", "didn't": "did not", "can't": "cannot", "won't": "will not",
    "isn't": "is not", "aren't": "are not", "wasn't": "was not", "weren't": "were not",
    "haven't": "have not", "hasn't": "has not", "let's": "let us", "that's": "that is",
    "what's": "what is", "there's": "there is", "couldn't": "could not",
    "shouldn't": "should not", "wouldn't": "would not", "how's": "how is"
}

var IRREGULAR = {
    was: "be", were: "be", been: "be", am: "be", is: "be", are: "be", went: "go", gone: "go",
    woke: "wake", woken: "wake", took: "take", taken: "take", made: "make", got: "get", gotten: "get",
    gave: "give", given: "give", came: "come", saw: "see", seen: "see", ate: "eat", eaten: "eat",
    drank: "drink", drunk: "drink", bought: "buy", brought: "bring", thought: "think", taught: "teach",
    caught: "catch", spent: "spend", lent: "lend", left: "leave", felt: "feel", kept: "keep", slept: "sleep",
    met: "meet", paid: "pay", said: "say", told: "tell", sold: "sell", found: "find", had: "have", has: "have",
    did: "do", done: "do", does: "do", knew: "know", known: "know", wrote: "write", written: "write",
    forgot: "forget", forgotten: "forget", forgave: "forgive", forgiven: "forgive", began: "begin", begun: "begin",
    chose: "choose", chosen: "choose", broke: "break", broken: "break", spoke: "speak", spoken: "speak",
    understood: "understand", stood: "stand", sat: "sit", ran: "run", won: "win", lost: "lose", hung: "hang",
    heard: "hear", read: "read", built: "build", sent: "send", fell: "fall", fallen: "fall", drove: "drive",
    driven: "drive", rode: "ride", flew: "fly", flown: "fly", grew: "grow", grown: "grow", threw: "throw",
    wore: "wear", worn: "wear", froze: "freeze", frozen: "freeze", led: "lead", meant: "mean", fed: "feed",
    hurt: "hurt", quit: "quit", cut: "cut", put: "put", set: "set", cost: "cost", let: "let"
}

function plain(s) {
    return s ? String(s).replace(/\*/g, "") : ""
}

function tokens(s) {
    var out = []
    var words = plain(s).toLowerCase().replace(/[‘’`´]/g, "'").replace(/[^a-z0-9' ]+/g, " ").split(/\s+/)
    for (var i = 0; i < words.length; ++i) {
        var t = words[i].replace(/^'+|'+$/g, "")
        if (!t)
            continue
        var parts = (CONTRACTIONS[t] || t).split(" ")
        for (var k = 0; k < parts.length; ++k)
            out.push(parts[k])
    }
    return out
}

function lcs(a, b) {
    var n = a.length, m = b.length, i, j
    var dp = []
    for (i = 0; i <= n; ++i) {
        dp.push([])
        for (j = 0; j <= m; ++j)
            dp[i].push(0)
    }
    for (i = n - 1; i >= 0; --i)
        for (j = m - 1; j >= 0; --j)
            dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
    var aMatch = a.map(function () { return false })
    var bMatch = b.map(function () { return false })
    i = 0; j = 0
    while (i < n && j < m) {
        if (a[i] === b[j]) { aMatch[i] = true; bMatch[j] = true; ++i; ++j }
        else if (dp[i + 1][j] >= dp[i][j + 1]) ++i
        else ++j
    }
    return { length: dp[0][0], aMatch: aMatch, bMatch: bMatch }
}

function compare(user, model) {
    var u = tokens(user), m = tokens(model)
    if (!u.length)
        return { score: 0, user: u, model: m, userMatch: [], modelMatch: m.map(function () { return false }) }
    var r = lcs(u, m)
    return { score: 2 * r.length / (u.length + m.length), user: u, model: m, userMatch: r.aMatch, modelMatch: r.bMatch }
}

function usesWord(sentence, target) {
    function base(w) { return IRREGULAR[w] || w }
    function stem(w) { return w.length > 4 ? w.slice(0, Math.max(4, w.length - 2)) : w }
    var s = tokens(sentence).map(base)
    var t = tokens(target).map(base)
    for (var i = 0; i < t.length; ++i) {
        var found = false
        for (var j = 0; j < s.length && !found; ++j)
            found = s[j] === t[i] || s[j].indexOf(stem(t[i])) === 0
        if (!found)
            return false
    }
    return true
}

function verdict(score) {
    if (score >= 0.9) return { label: "Rất tốt! Gần như giống câu mẫu", good: true }
    if (score >= 0.65) return { label: "Khá gần! Xem chỗ khác biệt bên dưới", good: false }
    return { label: "Khác câu mẫu khá nhiều. Câu của bạn vẫn có thể đúng, hãy tự so sánh", good: false }
}

function shuffle(arr) {
    var a = arr.slice()
    for (var i = a.length - 1; i > 0; --i) {
        var j = Math.floor(Math.random() * (i + 1))
        var t = a[i]; a[i] = a[j]; a[j] = t
    }
    return a
}

function usableExamples(w) {
    return (w.examples || []).filter(function (e) {
        return (e.en.match(/\*/g) || []).length === 2 && e.vi
    })
}

function scramble(sentence) {
    var parts = plain(sentence).split(/\s+/).filter(function (p) { return p.length > 0 })
    if (parts.length < 2)
        return parts
    for (var attempt = 0; attempt < 10; ++attempt) {
        var s = shuffle(parts)
        if (s.join(" ") !== parts.join(" "))
            return s
    }
    return parts.slice().reverse()
}

// mode: "mix" | "translate" | "reorder" | "write"
function buildPractice(words, mode, count) {
    var items = []
    var writes = 0
    var list = shuffle(words)
    for (var i = 0; i < list.length && items.length < count; ++i) {
        var w = list[i]
        var exs = usableExamples(w)
        var type = mode
        if (mode === "mix") {
            var r = Math.random()
            type = r < 0.45 ? "translate" : r < 0.8 ? "reorder" : "write"
            if (type === "write" && writes >= 2)
                type = "translate"
        }
        if ((type === "translate" || type === "reorder") && !exs.length)
            type = "write"
        var ex = exs.length ? exs[Math.floor(Math.random() * exs.length)] : null
        if (type === "reorder") {
            var n = plain(ex.en).split(/\s+/).length
            if (n < 4 || n > 14)
                type = "translate"
        }
        if (type === "write")
            ++writes
        var mark = ex ? ex.en.match(/\*(.+?)\*/) : null
        items.push({
            type: type, word: w, example: ex,
            target: mark ? mark[1] : w.word,
            pieces: type === "reorder" ? scramble(ex.en) : []
        })
    }
    return items
}

function claudePrompt(item, answer) {
    var w = item.word
    var task = item.type === "translate"
            ? "Đề: dịch sang tiếng Anh câu \"" + item.example.vi + "\""
            : "Đề: tự đặt một câu tiếng Anh có dùng từ \"" + w.word + "\""
    return [
        "Bạn là giáo viên tiếng Anh của mình (trình độ hiện tại A2, mục tiêu B2). Hãy chấm câu mình viết.",
        "Từ cần luyện: \"" + w.word + "\" (" + w.pos + "), nghĩa: " + w.meaning,
        task,
        "Câu của mình: \"" + String(answer).trim() + "\"",
        "",
        "Trả lời ngắn gọn bằng tiếng Việt:",
        "1. Câu đúng hay sai ngữ pháp? Dùng từ \"" + w.word + "\" đã tự nhiên chưa?",
        "2. Sửa lỗi (nếu có) và giải thích ngắn gọn.",
        "3. Gợi ý 1–2 cách nói tự nhiên hơn như người bản xứ.",
        "4. Chấm điểm trên thang 10."
    ].join("\n")
}

// Tô màu từng từ cho Text.StyledText.
// Từ khớp: màu okColor; từ không khớp: in đậm, gạch chân, màu badColor.
function tokenHtml(words, matches, okColor, badColor) {
    var out = []
    for (var i = 0; i < words.length; ++i) {
        var w = words[i].replace(/&/g, "&amp;").replace(/</g, "&lt;")
        out.push(matches[i] ? "<font color='" + okColor + "'>" + w + "</font>"
                            : "<b><u><font color='" + badColor + "'>" + w + "</font></u></b>")
    }
    return out.join(" ")
}
