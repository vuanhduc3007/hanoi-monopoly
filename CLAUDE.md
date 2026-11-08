# Hanoi Monopoly — hướng dẫn cho Claude Code

Game Cờ Tỷ Phú phiên bản Hà Nội, chơi online nhiều người trên web (2–6 người/phòng).

## Nguồn sự thật

- `docs/GDD.md` — Game Design Document đầy đủ (luật, thẻ, nhân vật, UI). Đọc trước khi code bất cứ phần nào.
- `data/*.json` — toàn bộ số liệu game. **Không hard-code số liệu trong logic**; luôn đọc từ JSON.
  - `board.json`: 40 ô, 8 nhóm màu, 22 BĐS, 4 giao thông, 2 tiện ích
  - `economy.json`: tiền khởi đầu, lương, thuế, phạt, thế chấp, đấu giá
  - `cards.json`: 17 Cơ hội, 16 Cộng đồng, 32 Hanoi Event (mỗi thẻ có `effect.type`)
  - `characters.json`: 8 nhân vật (passives, drawbacks, skill)
  - `config.json`: cấu hình phòng, đồng hồ, chế độ Nhanh, Quỹ khuyến học
- Nếu GDD và JSON lệch nhau: JSON quyết định con số, GDD quyết định ý đồ. Gặp chỗ mơ hồ thì hỏi tôi, đừng tự đoán.

## Công nghệ

- TypeScript toàn bộ, monorepo (pnpm workspaces):
  - `packages/engine` — rules engine thuần TS, không phụ thuộc mạng/UI
  - `packages/server` — Colyseus game server
  - `packages/client` — React + Vite
  - `packages/sim` — CLI mô phỏng bot để cân bằng
- Server-authoritative: xúc xắc, xáo bài, tính tiền chỉ chạy trên server. Client chỉ gửi action và hiển thị.
- RNG có seed, ghi seed vào log để phát lại ván.
- Test: Vitest. Mỗi `effect.type` của thẻ và mỗi hook nhân vật phải có unit test.

## Nguyên tắc engine

- Hàm thuần: `applyAction(state, action) → { state, events }`.
- Hook: `onTurnStart`, `onPassGo`, `onLand`, `onPayRent`, `onDrawCard`, `onBankrupt`.
- Hiệu ứng ⏳ hết hạn khi người kích hoạt bắt đầu lượt kế tiếp của họ.
- Thứ tự tính tiền thuê: cơ bản → x2 đủ nhóm → hệ số thẻ ⏳ → kỹ năng giảm (Ăn vạ) → làm tròn lên.
- Tiền là số nguyên. Phần trăm làm tròn lên, trừ Thanh tra thuế (làm tròn xuống hàng chục).
- Xây/bán nhà/thế chấp chỉ trong lượt của mình; đề nghị giao dịch gửi được bất cứ lúc nào.

## Lộ trình

1. Engine + test (chưa có UI, chưa có mạng)
2. Sim CLI: bot vs bot, báo cáo tỉ lệ thắng theo nhân vật
3. Colyseus server: phòng, mã mời, đồng hồ, mất kết nối → bot
4. React client: Bàn cờ (S4) → quyết định (S6) → giao dịch (S7) → tài sản (S8) → lobby (S1–S3) → kết thúc (S9)
5. Đồ họa Đông Hồ + âm thanh

Làm xong mỗi bước thì dừng, tóm tắt, và chờ tôi duyệt trước khi sang bước tiếp.

## Quy ước

- Code, tên biến, commit: tiếng Anh. Text hiển thị cho người chơi: tiếng Việt, gom vào `packages/client/src/i18n/vi.ts`.
- ID cố định theo GDD: P01–P22, T01–T04, U01–U02, CH01–CH17, CD01–CD16, EV01–EV32, C01–C08.
