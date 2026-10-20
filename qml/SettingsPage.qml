import QtQuick
import QtQuick.Controls
import QtQuick.Controls.Material
import QtQuick.Layouts

Item {
    id: page

    ScrollView {
        id: sv
        anchors.fill: parent
        contentWidth: availableWidth

        ColumnLayout {
            width: Math.min(sv.availableWidth, 820)
            spacing: 18

            Item { Layout.preferredHeight: 8 }

            PageHeader {
                Layout.fillWidth: true
                Layout.leftMargin: 32
                title: "⚙️ Cài đặt"
            }

            Card {
                Layout.fillWidth: true
                Layout.leftMargin: 32
                implicitHeight: learnCol.implicitHeight + 40

                ColumnLayout {
                    id: learnCol
                    anchors.fill: parent
                    anchors.margins: 20
                    spacing: 14

                    Text { text: "Học tập"; color: Theme.text; font.pixelSize: 18; font.bold: true }

                    RowLayout {
                        Layout.fillWidth: true
                        ColumnLayout {
                            Layout.fillWidth: true
                            spacing: 2
                            Text { text: "Số từ mới mỗi ngày"; color: Theme.text; font.pixelSize: 15 }
                            Text {
                                Layout.fillWidth: true
                                text: "Gợi ý 10–15 từ. Học nhiều quá sẽ dồn rất nhiều bài ôn vào các ngày sau."
                                color: Theme.subtext
                                font.pixelSize: 13
                                wrapMode: Text.WordWrap
                            }
                        }
                        SpinBox {
                            from: 1
                            to: 50
                            value: ProgressStore.dailyNewLimit
                            onValueModified: ProgressStore.dailyNewLimit = value
                        }
                    }

                    RowLayout {
                        Layout.fillWidth: true
                        ColumnLayout {
                            Layout.fillWidth: true
                            spacing: 2
                            Text { text: "Tự động đọc từ khi hiện thẻ"; color: Theme.text; font.pixelSize: 15 }
                            Text {
                                text: "Nghe phát âm ngay khi lật sang từ mới."
                                color: Theme.subtext
                                font.pixelSize: 13
                            }
                        }
                        Switch {
                            checked: ProgressStore.autoSpeak
                            onToggled: ProgressStore.autoSpeak = checked
                        }
                    }
                }
            }

            Card {
                Layout.fillWidth: true
                Layout.leftMargin: 32
                implicitHeight: voiceCol.implicitHeight + 40

                ColumnLayout {
                    id: voiceCol
                    anchors.fill: parent
                    anchors.margins: 20
                    spacing: 10
                    Text { text: "Phát âm"; color: Theme.text; font.pixelSize: 18; font.bold: true }
                    Text {
                        Layout.fillWidth: true
                        text: Speech.available ? "Giọng đọc: " + (Speech.voiceName || "mặc định của Windows")
                                               : "Không tìm thấy bộ đọc của Windows."
                        color: Theme.subtext
                        font.pixelSize: 14
                        wrapMode: Text.WordWrap
                    }
                    RowLayout {
                        spacing: 10
                        Button {
                            text: "🔊 Nghe thử"
                            enabled: Speech.available
                            onClicked: Speech.speak("Hello! Let's learn some new English words today.")
                        }
                        Button {
                            text: "🐢 Nghe chậm"
                            enabled: Speech.available
                            onClicked: Speech.speak("Hello! Let's learn some new English words today.", true)
                        }
                    }
                }
            }

            // ---------- Đồng bộ ----------
            Card {
                id: syncCard
                Layout.fillWidth: true
                Layout.leftMargin: 32
                implicitHeight: syncCol.implicitHeight + 40

                property bool editServer: !Sync.configured

                ColumnLayout {
                    id: syncCol
                    anchors.fill: parent
                    anchors.margins: 20
                    spacing: 10

                    RowLayout {
                        Layout.fillWidth: true
                        Text {
                            Layout.fillWidth: true
                            text: "☁️ Đồng bộ với iPhone"
                            color: Theme.text
                            font.pixelSize: 18
                            font.bold: true
                        }
                        BusyIndicator {
                            visible: Sync.busy
                            running: Sync.busy
                            implicitWidth: 28
                            implicitHeight: 28
                        }
                    }

                    Text {
                        Layout.fillWidth: true
                        text: "Tiến độ học được lưu lên Supabase để PC và iPhone dùng chung. Xem hướng dẫn cài đặt trong file SETUP_SYNC.md."
                        color: Theme.subtext
                        font.pixelSize: 13
                        wrapMode: Text.WordWrap
                    }

                    // 1) Cấu hình máy chủ
                    ColumnLayout {
                        visible: syncCard.editServer
                        Layout.fillWidth: true
                        spacing: 8
                        TextField {
                            id: urlField
                            Layout.fillWidth: true
                            placeholderText: "Project URL, ví dụ https://abcxyz.supabase.co"
                            text: Sync.serverUrl
                        }
                        TextField {
                            id: keyField
                            Layout.fillWidth: true
                            placeholderText: "Publishable key (hoặc anon key)"
                        }
                        RowLayout {
                            spacing: 10
                            Button {
                                highlighted: true
                                text: "Lưu máy chủ"
                                onClicked: if (Sync.configure(urlField.text, keyField.text)) syncCard.editServer = false
                            }
                            Button {
                                visible: Sync.configured
                                text: "Hủy"
                                onClicked: syncCard.editServer = false
                            }
                        }
                    }

                    // 2) Đăng nhập
                    ColumnLayout {
                        visible: !syncCard.editServer && Sync.configured && !Sync.signedIn
                        Layout.fillWidth: true
                        spacing: 8
                        Text {
                            text: "Máy chủ: " + Sync.serverUrl
                            color: Theme.subtext
                            font.pixelSize: 13
                        }
                        TextField {
                            id: emailField
                            Layout.fillWidth: true
                            placeholderText: "Email"
                            inputMethodHints: Qt.ImhEmailCharactersOnly
                        }
                        TextField {
                            id: passField
                            Layout.fillWidth: true
                            placeholderText: "Mật khẩu (ít nhất 6 ký tự)"
                            echoMode: TextInput.Password
                            onAccepted: Sync.signIn(emailField.text, passField.text)
                        }
                        RowLayout {
                            spacing: 10
                            Button {
                                highlighted: true
                                enabled: !Sync.busy
                                text: "Đăng nhập"
                                onClicked: Sync.signIn(emailField.text, passField.text)
                            }
                            Button {
                                enabled: !Sync.busy
                                text: "Tạo tài khoản"
                                onClicked: Sync.signUp(emailField.text, passField.text)
                            }
                            Button {
                                flat: true
                                text: "Đổi máy chủ"
                                onClicked: syncCard.editServer = true
                            }
                        }
                    }

                    // 3) Đã đăng nhập
                    ColumnLayout {
                        visible: !syncCard.editServer && Sync.signedIn
                        Layout.fillWidth: true
                        spacing: 8
                        Text {
                            text: "Đã đăng nhập: <b>" + Sync.email + "</b>"
                            textFormat: Text.StyledText
                            color: Theme.text
                            font.pixelSize: 15
                        }
                        Text {
                            text: "Tự động đồng bộ khi mở app và 15 giây sau khi bạn học xong."
                            color: Theme.subtext
                            font.pixelSize: 13
                        }
                        RowLayout {
                            spacing: 10
                            Button {
                                highlighted: true
                                enabled: !Sync.busy
                                text: "🔄 Đồng bộ ngay"
                                onClicked: Sync.syncNow()
                            }
                            Button {
                                enabled: !Sync.busy
                                text: "Đăng xuất"
                                onClicked: Sync.signOut()
                            }
                        }
                    }

                    Text {
                        Layout.fillWidth: true
                        visible: Sync.status.length > 0
                        text: (Sync.lastOk ? "✓ " : "⚠ ") + Sync.status
                        color: Sync.lastOk ? Theme.good : Theme.bad
                        font.pixelSize: 13
                        wrapMode: Text.WordWrap
                    }
                }
            }

            Card {
                Layout.fillWidth: true
                Layout.leftMargin: 32
                implicitHeight: dataCol.implicitHeight + 40

                ColumnLayout {
                    id: dataCol
                    anchors.fill: parent
                    anchors.margins: 20
                    spacing: 10
                    Text { text: "Dữ liệu"; color: Theme.text; font.pixelSize: 18; font.bold: true }
                    Text {
                        Layout.fillWidth: true
                        text: "Tiến độ được lưu tại:\n" + ProgressStore.dataPath
                        color: Theme.subtext
                        font.pixelSize: 13
                        wrapMode: Text.WrapAnywhere
                    }
                    Button {
                        text: "🗑️ Xóa toàn bộ tiến độ học"
                        Material.foreground: Theme.bad
                        onClicked: confirm.open()
                    }
                }
            }

            Item { Layout.preferredHeight: 24 }
        }
    }

    Dialog {
        id: confirm
        anchors.centerIn: parent
        width: 440
        modal: true
        title: "Xóa toàn bộ tiến độ?"
        standardButtons: Dialog.Yes | Dialog.No
        Label {
            width: confirm.availableWidth
            text: Sync.signedIn
                  ? "Mọi từ đã học và lịch ôn tập sẽ bị xóa trên máy này VÀ trên máy chủ đồng bộ. Không thể hoàn tác."
                  : "Mọi từ đã học và lịch ôn tập sẽ bị xóa. Không thể hoàn tác."
            wrapMode: Text.WordWrap
        }
        onAccepted: {
            ProgressStore.resetProgress()
            if (Sync.signedIn)
                Sync.deleteRemoteData()
        }
    }
}
