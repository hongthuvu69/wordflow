# Cài đặt đồng bộ PC ↔ iPhone

Làm một lần, mất khoảng 15 phút. Gồm 4 phần: **Supabase** (lưu tiến độ), **app Qt trên PC**, **GitHub Pages** (đưa web app lên mạng), **iPhone**.

---

## 1. Supabase: chỗ lưu tiến độ (miễn phí)

1. Vào <https://supabase.com>, bấm **Start your project** và đăng ký (có thể dùng tài khoản GitHub).
2. Bấm **New project**:
   - **Name:** `wordflow`
   - **Database Password:** bấm *Generate* rồi lưu lại ở chỗ an toàn. App không cần mật khẩu này.
   - **Region:** *Southeast Asia (Singapore)* (gần Việt Nam nhất)
   - Bấm **Create new project** và đợi khoảng 1–2 phút.
3. Tạo bảng: ở menu bên trái chọn **SQL Editor**, rồi **New query**. Dán toàn bộ nội dung file [`supabase/schema.sql`](supabase/schema.sql) vào và bấm **Run**. Kết quả phải là *Success. No rows returned*.
4. *(Khuyên dùng)* Tắt bước xác nhận email cho đơn giản: vào **Authentication → Sign In / Providers → Email**, tắt **Confirm email** rồi bấm **Save**.
   Nếu để bật, sau khi tạo tài khoản bạn phải bấm link trong email trước khi đăng nhập được.
5. Lấy 2 thông tin kết nối ở **Project Settings** (biểu tượng bánh răng):
   - **Project URL**, có dạng `https://abcdefgh.supabase.co`. Nằm ở trang *Data API* hoặc ở nút **Connect** trên đầu trang.
   - **Publishable key**, có dạng `sb_publishable_...`, ở trang *API Keys*. Bản Supabase cũ hơn gọi là **anon public** key.

> ⚠️ Chỉ dùng **publishable / anon** key. **Không bao giờ** dán `secret` hay `service_role` key vào app hay đưa lên GitHub.

## 2. App Qt trên PC

1. Mở WordFlow, vào **Cài đặt → Đồng bộ với iPhone**.
2. Dán **Project URL** và **Publishable key**, rồi bấm **Lưu máy chủ**.
3. Nhập email và mật khẩu mới (mật khẩu riêng cho app, ít nhất 6 ký tự), rồi bấm **Tạo tài khoản**.
   - Nếu chưa tắt *Confirm email*: mở email, bấm link xác nhận, quay lại app và bấm **Đăng nhập**.
4. Thấy dòng **✓ Đã đồng bộ lúc …** là xong. Từ giờ app tự đồng bộ khi mở, và 15 giây sau mỗi lần bạn học.

## 3. GitHub Pages: đưa web app lên mạng (miễn phí)

Web app nằm trong thư mục `docs/`. GitHub Pages sẽ cấp cho nó một địa chỉ `https://<tên-bạn>.github.io/wordflow/`.

1. Tạo tài khoản ở <https://github.com> (nếu chưa có).
2. Bấm **New repository**:
   - **Name:** `wordflow`
   - Chọn **Public** (GitHub Pages miễn phí chỉ dành cho repo public)
   - Không tick thêm README hay .gitignore. Bấm **Create repository**.
3. Đẩy code lên. Nhờ Claude chạy giúp, hoặc tự chạy trong thư mục dự án:
   ```bash
   git remote add origin https://github.com/<tên-bạn>/wordflow.git
   git push -u origin main
   ```
   Lần đầu Windows sẽ mở trình duyệt để bạn đăng nhập GitHub.
4. Trên trang repo, vào **Settings → Pages**. Ở mục *Build and deployment*, chọn **Source: Deploy from a branch**, **Branch: `main`**, thư mục **`/docs`**, rồi bấm **Save**.
5. Đợi 1–2 phút rồi mở `https://<tên-bạn>.github.io/wordflow/` để kiểm tra.

*(Tùy chọn)* Muốn khỏi phải gõ URL và key trên iPhone thì điền sẵn vào [`docs/js/config.js`](docs/js/config.js), rồi commit và push lại.

## 4. iPhone

1. Mở **Safari** (bắt buộc dùng Safari) và vào `https://<tên-bạn>.github.io/wordflow/`.
2. Bấm nút **Chia sẻ** (ô vuông có mũi tên lên), chọn **Thêm vào MH chính** rồi bấm **Thêm**.
3. Mở WordFlow từ màn hình chính, bấm **⚙️** ở góc trên.
4. Nếu chưa điền `config.js`: dán Project URL và key, rồi bấm **Lưu máy chủ**.
5. **Đăng nhập** bằng đúng email và mật khẩu đã tạo ở bước 2.

Xong! Học trên máy nào thì tiến độ cũng tự về máy kia.

---

## Đồng bộ hoạt động thế nào?

- Mỗi từ có một dòng tiến độ kèm thời điểm sửa (`updated_at`). Khi hai máy cùng sửa một từ, **bản sửa sau cùng thắng**.
- Mỗi lượt ôn có một mã riêng (`uid`), nên dù đồng bộ nhiều lần cũng không bị đếm trùng.
- Không có mạng vẫn học bình thường. Dữ liệu được lưu trên máy và sẽ đẩy lên khi có mạng trở lại.
- **Xóa tiến độ** trong Cài đặt khi đang đăng nhập sẽ xóa cả trên máy chủ. Máy còn lại nên đăng xuất rồi xóa tiến độ, nếu không lần đồng bộ sau sẽ đẩy dữ liệu cũ của nó lên lại.

## Sửa nội dung học

Sửa hoặc thêm file trong `content/`, chạy `build.bat` (lệnh này tự copy nội dung sang `docs/content/`), rồi commit và push. iPhone sẽ nhận nội dung mới ở lần mở app thứ hai, vì app dùng bản cache trước rồi mới cập nhật ngầm.

Muốn thử web app ngay trên PC: chạy `node tools/serve_web.js` rồi mở <http://localhost:8080>.
