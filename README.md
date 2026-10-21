# WordFlow: học từ vựng tiếng Anh A2 → B2

App desktop viết bằng Qt 6 (QML + C++) để học từ vựng theo chủ đề, kèm cách dùng, collocations, lỗi hay gặp và mẫu câu giao tiếp.

## Build & chạy

**Cách 1: Qt Creator.** Mở `CMakeLists.txt`, chọn kit *Desktop Qt 6.10.2 MSVC2022 64bit*, rồi bấm Run.

**Cách 2: dòng lệnh.**

```bat
build.bat
build\WordFlow.exe
```

## Đồng bộ với iPhone

Web app cho iPhone nằm trong `docs/`, đưa lên mạng bằng GitHub Pages. Tiến độ học đồng bộ qua Supabase. Hướng dẫn cài đặt từng bước: [SETUP_SYNC.md](SETUP_SYNC.md).

## Cấu trúc

| Thư mục | Nội dung |
|---|---|
| `src/contentstore.*` | Đọc nội dung học từ `content/*.json` (nhúng vào app) |
| `src/progressstore.*` | Tiến độ học trong SQLite và lịch ôn tập lặp lại ngắt quãng (biến thể SM-2) |
| `src/syncclient.*` | Đăng nhập và đồng bộ tiến độ với Supabase |
| `src/speech.*` | Phát âm bằng giọng đọc tiếng Anh có sẵn của Windows (SAPI) |
| `qml/` | Giao diện: Trang chủ, Chủ đề, Flashcard, Quiz, Mẫu câu, Cài đặt |
| `content/` | Mỗi chủ đề một file JSON: `words` (từ vựng) và `phrases` (mẫu câu theo tình huống) |
| `docs/` | Web app (PWA) cho iPhone, viết bằng JS thuần, chạy được offline. `docs/content/` được copy tự động từ `content/` |
| `supabase/schema.sql` | Bảng và quyền truy cập trên Supabase |
| `tools/` | Script copy nội dung sang web app, server để thử web app trên máy |

## Thêm chủ đề mới

- **Chủ đề viết tay** (01–10): sửa trực tiếp `content/NN_ten.json`, kèm mẫu câu giao tiếp.
- **Chủ đề sinh từ file nguồn** (11–70): viết ở dạng gọn trong `content-src/NN_ten.txt` (mỗi dòng một từ, các trường cách nhau bởi ` | `, mô tả ở đầu `tools/build_vocab.py`), rồi chạy:

```bash
python tools/build_vocab.py --oxford <ox_rows.json> --pool <pool.json>
```

Script tạo `content/NN_ten.json`, báo từ trùng, câu ví dụ thiếu `*từ*`, và độ phủ so với danh sách Oxford. Cấp độ CEFR của từng từ lấy theo danh sách Oxford 3000/5000. Từ ngoài danh sách được gắn nhãn `TOEIC`.

Trong câu ví dụ, đặt từ cần học trong dấu `*...*` để app tô đậm và dùng cho bài điền từ. Sau khi sửa nội dung, build lại (hoặc chạy `tools/sync_web_content.ps1`) để copy sang web app.

## Nội dung hiện có

**3.318 từ trong 70 chủ đề:**
- **A2–B1** (10 chủ đề viết tay, 300 từ) kèm 80 tình huống mẫu câu.
- **B1–B2 theo danh sách Oxford 3000/5000** (41 chủ đề): phủ toàn bộ 2.085 từ B1–B2 của danh sách (trừ "Wi-Fi", đã có sẵn). Gồm các chủ đề kinh doanh, xã hội, khoa học, cùng các nhóm từ nối, động từ học thuật và "từ quen – nghĩa mới".
- **TOEIC công sở** (19 chủ đề, khoảng 830 từ): văn phòng, nhân sự, kế toán, mua hàng, logistics, hợp đồng, khách sạn, nhà hàng, sân bay, sự kiện, bất động sản, chăm sóc khách hàng, ngân hàng, IT, phòng khám, email công việc, bán hàng, cụm động từ, từ vựng mô tả tranh Part 1.

Nghĩa tiếng Việt, câu ví dụ và collocation do WordFlow tự viết. Danh sách Oxford chỉ dùng để chọn từ và xác định cấp độ.

**Đề luyện** (`docs/tests/`): Mini Test 01–04 (mỗi đề 40 câu, Part 2–7) và Part 5 · Bộ luyện 01 (40 câu). Vị trí đáp án đúng được trộn đều A/B/C/D bằng `tools/balance_answers.js`.

## Các chế độ học

- **Ôn tập (flashcard):** học từ mới và ôn lại theo lịch lặp lại ngắt quãng.
- **Luyện viết:** dịch câu Việt → Anh (chấm tự động so với câu mẫu), sắp xếp từ thành câu, tự đặt câu. Có nút "Copy để hỏi Claude" để AI chấm kỹ hơn bằng gói Claude bạn đang dùng.
- **Quiz:** chọn nghĩa, điền từ, nghe chọn từ, chọn câu đúng.
- **Mẫu câu:** hội thoại theo tình huống.

## Luyện thi TOEIC (web app)

Web app trong `docs/` có 4 tab: **Hôm nay** (việc cần làm theo lịch người đi làm), **Luyện đề**, **Từ vựng**, **Tiến độ** (biểu đồ điểm, lộ trình 48 tuần, báo cáo tuần). Code nằm ở `docs/js/toeic.js` (dữ liệu, chấm điểm, lộ trình) và `docs/js/toeic-ui.js` (giao diện).

**Học từ vựng** (`docs/js/vocab-ui.js`): mỗi chủ đề chia thành bài 10 từ, học theo nhóm 5 từ qua 3 bước Làm quen → Nhận diện → Nhớ chủ động (gõ từ / điền vào câu). Ôn tập bằng câu hỏi, app tự chấm và gọi cùng lịch ôn SM-2 với flashcard (vẫn đồng bộ với app PC). Có 5 mức ghi nhớ và danh sách Từ khó.

Kết quả luyện đề, sổ lỗi sai và điểm Study4 hiện chỉ lưu trên từng máy (localStorage), chưa đồng bộ qua Supabase.

### Thêm đề vào kho

Mỗi đề là một file trong `docs/tests/`, khai báo trong `docs/tests/index.json`. Cấu trúc (xem mẫu `mini-01.json`):

```jsonc
{
  "id": "full-01", "title": "Full Test 01", "kind": "full",   // full | mini
  "duration": 120, "source": "…",
  "parts": [{
    "part": 3, "directions": "…",
    "groups": [{                       // một nhóm = một đoạn hội thoại / đoạn văn / một câu đơn
      "script": [{ "sp": "W", "accent": "us", "text": "…" }],   // Part 1–4: lời thoại (us/uk/au/ca)
      "audio": "audio/full-01/g12.mp3",                           // (sẽ hỗ trợ) file nghe thật
      "image": "img/full-01/p1-1.jpg",                           // Part 1
      "passages": [{ "kind": "email", "head": "From: …", "text": "… {{131}} …" }],  // Part 6–7; {{n}} = chỗ trống
      "questions": [{
        "id": "f01-32", "n": 32, "type": "p34-detail",          // type: xem TYPES trong toeic.js
        "prompt": "…", "options": ["…", "…", "…", "…"], "answer": 2,
        "explain": "giải thích tiếng Việt", "evidence": "câu chứa đáp án (được tô vàng)",
        "vocab": [["từ", "nghĩa"]]
      }]
    }]
  }]
}
```

`id` của câu hỏi phải duy nhất trong toàn bộ kho, vì sổ lỗi sai và thống kê theo dạng câu dùng `id` này.

## Phím tắt

- Flashcard: `Space` để lật thẻ, `1`–`4` để chấm (Quên / Khó / Nhớ / Dễ), `R` để nghe lại.
- Quiz: `1`–`4` để chọn đáp án, `Enter` để sang câu tiếp.
- Làm đề (web): `A`–`D` chọn đáp án cho câu chưa làm, `←`/`→` chuyển trang.
- `Backspace` để quay lại.
