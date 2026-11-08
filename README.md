# Cờ Tỷ Phú Hà Nội

Game cờ tỷ phú bối cảnh Hà Nội, chơi online nhiều người ngay trên trình duyệt (2–6 người mỗi phòng). Bạn đi từ ven đô vào Phố cổ: đất càng gần Hồ Gươm càng đắt.

**▶ Chơi ngay: https://hanoi-monopoly.onrender.com**

Tạo phòng, gửi mã 6 ký tự hoặc link mời cho bạn bè, chọn nhân vật rồi bắt đầu. Server chạy gói miễn phí nên nếu một lúc lâu không ai vào, lần mở đầu tiên có thể mất khoảng một phút để khởi động.

## Có gì trong game

- **Bàn cờ 40 ô** với địa danh Hà Nội: 22 bất động sản trong 8 nhóm màu, 4 ô giao thông (Bến xe Mỹ Đình, Metro Cát Linh – Hà Đông, Ga Hà Nội, Sân bay Nội Bài), 2 tiện ích, ô Quỹ khuyến học ở Văn Miếu.
- **65 lá thẻ**: Cơ hội, Cộng đồng và bộ Hanoi Event, có thẻ tác động cả bàn và thẻ ⏳ kéo dài một vòng.
- **8 nhân vật**, mỗi người có nội tại, điểm yếu và một kỹ năng dùng một lần mỗi ván. Tỉ lệ thắng đã được cân bằng bằng mô phỏng 10.000 ván bot.
- **Hai chế độ**: Truyền thống (người cuối cùng không phá sản thắng) và Nhanh (chia đất đầu ván, tài sản cao nhất khi hết 60 phút thắng).
- **Chơi online**: mua đất, đấu giá, xây nhà, thế chấp, giao dịch. Mỗi quyết định có đồng hồ đếm ngược. Người mất kết nối được bot chơi thay và có thể quay lại bất cứ lúc nào. Có khán giả và chat.
- **Phong cách Đông Hồ** hiện đại, âm thanh (xúc xắc trong bát, còi CSGT, chuông xe đạp, trống hội…), chơi được trên điện thoại.

## Công nghệ

Monorepo TypeScript (pnpm workspaces):

| Package | Vai trò |
| --- | --- |
| [`packages/engine`](packages/engine) | Rules engine thuần TypeScript: `applyAction(state, action) → { state, events }`, RNG có seed, bot |
| [`packages/server`](packages/server) | Server [Colyseus](https://colyseus.io) 0.16: phòng, mã mời, đồng hồ, bot thay người; phục vụ luôn bản build của client |
| [`packages/client`](packages/client) | React 18 + Vite, chữ tiếng Việt gom trong `src/i18n/vi.ts`, hình SVG kiểu Đông Hồ |
| [`packages/sim`](packages/sim) | CLI cho bot đấu với nhau để cân bằng nhân vật |

Server giữ toàn quyền: xúc xắc, xáo bài và tính tiền chỉ chạy trên server. Client chỉ gửi hành động và hiển thị. Mọi số liệu game nằm trong [`data/*.json`](data), không viết cứng trong code.

## Chạy trên máy

Cần Node.js 20 trở lên. Lệnh dưới dùng pnpm qua `npx`, nên không cần cài pnpm trước.

```bash
npx -y pnpm@9.15.0 install
```

Chạy server game (cổng 2567) và client dev (cổng 5173) ở hai cửa sổ:

```bash
npx -y pnpm@9.15.0 server
```

```bash
npx -y pnpm@9.15.0 client
```

Mở http://localhost:5173 ở hai tab để thử chơi hai người.

Các lệnh khác:

```bash
npx -y pnpm@9.15.0 test        # toàn bộ unit test (Vitest)
```

```bash
npx -y pnpm@9.15.0 sim -- --games 10000 --players 4   # mô phỏng bot, báo cáo tỉ lệ thắng theo nhân vật
```

```bash
npx -y pnpm@9.15.0 run build && npx -y pnpm@9.15.0 start   # bản production: game + trang web chung một cổng
```

## Triển khai

Repo có sẵn [`render.yaml`](render.yaml) để deploy lên [Render](https://render.com) gói miễn phí, vùng Singapore. Xem hướng dẫn từng bước ở [`docs/deploy-render.md`](docs/deploy-render.md).

## Tài liệu

- [`docs/Hanoi Monopoly — Game Design Document.md`](docs/Hanoi%20Monopoly%20%E2%80%94%20Game%20Design%20Document.md): luật chơi, thẻ, nhân vật, giao diện
- [`docs/decisions.md`](docs/decisions.md): các chỗ GDD còn mơ hồ đã được làm rõ, kết quả cân bằng, quyết định kỹ thuật
- [`packages/server/README.md`](packages/server/README.md): giao thức message giữa client và server

## Lưu ý

Đây là dự án cá nhân, phi thương mại. Tên các địa danh, thương hiệu và tên nhân vật trong game chỉ mang tính minh họa, không liên quan đến các công ty hay cá nhân có thật.
