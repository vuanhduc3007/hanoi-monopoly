# Đưa game lên itch.io

itch.io chứa phần hiển thị (client) và cho chơi ngay trong trình duyệt, kể cả trên Android và iOS. Server game vẫn chạy trên Render; người chơi từ itch.io và từ link Render vào chung phòng được.

## Tạo file tải lên

```bash
npx -y pnpm@9.15.0 --filter @hanoi-monopoly/client run build:itch
```

Kết quả: `packages/client/hanoi-monopoly-itch.zip` (có `index.html` ở gốc, đúng yêu cầu của itch.io).

Bản build này khác bản thường ở ba điểm, cấu hình trong `packages/client/.env.itch`:

- đường dẫn file là tương đối, vì itch.io phục vụ game từ tên miền riêng trong một khung nhúng;
- `VITE_SERVER_URL` — địa chỉ server game;
- `VITE_PUBLIC_URL` — trang web mà link mời trỏ tới (trang itch.io không nhận được mã phòng trên địa chỉ).

Đổi server thì sửa hai dòng đó rồi build lại và tải zip mới lên.

## Tạo trang trên itch.io

1. Đăng ký tài khoản tại itch.io (miễn phí), vào **Dashboard → Create new project**.
2. **Kind of project**: chọn **HTML**.
3. **Uploads**: tải `hanoi-monopoly-itch.zip` lên, tick **This file will be played in the browser**.
4. **Embed options**:
   - kích thước khung: 1280 × 720 là điểm bắt đầu hợp lý;
   - bật **Fullscreen button**;
   - bật **Mobile friendly**, hướng màn hình để tự do.
5. **Pricing**: chọn **No payments** nếu muốn miễn phí hoàn toàn.
6. Điền tên, mô tả, ảnh bìa, ảnh chụp. Không dùng chữ "Monopoly" (nhãn hiệu của Hasbro).
7. Lưu ở chế độ **Draft**, bấm **View page** để chơi thử, rồi mới đổi sang **Public**.

## Cần thử trên trang itch.io trước khi công khai

- Tạo phòng trên máy tính, vào phòng đó từ điện thoại bằng mã phòng.
- Nút **Sao chép link mời**: trong khung nhúng trình duyệt có thể chặn sao chép; code đã có cách dự phòng nhưng cần thử thật.
- Tải lại trang giữa ván: có lấy lại được chỗ ngồi không (Safari hạn chế lưu trữ trong khung nhúng).
- Bố cục khi cầm điện thoại dọc và khi bấm toàn màn hình.

## Lưu ý về server

Gói miễn phí của Render ngủ khi không ai chơi; người đầu tiên bấm **Tạo phòng** sẽ thấy "Đang kết nối…" một lúc trong khi server thức dậy.
