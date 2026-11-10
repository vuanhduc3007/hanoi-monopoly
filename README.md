# Cờ Tỷ Phú Hà Nội

Game cờ tỷ phú bối cảnh Hà Nội, chơi online nhiều người ngay trên trình duyệt (2–8 người mỗi phòng). Bạn đi từ ven đô vào Phố cổ: đất càng gần Hồ Gươm càng đắt.

**▶ Chơi ngay: https://hanoi-monopoly.onrender.com**

Tạo phòng, gửi mã 6 ký tự hoặc link mời cho bạn bè, chọn nhân vật rồi bắt đầu. Server chạy gói miễn phí nên nếu một lúc lâu không ai vào, lần mở đầu tiên có thể mất khoảng một phút để khởi động.

## Có gì trong game

- **Ba bàn cờ vuông theo số người chơi**, địa danh Hà Nội, ô Quỹ khuyến học ở Văn Miếu. Phòng chờ tự chọn bàn theo số người, chủ phòng cũng có thể chọn tay:

  | Bàn | Số người | Nội dung |
  | --- | --- | --- |
  | Tiêu chuẩn 40 ô | 2–4 | 22 bất động sản trong 8 nhóm màu, 4 ô giao thông (Bến xe Mỹ Đình, Metro Cát Linh – Hà Đông, Ga Hà Nội, Sân bay Nội Bài), 2 tiện ích |
  | Mở rộng 48 ô | 5–6 | tiền khởi đầu ×1,15, lương ×1,2; thêm nhóm Xanh ngọc (Linh Đàm, Văn Quán, Nghĩa Đô), nhóm Tím (Ciputra, Tây Hồ Tây, Làng đào Nhật Tân), Metro Nhổn – Ga Hà Nội |
  | Đại 56 ô | 7–8 | tiền khởi đầu ×1,3, lương ×1,2; thêm nhóm Bạc (Tràng Tiền, Nhà hát Lớn, Phan Đình Phùng), nhóm Mận (Hàng Ngang, Hàng Đào), Bến xe Giáp Bát |

- **12 nhân vật**, mỗi người có nội tại, điểm yếu và một kỹ năng **hồi lại sau vài lượt** (thường là 3):

  | Nhân vật | Nét chính |
  | --- | --- |
  | Thiếu gia Vin | lương cao, mua Vinhomes/Vincom rẻ hơn, bố trả nợ hộ khi sắp phá sản |
  | Ninja Lead | không sợ CSGT thổi còi, "ăn vạ" giảm nửa tiền thuê |
  | Tài xế Grab | chỉnh ±1 bước, chạy cuốc đêm (tung lại) |
  | Idol TikTok | được ngân hàng thưởng thêm khi thu tiền thuê, "bóc phốt" chặn thu thuê của đối thủ |
  | Cò đất | ăn hoa hồng khi đối thủ mua đất, "tung tin quy hoạch" nhân đôi tiền thuê một nhóm |
  | Nghiện Tarot | rút 2 thẻ Cơ hội chọn 1, "giải hạn" thẻ Event |
  | SVBK | thưởng ở Văn Miếu, tốt nghiệp thì lương tăng |
  | Nô lệ tư bản | nhiều vốn khởi đầu, xin nghỉ phép ra khỏi Bãi giữ xe |
  | Con bạc | chơi **tài xỉu** khi mua đất hay nộp phạt (thắng trả bớt, thua trả thêm), **mở sòng** cho cả bàn đặt cược với mình làm nhà cái |
  | Thợ xây | xây nhà rẻ hơn, tự tay xây nhà miễn phí (kể cả một "nhà chui") |
  | F0 chứng khoán | nhận cổ tức theo giá đất đang giữ, "bắt đáy" đất đang thế chấp của đối thủ |
  | Tổ trưởng dân phố | miễn phí gửi xe Phố cổ, "họp tổ" thu tiền góp của cả xóm |

  Trong ván, nút **Nhân vật** cho xem lại nội tại, điểm yếu, kỹ năng của mọi người (đúng con số của bàn và số người đang chơi) và kỹ năng của ai đang hồi.

  Tỉ lệ thắng được cân bằng bằng mô phỏng hàng trăm nghìn ván bot cho mọi cỡ bàn 2–8 người: mỗi nhân vật lệch không quá khoảng ±3 điểm % so với mức công bằng (chi tiết trong [`docs/decisions.md`](docs/decisions.md)). Bàn 2–3 người dùng chỉ số riêng cho vài nhân vật.
- **81 lá thẻ**: Cơ hội, Cộng đồng và bộ Hanoi Event, có thẻ tác động cả bàn, thẻ ⏳ kéo dài một vòng, thẻ theo xu hướng (Nghị định 168, AQI, pickleball, concert Mỹ Đình…) và thẻ gắn với từng nhân vật (công an phường triệt phá sòng tài xỉu, VN-Index lập đỉnh, mùa sửa nhà…).
- **Hai chế độ**: Truyền thống (người cuối cùng không phá sản thắng) và Nhanh (chia đất đầu ván, tài sản cao nhất khi hết 60 phút thắng). Bàn đông người nên chơi chế độ Nhanh.
- **Chơi theo đội** (2–4 đội: Rồng, Phượng, Lân, Quy): đồng đội không thu tiền thuê của nhau, thẻ và kỹ năng chỉ nhắm vào đội khác, lượt đi xen kẽ giữa các đội, đội cuối cùng còn trụ thắng.
- **Bốc thăm nhân vật**: chủ phòng có thể để máy bốc ngẫu nhiên nhân vật cho cả bàn. Khi chọn lần lượt, người đến lượt cũng có nút chọn ngẫu nhiên.
- **Giá đất và tiền thuê được tính lại theo tần suất dừng chân** bằng mô phỏng bot cho từng bàn, để không nhóm màu nào là "đất chết". Nhóm 2 ô cuối bàn là đất vàng: thu thuê cao nhất nhưng xây nhà đắt. Đất đã có chủ được cắm cờ màu người chủ.
- **Hướng dẫn người mới (bật/tắt được)**: 28 mẹo hiện dần đúng lúc trong ván — lần đầu mua đất, trả tiền thuê, rút thẻ, vào Bãi giữ xe, đủ nhóm màu thì chỉ nút Tài sản để xây nhà, thiếu 1 ô thì gợi ý Giao dịch, sắp hết tiền thì giải thích thế chấp… Nút được nhắc tới sẽ nhấp nháy. Người bật hướng dẫn có dấu 🎓 cạnh tên và thêm vài giây cho mỗi quyết định.
- **Chơi online**: mua đất, đấu giá, xây nhà, thế chấp, giao dịch. Mỗi quyết định có đồng hồ đếm ngược. Người mất kết nối được bot chơi thay và có thể quay lại bất cứ lúc nào, kể cả khi tải lại trang. Có khán giả và chat.
- **Phong cách Đông Hồ, kết hợp 2D và 3D**: bàn cờ 2D, nhân vật và nhà cửa 3D đứng trên bàn (nhà mang màu người chủ), xúc xắc 3D, mô hình 3D hiện lên khi mua đất (mảnh đất trống cắm cờ) hoặc xây nhà. Có âm thanh (xúc xắc trong bát, còi CSGT, chuông xe đạp, trống hội…), chơi được trên điện thoại.

## Công nghệ

Monorepo TypeScript (pnpm workspaces):

| Package | Vai trò |
| --- | --- |
| [`packages/engine`](packages/engine) | Rules engine thuần TypeScript: `applyAction(state, action) → { state, events }`, RNG có seed, bot |
| [`packages/server`](packages/server) | Server [Colyseus](https://colyseus.io) 0.16: phòng, mã mời, đồng hồ, bot thay người; phục vụ luôn bản build của client |
| [`packages/client`](packages/client) | React 18 + Vite, chữ tiếng Việt gom trong `src/i18n/vi.ts`, hình SVG kiểu Đông Hồ, lớp 3D bằng three.js |
| [`packages/sim`](packages/sim) | CLI cho bot đấu với nhau để cân bằng nhân vật (chọn bàn, số người, nhóm nhân vật, thử số liệu khác) |

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
npx -y pnpm@9.15.0 sim -- --games 10000 --players 8 --board large   # bàn 56 ô; thêm --pool C01,C02,… hoặc --patch file.json để thử
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
