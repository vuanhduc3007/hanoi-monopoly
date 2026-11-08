# Đưa game lên Internet với Render (miễn phí)

Một dịch vụ web duy nhất trên Render chạy server game (Colyseus) và phục vụ luôn trang web. Bạn bè chỉ cần mở `https://<tên-app>.onrender.com`.

Cấu hình nằm sẵn trong `render.yaml` ở gốc repo: vùng **Singapore**, gói **Free**, Node 22, kiểm tra sức khỏe ở `/health`.

## Lần đầu

1. **Đưa code lên GitHub**
   - Tạo một repo mới trên github.com (có thể để Private).
   - Ở thư mục dự án:
     ```bash
     git remote add origin https://github.com/<tài-khoản>/hanoi-monopoly.git
     git push -u origin main
     ```
2. **Tạo dịch vụ trên Render**
   - Đăng nhập dashboard.render.com (đăng nhập bằng GitHub là nhanh nhất).
   - Chọn **New → Blueprint**, cấp quyền cho Render đọc repo vừa tạo, chọn repo đó.
   - Render đọc `render.yaml` và hiện dịch vụ `hanoi-monopoly`. Bấm **Apply**.
3. **Chờ build** (lần đầu khoảng 3–5 phút). Khi trạng thái là **Live**, mở địa chỉ `https://hanoi-monopoly-xxxx.onrender.com` hiện ở đầu trang dịch vụ.
4. **Kiểm tra**: mở `https://.../health` phải thấy `{"ok":true,...}`. Tạo phòng, gửi link mời cho bạn bè.

## Các lần sau

Chỉ cần `git push`. Render tự build lại và thay bản mới (`autoDeploy: true`). Phòng đang chơi sẽ mất khi bản mới khởi động, nên tránh push lúc đang có ván.

## Điều cần biết về gói Free

- Không có ai truy cập khoảng 15 phút thì server **ngủ**. Người đầu tiên vào lại phải chờ khoảng 1 phút để server thức dậy (trang sẽ tải chậm, cứ đợi).
- Server ngủ hoặc khởi động lại thì **các phòng đang mở biến mất** (ván chỉ nằm trong bộ nhớ).
- Gói Free có giới hạn số giờ chạy mỗi tháng; với một dịch vụ thì thường đủ. Điều kiện có thể thay đổi — xem trang giá của Render.

## Biến môi trường (tùy chọn, ở tab Environment)

| Biến | Mặc định | Ý nghĩa |
| --- | --- | --- |
| `BOT_DELAY_MS` | `800` | Bot chờ bao lâu trước mỗi nước đi |
| `LOG_DIR` | (không) | Thư mục ghi nhật ký ván để phát lại (trên gói Free sẽ mất khi khởi động lại) |
| `PORT` | do Render đặt | Không cần sửa |

## Chạy thử bản production trên máy

```bash
npx -y pnpm@9.15.0 install --frozen-lockfile
```
```bash
npx -y pnpm@9.15.0 run build
```
```bash
npx -y pnpm@9.15.0 start
```
Mở `http://localhost:2567` (hoặc đặt `PORT`).
