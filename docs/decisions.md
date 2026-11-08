# Quyết định làm rõ GDD

Chốt ngày 2026-11-09 (dùng toàn bộ phương án mặc định). Engine cài đặt đúng theo bảng này; GDD vẫn là nguồn cho ý đồ, JSON là nguồn cho con số.

## A. Lượt và xúc xắc
1. Nộp 50 ra Bãi giữ xe rồi tung đôi → được tung tiếp như lượt thường. Ra bằng tung đôi → không tung thêm.
2. Vào Bãi giữ xe giữa lượt (thẻ, ô 30) → lượt kết thúc, mất quyền tung đôi.
3. EV05: người đã ra Bãi giữ xe bằng nộp phạt/CH11/kỹ năng tung 1 viên; chỉ lần tung thử ra đôi dùng 2 viên.
4. Thuê tiện ích = hệ số × tổng xúc xắc thật (trước ±1 của Grab); dưới EV05 là 1 viên. CH08 luôn tung mới 2 viên.

## B. Tiền thuê
5. Hệ số ⏳ theo nhóm áp lên mọi mức thuê (đất trống, nhà, khách sạn).
6. Ăn vạ: hỏi mỗi lần trả thuê (cả giao thông, tiện ích); không áp cho khoản "trả chủ ô" từ thẻ.
7. Thưởng Idol chỉ trên tiền thuê dừng chân (kể cả do CH06/CH08); thuê = 0 thì không có tối thiểu 10.
8. Bóc phốt chỉ chặn tiền thuê, không chặn khoản thẻ EV07/11/20.

## C. Thẻ và Quỹ
9. Ô liên quan chưa có chủ (EV07/11/20) → tiền vào Quỹ (nếu bật).
10. Idol ×1,5 mọi khoản thẻ trực tiếp bắt trả (kể cả EV18, EV10 thành 15% rồi làm tròn xuống chục); không áp cho tiền thuê do thẻ đưa tới. Làm tròn lên.
11. EV14 và EV29 cùng hiệu lực → thẻ rút sau cùng thắng.
12. Đất thế chấp vẫn tính ở các thẻ "ngân hàng trả chủ" và "chủ trả".
13. Người kích hoạt ⏳ phá sản → hiệu ứng hết hạn ngay.
14. CH17 từ ô 22 vòng qua ô 0 → nhận lương rồi nhận Quỹ.
15. Nhiều người cùng thiếu tiền → xử lý lần lượt theo thứ tự lượt, bắt đầu từ người đang đi.

## D. Nhân vật
16. Bố ơi cứu con: tự động, sau khi đã thanh lý hết; chỉ dùng nếu khoản thiếu ≤ 400, không thì phá sản như thường.
17. Grab: vòng tính từ đầu ván, làm mới khi qua/dừng ô 0 (kể cả do thẻ); ±1 và tung lại dùng được trong Bãi giữ xe; đôi tính theo kết quả mới; ±1 không tạo/mất đôi.
18. Nghiện Tarot (tên theo JSON): ô cấm không mua, không đấu giá, không nhận qua giao dịch; nhận qua phá sản → về ngân hàng đấu giá.
19. Giải hạn: hỏi khi lật thẻ EV có thể gây hại cho Tarot; hủy toàn bộ phần liên quan Tarot (không trả, không nhận; ⏳ miễn hạn chế, hệ số thuê không áp khi Tarot trả hoặc là chủ). *Bổ sung khi code:* không hỏi với thẻ chỉ có lợi (EV01, EV04, EV14, EV22, EV31 dự phòng, EV07 khi Tarot là chủ…).
20. Tốt nghiệp: lần nhận lương thứ 5 đã là 250; mọi lần nhận lương đều tính.
21. Cò đất: không hoa hồng khi chia đất đầu ván chế độ Nhanh; có khi đấu giá đất người phá sản.
22. Ninja: phí 30 trả cả khi là chủ, cộng dồn EV18; Ăn vạ không giảm phí.

## E. Xây, thế chấp, giao dịch, chế độ Nhanh
23. Không giao dịch ô nào trong nhóm đang có nhà.
24. Lãi khi nhận đất thế chấp (giao dịch/phá sản) chịu EV14/EV29.
25. Nhanh: khách sạn = 3 nhà + 1 lần giá xây (trả 3 nhà về kho), tính tài sản = 4 × giá xây; Cò đất tối đa 3 nhà.
26. Nhanh: chia đất trả đúng giá in, không giảm giá nhân vật.
27. Tung tin quy hoạch nhân dồn với ×2 đủ nhóm và EV08.

## Quyết định kỹ thuật
- Engine không giữ đồng hồ: server gửi `timeout` (áp mặc định của quyết định đang chờ), `closeAuction`, `cancelTrade`, `endGame`.
- Thứ tự lượt và chọn nhân vật thuộc lobby; engine nhận người chơi theo thứ tự lượt (có helper `rollTurnOrder`).
- Tự thanh lý khi hết giờ: bán nhà rồi thế chấp, nhóm rẻ nhất trước, dừng khi đủ tiền.
- Bán khách sạn khi kho thiếu nhà: hạ xuống số nhà còn trong kho (có thể về 0), hoàn 50% cho mỗi cấp bị bỏ.

## Cân bằng nhân vật (mô phỏng, 2026-11-09)

Mỗi phương án chạy 10.000 ván × 3 cấu hình (Truyền thống 4 người, Nhanh 4 người, Truyền thống 2–6 người), số là điểm % lệch so với tỉ lệ thắng công bằng.

| Phương án | Grab (TT4 / N4 / 2–6) | SVBK (TT4 / N4 / 2–6) |
| --- | --- | --- |
| Bản nháp | +24,6 / +10,5 / +25,9 | −6,5 / −8,8 / −4,8 |
| Grab lương 100 + bắt đầu 1.400 | −0,2 / −13,2 / +1,3 | — |
| Grab chỉ được +1 | +11,1 / +0,9 / +9,5 | — |
| Grab trả phí 20–40 mỗi lần chỉnh | +21 → +24 (mạnh hơn: bot để dành để né thuê) | — |
| Grab tối đa 2 lần/ván + SVBK 1.400 | −0,1 / −3,7 → −4,5 / −1,7 | +1,6 / +0,4 / +3,3 |
| **Chọn: Grab tối đa 3 lần/ván + SVBK 1.400** | **+2,1 / −0,7 / +1,7** (seed 2: +3,2 / −2,5 / +0,3) | **+1,3 / −0,5 / +2,5** (seed 2: −0,4 / −0,3 / +1,6) |

- Bản nháp đo bằng bot đã có ngưỡng "chỉ chỉnh ±1 khi lợi ít nhất 25"; bot cũ chỉnh cả khi lợi rất nhỏ nên Grab chỉ +11.
- Lương thấp làm Grab yếu hẳn ở chế độ Nhanh mà vẫn mạnh ở Truyền thống, vì lợi thế né thuê tích lũy theo độ dài ván. Giới hạn số lần mỗi ván chặn đúng chỗ đó.
- `adjust_roll` có thêm các trường tùy chọn `maxUses`, `directions`, `cost` (engine đọc từ JSON).
- Còn lại: Grab ở Truyền thống 4 người dao động +2,1 đến +3,2 giữa hai seed (sai số ±1,3), sát mép ngưỡng.

## Server (Bước 3)

- Colyseus dòng 0.16 (`@colyseus/core` 0.16.26, client `colyseus.js` 0.16.22 — bản client mới nhất hiện vẫn là 0.16). Không dùng Schema: server gửi state công khai (`publicView`) qua message `game`; thứ tự bộ bài, RNG và seed không bao giờ gửi cho client (seed lộ ra khi hết ván để phát lại).
- Mã phòng 6 ký tự, bỏ I, O, 0, 1. Phòng private: chỉ vào bằng mã / link mời.
- Đồng hồ không ghi trong GDD: Grab ±1 / tung lại, Tarot chọn thẻ, Ăn vạ, Giải hạn, nhận đất thế chấp → dùng chung 20 giây như quyết định mua (`buyDecisionSec`).
- Đấu giá: 10 giây khi chưa ai trả; mỗi giá mới đặt lại đồng hồ còn 5 giây.
- Treo máy: một lượt bị tính "hết giờ" khi đồng hồ của chính người đó chạy hết trong lượt của họ; 3 lượt liên tiếp → bot đến hết ván, người chơi không lấy lại được.
- Mất kết nối: giữ chỗ vô thời hạn; sau 60 giây bot chơi thay; vào lại thì lấy lại quyền. Bấm rời phòng giữa ván → bot thay ngay, không quay lại được.
- Phòng chờ: mất kết nối giữ chỗ 20 giây. Người vào khi ván đã bắt đầu → làm khán giả (nếu cho phép).
- *Bổ sung:* ván đang chạy mà không còn ai kết nối (kể cả khán giả) trong 10 phút → kết thúc, xếp hạng theo tài sản. Không có điều này, ván toàn bot ở chế độ Truyền thống có thể chạy mãi.
- Lỗi gửi client là mã (`NOT_HOST`, `RULE`…); chữ tiếng Việt do client hiển thị. Chat tối đa 200 ký tự, 1 tin / 0,5 giây.
- Nhật ký ván (seed + mọi action) ghi ra `LOG_DIR` nếu đặt biến môi trường; `replay(log)` dựng lại state cuối.

## Client (Bước 4)

- Bàn cờ: Cửa Ô ở góc dưới trái, đi ngược chiều kim đồng hồ trên màn hình (dọc cạnh dưới sang phải, lên cạnh phải, sang trái cạnh trên, xuống cạnh trái).
- Mô tả thẻ và nhân vật sinh tự động từ `effect.type` + số trong JSON, nên chỉnh số liệu không phải sửa chữ.
- Giao diện là bản chức năng dùng bảng màu §8.2; tranh Đông Hồ, font tiêu đề, âm thanh để Bước 5.
- Mobile: bàn cờ rộng hết màn hình, các panel xếp dưới (chưa có ngăn kéo kéo lên / zoom bàn cờ — để Bước 5).
- *Bổ sung server:* nút "Chơi lại" (chủ phòng) đưa phòng về phòng chờ với những người còn kết nối; `gameOver` kèm thống kê tiền thuê (đã trả, đã thu, theo ô) cho S9.
- Token nối lại lưu theo tab (`sessionStorage`): tải lại trang thì vào lại ván; mở tab mới là người khác.

## Đồ họa & âm thanh (Bước 5)

- Minh họa Đông Hồ vẽ bằng SVG ngay trong code (`packages/client/src/art/`): nét mực dày, màu đất phẳng, nét gạch kiểu khắc gỗ. 28 hình cho 40 ô (một số BĐS dùng chung hình theo loại: ven đô, quận, tòa tháp, khu đô thị…; Hồ Gươm, Hồ Tây, Phố cổ, Long Biên, Mỹ Đình, Ba Đình, Đống Đa, Văn Miếu, Cửa Ô có hình riêng), 8 chân dung nhân vật làm quân cờ, nhà ống mái ngói, khách sạn cao tầng, mặt sau 3 bộ thẻ (Cơ hội đỏ son, Cộng đồng vàng nghệ, Event xanh chàm họa tiết trống đồng). Họa sĩ có thể thay từng hình theo tên khóa (`TILE_ART`, `AVATARS`) mà không đụng code game.
- Font tiêu đề tạm chọn **Playfair Display** (có chân, tương phản nét kiểu bút lông, đủ dấu tiếng Việt). Đổi ở biến `--font-title` trong `styles.css`. Mục "Chọn font tiêu đề" trong GDD vẫn để bạn quyết.
- Âm thanh tổng hợp bằng Web Audio (không cần file): xúc xắc trong bát, còi CSGT, chuông xe đạp, "ting ting", trống hội, pháo hoa; thêm tiếng lật thẻ và tiếng gõ mõ khi đến lượt mình. Nút tắt tiếng nhớ lựa chọn. Trình duyệt chỉ phát sau lần bấm đầu tiên.
- Mobile: bàn cờ phóng to / thu nhỏ (1×–2,5×, cuộn được), panel người chơi / nhật ký / chat thành ngăn kéo bên dưới.
- Tôn trọng `prefers-reduced-motion` (tắt hoạt ảnh).
