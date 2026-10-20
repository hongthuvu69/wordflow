import QtQuick
import QtQuick.Controls
import QtQuick.Controls.Material
import QtQuick.Layouts

Item {
    id: page

    readonly property var stats: ProgressStore.revision >= 0 ? ProgressStore.stats(ContentStore.wordIds("")) : ({})
    readonly property int sessionNew: Math.max(0, stats.newRemaining)
    readonly property int sessionTotal: stats.due + sessionNew

    // Mẫu câu của ngày: chọn theo ngày để cả ngày giữ nguyên.
    readonly property var tip: {
        const all = []
        for (const t of ContentStore.topics)
            for (const p of ContentStore.phrases(t.id))
                all.push(p)
        if (all.length === 0)
            return null
        const day = Math.floor(Date.now() / 86400000)
        return all[day % all.length]
    }

    function startToday() {
        const ids = ProgressStore.buildSession(ContentStore.wordIds(""), ProgressStore.newRemainingToday())
        AppNav.startStudy(ids, "Bài học hôm nay")
    }

    ScrollView {
        id: sv
        anchors.fill: parent
        contentWidth: availableWidth

        ColumnLayout {
            width: sv.availableWidth
            spacing: 20

            Item { Layout.preferredHeight: 8 }

            PageHeader {
                Layout.fillWidth: true
                Layout.leftMargin: 32
                Layout.rightMargin: 32
                title: "Chào bạn 👋"
                subtitle: new Date().toLocaleDateString(Qt.locale("vi_VN"), "dddd, dd/MM/yyyy") + " · Mỗi ngày một chút, đều đặn là lên B2."
            }

            // ---------- Bài học hôm nay ----------
            Card {
                Layout.fillWidth: true
                Layout.leftMargin: 32
                Layout.rightMargin: 32
                implicitHeight: 150
                color: Theme.accent
                border.width: 0

                RowLayout {
                    anchors.fill: parent
                    anchors.margins: 24
                    spacing: 20

                    ColumnLayout {
                        Layout.fillWidth: true
                        spacing: 6
                        Text {
                            text: "Bài học hôm nay"
                            color: "white"
                            opacity: 0.85
                            font.pixelSize: 15
                        }
                        Text {
                            Layout.fillWidth: true
                            text: page.sessionTotal > 0
                                  ? page.stats.due + " từ cần ôn  +  " + page.sessionNew + " từ mới"
                                  : "Xong hết rồi! 🎉"
                            color: "white"
                            font.pixelSize: 28
                            font.bold: true
                            wrapMode: Text.WordWrap
                        }
                        Text {
                            Layout.fillWidth: true
                            text: page.sessionTotal > 0
                                  ? "Khoảng " + Math.max(1, Math.round(page.sessionTotal * 0.4)) + " phút. Phím tắt: Space để lật thẻ, 1–4 để chấm."
                                  : "Hôm nay bạn đã hoàn thành. Làm thêm Quiz hoặc luyện Mẫu câu nhé."
                            color: "white"
                            opacity: 0.85
                            font.pixelSize: 14
                            wrapMode: Text.WordWrap
                        }
                    }

                    Button {
                        text: page.sessionTotal > 0 ? "Bắt đầu học  →" : "Làm Quiz  →"
                        font.pixelSize: 16
                        font.bold: true
                        Material.background: "white"
                        Material.foreground: Theme.dark ? "#0B3B35" : Theme.accent
                        Material.roundedScale: Material.MediumScale
                        leftPadding: 24
                        rightPadding: 24
                        implicitHeight: 52
                        onClicked: page.sessionTotal > 0 ? page.startToday() : AppNav.goTo(3)
                    }
                }
            }

            // ---------- Thống kê ----------
            GridLayout {
                Layout.fillWidth: true
                Layout.leftMargin: 32
                Layout.rightMargin: 32
                columns: width > 900 ? 4 : 2
                columnSpacing: 14
                rowSpacing: 14

                StatCard {
                    icon: "⏰"
                    value: page.stats.due
                    label: "Từ cần ôn hôm nay"
                    tint: Theme.warn
                    tintSoft: Theme.warnSoft
                }
                StatCard {
                    icon: "✨"
                    value: page.stats.newToday + "/" + ProgressStore.dailyNewLimit
                    label: "Từ mới hôm nay"
                    tint: Theme.info
                    tintSoft: Theme.infoSoft
                }
                StatCard {
                    icon: "📖"
                    value: page.stats.seen + "/" + page.stats.total
                    label: "Từ đã học"
                }
                StatCard {
                    icon: "🏆"
                    value: page.stats.mastered
                    label: "Từ thành thạo (nhớ ≥ 21 ngày)"
                    tint: Theme.good
                    tintSoft: Theme.goodSoft
                }
            }

            // ---------- Lộ trình ----------
            Card {
                Layout.fillWidth: true
                Layout.leftMargin: 32
                Layout.rightMargin: 32
                implicitHeight: roadCol.implicitHeight + 36

                ColumnLayout {
                    id: roadCol
                    anchors.fill: parent
                    anchors.margins: 18
                    spacing: 12

                    Text {
                        text: "🗺️ Lộ trình A2 → B2"
                        color: Theme.text
                        font.pixelSize: 17
                        font.bold: true
                    }

                    RowLayout {
                        Layout.fillWidth: true
                        spacing: 10
                        Repeater {
                            model: [
                                { lv: "A2", name: "Củng cố nền tảng", words: "~800 từ", active: true },
                                { lv: "B1", name: "Giao tiếp tự tin", words: "+1.200 từ", active: false },
                                { lv: "B2", name: "Diễn đạt trôi chảy", words: "+1.500 từ", active: false }
                            ]
                            Rectangle {
                                required property var modelData
                                Layout.fillWidth: true
                                implicitHeight: 70
                                radius: 10
                                color: modelData.active ? Theme.accentSoft : Theme.surfaceAlt
                                border.color: modelData.active ? Theme.accent : "transparent"
                                border.width: modelData.active ? 2 : 0
                                ColumnLayout {
                                    anchors.centerIn: parent
                                    spacing: 2
                                    Text {
                                        Layout.alignment: Qt.AlignHCenter
                                        text: modelData.lv + (modelData.active ? " · đang học" : "")
                                        color: modelData.active ? Theme.accent : Theme.subtext
                                        font.pixelSize: 16
                                        font.bold: true
                                    }
                                    Text {
                                        Layout.alignment: Qt.AlignHCenter
                                        text: modelData.name + " · " + modelData.words
                                        color: Theme.subtext
                                        font.pixelSize: 13
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // ---------- Chủ đề ----------
            Text {
                Layout.leftMargin: 32
                text: "Tiến độ theo chủ đề"
                color: Theme.text
                font.pixelSize: 18
                font.bold: true
            }

            Card {
                Layout.fillWidth: true
                Layout.leftMargin: 32
                Layout.rightMargin: 32
                implicitHeight: topicCol.implicitHeight + 16

                ColumnLayout {
                    id: topicCol
                    anchors.fill: parent
                    anchors.margins: 8
                    spacing: 0

                    Repeater {
                        model: ContentStore.topics
                        Rectangle {
                            id: topicRow
                            required property var modelData
                            readonly property var ts: ProgressStore.revision >= 0 ? ProgressStore.topicStats(ContentStore.wordIds(modelData.id)) : ({})

                            Layout.fillWidth: true
                            implicitHeight: 60
                            radius: 8
                            color: rowMouse.containsMouse ? Theme.surfaceAlt : "transparent"

                            RowLayout {
                                anchors.fill: parent
                                anchors.leftMargin: 12
                                anchors.rightMargin: 12
                                spacing: 14
                                Text { text: topicRow.modelData.icon; font.pixelSize: 24 }
                                Text {
                                    Layout.preferredWidth: 220
                                    text: topicRow.modelData.title_vi
                                    color: Theme.text
                                    font.pixelSize: 15
                                    font.weight: Font.Medium
                                    elide: Text.ElideRight
                                }
                                ProgressBar {
                                    Layout.fillWidth: true
                                    from: 0
                                    to: Math.max(1, topicRow.ts.total)
                                    value: topicRow.ts.seen
                                }
                                Text {
                                    Layout.preferredWidth: 70
                                    horizontalAlignment: Text.AlignRight
                                    text: topicRow.ts.seen + "/" + topicRow.ts.total
                                    color: Theme.subtext
                                    font.pixelSize: 14
                                }
                                Chip {
                                    visible: topicRow.ts.due > 0
                                    text: topicRow.ts.due + " cần ôn"
                                    textColor: Theme.warn
                                    fill: Theme.warnSoft
                                    fontSize: 12
                                }
                            }
                            MouseArea {
                                id: rowMouse
                                anchors.fill: parent
                                hoverEnabled: true
                                cursorShape: Qt.PointingHandCursor
                                onClicked: AppNav.openTopic(topicRow.modelData.id)
                            }
                        }
                    }
                }
            }

            // ---------- Mẫu câu của ngày ----------
            Card {
                Layout.fillWidth: true
                Layout.leftMargin: 32
                Layout.rightMargin: 32
                visible: page.tip !== null
                implicitHeight: tipCol.implicitHeight + 36
                color: Theme.purpleSoft
                border.width: 0

                ColumnLayout {
                    id: tipCol
                    anchors.fill: parent
                    anchors.margins: 18
                    spacing: 6
                    Text {
                        text: "💬 Mẫu câu của ngày · " + (page.tip ? page.tip.situation_vi : "")
                        color: Theme.purple
                        font.pixelSize: 15
                        font.bold: true
                    }
                    RowLayout {
                        Layout.fillWidth: true
                        Text {
                            Layout.fillWidth: true
                            text: page.tip ? page.tip.neutral : ""
                            color: Theme.text
                            font.pixelSize: 19
                            font.bold: true
                            wrapMode: Text.WordWrap
                        }
                        SpeakButton { speakText: page.tip ? page.tip.neutral : "" }
                    }
                    Text {
                        Layout.fillWidth: true
                        text: page.tip ? page.tip.vi : ""
                        color: Theme.subtext
                        font.pixelSize: 14
                        wrapMode: Text.WordWrap
                    }
                }
            }

            Item { Layout.preferredHeight: 24 }
        }
    }
}
