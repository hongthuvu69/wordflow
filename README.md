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

## Phím tắt

- Flashcard: `Space` để lật thẻ, `1`–`4` để chấm (Quên / Khó / Nhớ / Dễ), `R` để nghe lại.
- Quiz: `1`–`4` để chọn đáp án, `Enter` để sang câu tiếp.
- `Backspace` để quay lại.
