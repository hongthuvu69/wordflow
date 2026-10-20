pragma Singleton
import QtQuick

QtObject {
    readonly property bool dark: Application.styleHints.colorScheme === Qt.ColorScheme.Dark

    readonly property color bg: dark ? "#0A0F1E" : "#F4F6FB"
    readonly property color surface: dark ? "#131A2E" : "#FFFFFF"
    readonly property color surfaceAlt: dark ? "#1B2440" : "#F0F3F9"
    readonly property color border: dark ? "#243052" : "#E5E9F2"
    readonly property color text: dark ? "#E8ECF5" : "#0F172A"
    readonly property color subtext: dark ? "#97A3BC" : "#64748B"

    readonly property color accent: dark ? "#6366F1" : "#4F46E5"
    readonly property color accentSoft: dark ? "#222A55" : "#EEF0FF"
    readonly property color good: dark ? "#4ADE80" : "#16A34A"
    readonly property color goodSoft: dark ? "#14321F" : "#DCFCE7"
    readonly property color bad: dark ? "#F87171" : "#DC2626"
    readonly property color badSoft: dark ? "#3A1A1A" : "#FEE2E2"
    readonly property color warn: dark ? "#FBBF24" : "#B45309"
    readonly property color warnSoft: dark ? "#3A2E12" : "#FEF3C7"
    readonly property color info: dark ? "#60A5FA" : "#2563EB"
    readonly property color infoSoft: dark ? "#172A46" : "#DBEAFE"
    readonly property color purple: dark ? "#C084FC" : "#7C3AED"
    readonly property color purpleSoft: dark ? "#2E1F45" : "#EDE9FE"

    readonly property int radius: 12

    // "I made a *reservation*." -> từ đích được tô đậm + màu nhấn.
    function highlight(s, color) {
        if (!s)
            return ""
        const c = color === undefined ? accent : color
        return String(s).replace(/\*(.+?)\*/g, "<b><font color='" + c + "'>$1</font></b>")
    }

    function plain(s) {
        return s ? String(s).replace(/\*/g, "") : ""
    }

    function stateLabel(st) {
        if (!st || !st.exists)
            return "Mới"
        if (st.due)
            return "Cần ôn"
        if (st.state === 3)
            return "Thành thạo"
        return "Đang học"
    }

    function stateColor(st) {
        if (!st || !st.exists)
            return info
        if (st.due)
            return warn
        if (st.state === 3)
            return good
        return accent
    }

    function stateSoft(st) {
        if (!st || !st.exists)
            return infoSoft
        if (st.due)
            return warnSoft
        if (st.state === 3)
            return goodSoft
        return accentSoft
    }

    function shuffle(arr) {
        const a = arr.slice()
        for (let i = a.length - 1; i > 0; --i) {
            const j = Math.floor(Math.random() * (i + 1))
            const t = a[i]
            a[i] = a[j]
            a[j] = t
        }
        return a
    }
}
