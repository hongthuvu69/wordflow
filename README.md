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

Tạo file `content/NN_ten_chu_de.json` theo cấu trúc giống các file có sẵn, rồi build lại. ID của từ phải là duy nhất. Trong câu ví dụ, đặt từ cần học trong dấu `*...*` để app tô đậm và dùng cho bài điền từ.

## Nội dung hiện có

- **A2:** Cuộc sống hằng ngày, Ăn uống, Du lịch, Công việc, Mua sắm (150 từ)
- **B1:** Sức khỏe, Cảm xúc & Tính cách, Công nghệ, Môi trường, Học tập (150 từ)
- Mỗi chủ đề có 8 tình huống giao tiếp, mỗi tình huống có 3 mức trang trọng / bình thường / thân mật.

## Các chế độ học

- **Ôn tập (flashcard):** học từ mới và ôn lại theo lịch lặp lại ngắt quãng.
- **Luyện viết:** dịch câu Việt → Anh (chấm tự động so với câu mẫu), sắp xếp từ thành câu, tự đặt câu. Có nút "Copy để hỏi Claude" để AI chấm kỹ hơn bằng gói Claude bạn đang dùng.
- **Quiz:** chọn nghĩa, điền từ, nghe chọn từ, chọn câu đúng.
- **Mẫu câu:** hội thoại theo tình huống.

## Luyện thi TOEIC (web app)

Web app trong `docs/` có 4 tab: **Hôm nay** (việc cần làm theo lịch người đi làm), **Luyện đề**, **Từ vựng**, **Tiến độ** (biểu đồ điểm, lộ trình 48 tuần, báo cáo tuần). Code nằm ở `docs/js/toeic.js` (dữ liệu, chấm điểm, lộ trình) và `docs/js/toeic-ui.js` (giao diện).

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
