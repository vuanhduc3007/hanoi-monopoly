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

- Bàn cờ (đổi theo góp ý người chơi, thay cho "ngược chiều kim đồng hồ" ở GDD §2): ô xuất phát ở góc dưới phải, đi sang trái dọc cạnh dưới, lên cạnh trái, sang phải cạnh trên, xuống cạnh phải — bố cục quen thuộc của cờ tỷ phú. Thứ tự ô và luật không đổi.
- Mô tả thẻ và nhân vật sinh tự động từ `effect.type` + số trong JSON, nên chỉnh số liệu không phải sửa chữ.
- Giao diện là bản chức năng dùng bảng màu §8.2; tranh Đông Hồ, font tiêu đề, âm thanh để Bước 5.
- Mobile: bàn cờ rộng hết màn hình, các panel xếp dưới (chưa có ngăn kéo kéo lên / zoom bàn cờ — để Bước 5).
- *Bổ sung server:* nút "Chơi lại" (chủ phòng) đưa phòng về phòng chờ với những người còn kết nối; `gameOver` kèm thống kê tiền thuê (đã trả, đã thu, theo ô) cho S9.
- Token nối lại lưu theo tab (`sessionStorage`): tải lại trang thì vào lại ván; mở tab mới là người khác.

## Đồ họa & âm thanh (Bước 5)

- Minh họa Đông Hồ vẽ bằng SVG ngay trong code (`packages/client/src/art/`): nét mực dày, màu đất phẳng, nét gạch kiểu khắc gỗ. 28 hình cho 40 ô (một số BĐS dùng chung hình theo loại: ven đô, quận, tòa tháp, khu đô thị…; Hồ Gươm, Hồ Tây, Phố cổ, Long Biên, Mỹ Đình, Ba Đình, Đống Đa, Văn Miếu, ô xuất phát có hình riêng), 8 chân dung nhân vật làm quân cờ, nhà ống mái ngói, khách sạn cao tầng, mặt sau 3 bộ thẻ (Cơ hội đỏ son, Cộng đồng vàng nghệ, Event xanh chàm họa tiết trống đồng). Họa sĩ có thể thay từng hình theo tên khóa (`TILE_ART`, `AVATARS`) mà không đụng code game.
- Font tiêu đề tạm chọn **Playfair Display** (có chân, tương phản nét kiểu bút lông, đủ dấu tiếng Việt). Đổi ở biến `--font-title` trong `styles.css`. Mục "Chọn font tiêu đề" trong GDD vẫn để bạn quyết.
- Âm thanh tổng hợp bằng Web Audio (không cần file): xúc xắc trong bát, còi CSGT, chuông xe đạp, "ting ting", trống hội, pháo hoa; thêm tiếng lật thẻ và tiếng gõ mõ khi đến lượt mình. Nút tắt tiếng nhớ lựa chọn. Trình duyệt chỉ phát sau lần bấm đầu tiên.
- Mobile: bàn cờ phóng to / thu nhỏ (1×–2,5×, cuộn được), panel người chơi / nhật ký / chat thành ngăn kéo bên dưới.
- Tôn trọng `prefers-reduced-motion` (tắt hoạt ảnh).

## 2D + 3D (góp ý sau khi chơi thử)

- Bàn cờ, thẻ, bảng điều khiển vẫn là 2D. Một lớp WebGL (three.js 0.170) trong suốt phủ lên bàn cờ, vẽ **nhân vật 3D** và **nhà / khách sạn 3D** đứng đúng trên ô (vị trí lấy từ ô 2D, chiếu xuống mặt phẳng nhìn nghiêng 55°).
- Nhân vật 3D low-poly kiểu Đông Hồ (tô màu phẳng + viền mực), mỗi người một phụ kiện: vương miện (Vin), mũ bảo hiểm đỏ + khẩu trang (Ninja), mũ xanh (Grab), điện thoại (Idol), cờ (Cò đất), mũ chóp tím (Tarot), mũ tốt nghiệp (SVBK), cặp táp (Nô lệ tư bản). Đế quân mang màu người chơi.
- Dễ nhận ra quân của mình: quân của bạn to hơn, có mũi tên + nhãn "BẠN" lơ lửng; người đang đến lượt có vòng vàng nhấp nháy; quân nhảy từng ô theo đường đi (vào tù / thẻ đi xa thì nhảy thẳng).
- Mua đất / xây nhà / lên khách sạn: bảng nổi giữa bàn với mô hình 3D xoay (mảnh đất có nhà + cờ màu người mua, nhà ống, tòa cao tầng) trong khoảng 2,4 giây; nhà trên bàn mọc lên có hiệu ứng nảy.
- Màn hình chọn nhân vật có xem trước nhân vật 3D.
- Máy không có WebGL: tự dùng lại quân cờ và nhà 2D như trước.

## Góp ý chơi thử lần 2

- **Ô xuất phát** đổi tên thành **Hoàng thành Thăng Long** (thay Cửa Ô Quan Chưởng). Không dùng "Khải Hoàn Môn" vì đang là chuyện thời sự gây tranh cãi. Để không trùng, thẻ CH17 đổi tên thành "Dâng hương Văn Miếu trước kỳ thi" (hiệu ứng giữ nguyên: đi đến Văn Miếu); CH02, CD15 đổi "Cửa Ô" → "Hoàng thành".
- **Chọn nhân vật**: tối đa 10 phút mỗi người (`characters.json` → `pickTimerSec: 600`). Người mất kết nối / bot vẫn chọn ngay.
- **Rút thẻ có bước lật** (thay đổi so với GDD 4.5 "thực hiện ngay"): thẻ rút ra úp giữa bàn, người rút bấm để lật, hết 8 giây thì tự lật (`config.json` → `revealCardSec`). Hiệu ứng thẻ chỉ áp dụng sau khi lật; lá bài úp không gửi cho client nào. Nghiện Tarot vẫn rút 2 chọn 1 (đó là bước tương tác của Tarot).
- **Trả tiền thuê bằng nút** (thay đổi so với GDD 4.4 "thu tự động"): dừng ở đất người khác thì hiện nút "Trả tiền"; hết 15 giây tự trả (`payRentSec`). Ăn vạ của Ninja Lead nằm ngay trong bước này.
- **Hoạt cảnh**: xúc xắc 3D rơi giữa bàn (~1,1 giây) rồi quân mới đi; quân đi đủ đường (kể cả khi thẻ đưa đi); vào ô CSGT thổi còi thì đi tới ô 30, dừng với đèn còi xanh đỏ + bảng "CSGT thổi còi!" + tiếng còi, rồi mới bị đưa sang Bãi giữ xe. Nút quyết định, thẻ, bảng mua nhà chỉ hiện khi quân đã tới nơi.
- **Tiền thay đổi**: số "−… tỷ" (đỏ) / "+… tỷ" (xanh) kèm tên người và lý do bay lên trên quân cờ, và hiện cạnh tiền trong danh sách người chơi (dòng người bị trừ rung nhẹ).
- **Xây nhà**: cửa sổ Tài sản có mục "Khi nào được xây nhà?" và ghi lý do từng ô chưa xây được (engine `whyCantBuild`).

## Góp ý chơi thử lần 3

- **Xúc xắc bị lệch**: lỗi ghép phép quay — xoay ngang và xoay lật mặt nằm chung một Euler làm mặt 2 và 5 bị nghiêng, nhìn thấy số khác. Giờ tách hai lớp (ngoài chỉ xoay ngang, trong chỉ lật mặt), có test cho mọi mặt × mọi góc. Thêm dòng chữ lớn "X tung 3 + 4 = 7" (và "Đôi! Được tung tiếp"); xúc xắc tự biến mất sau ~3 giây để không lẫn với lượt sau.
- **Thời gian suy nghĩ**: mở **Tài sản** → đồng hồ của người đang phải quyết định được cộng thêm 2 phút (`assetsExtraSec`, một lần mỗi quyết định). Mở **Giao dịch** → đồng hồ đó tạm dừng cho đến khi đóng cửa sổ; đề nghị giao dịch gửi tới người đang mở Giao dịch cũng không tự hủy.
- **Tải lại trang bị văng ra**: trên Render, proxy chưa báo socket cũ đã đóng nên server từ chối nối lại bằng token. Mỗi tab giờ có một mã bí mật (chỉ server biết); tải lại trang thì vào lại phòng bằng mã đó, server trả lại đúng chỗ ngồi (kể cả khi bot đang chơi thay vì mất kết nối) và đóng kết nối cũ. Mở tab mới vẫn là người chơi mới.
- **Vào lại được nhưng bot vẫn chơi** (thay đổi so với GDD 7.2 "treo máy → bot đến hết ván"): nếu kết nối cũ bị kẹt hoặc trang văng ra, server vẫn tưởng người chơi đang ngồi, lượt của họ hết giờ liên tiếp nên bị tính là treo máy và bot nhận chỗ vĩnh viễn. Giờ chính người đó quay lại (vào lại bằng mã bí mật, bấm bất kỳ nút nào, hoặc nút "Tôi chơi tiếp" ở bảng quyết định) thì lấy lại quyền điều khiển, dù bot thay vì mất kết nối, treo máy hay đã bấm Rời phòng. Khi vắng mặt, bot vẫn chơi thay như cũ.
- **Nhà / khách sạn mang màu chủ đất**: mái nhà ống và thân tòa cao tầng (3D lẫn 2D dự phòng) theo màu người chơi, giống dấu chủ đất trên ô.

## Bàn cờ mở rộng 48 ô (cho 5–6 người)

- **Vì sao**: đo 400 ván bot/số người trên bàn 40 ô — 6 người chỉ có 4,7 ô sở hữu/người, bàn bán hết sau ~20 vòng, chỉ 53% ván có ai gom đủ nhóm. Bàn 48 ô có 35 ô sở hữu (5,8/người ở 6 người).
- **Dữ liệu**: `data/board-extended.json` (bàn 40 ô `board.json` giữ nguyên). Góc ở 0 / 12 / 24 / 36. Thêm 2 nhóm màu: **Xanh ngọc** (P23 Linh Đàm, P24 Văn Quán, P25 Nghĩa Đô — sau Nâu/Xanh nhạt) và **Tím** (P26 Khu đô thị Ciputra, P27 Tây Hồ Tây, P28 Làng đào Nhật Tân — sau CSGT, trước Xanh đậm); giao thông thứ 5 **T05 Metro Nhổn – Ga Hà Nội**; thêm 1 ô Cộng đồng (ô 39). Bản đầu thêm ô Hanoi Event thứ 3, nhưng mô phỏng cho thấy nhiều sự kiện làm Nghiện Tarot quá mạnh (+3,4 đ%) và Thiếu gia Vin quá yếu (dính EV10 nhiều hơn).
- **Kinh tế riêng của bàn** (khối `economy` trong file bàn, ghi đè `economy.json`): thuê giao thông 5 mức `25/50/90/150/220`; kho nhà 40 nhà / 15 khách sạn; **lương +40** (`goSalaryBonus`) cộng *thêm* vào mọi mức lương, kể cả lương riêng của nhân vật — nếu đặt thẳng lương 240 thì "lương 250" của Thiếu gia Vin gần như mất tác dụng (mô phỏng: −4,4 đ%).
- **Thẻ di chuyển** giờ ghi ô đích bằng mã (`"tile": "P22"`) thay vì số thứ tự, nên một bộ thẻ dùng được cho cả hai bàn.
- **Chọn bàn trong phòng chờ**: Tự động (mặc định — 48 ô khi có từ `extendedBoardFromPlayers` = 5 người lúc bắt đầu) / Tiêu chuẩn 40 ô / Mở rộng 48 ô. Bàn được ghi vào `config.board` của ván (log phát lại dùng đúng bàn).
- **Mô phỏng** (`--board extended`, 6.000 ván, 6 người): mọi nhân vật trong ±3 đ% trừ Thiếu gia Vin −3,1; ván kết thúc bằng phá sản 43% (bàn 40 ô: 34%). Người đi đầu thắng 27,5% (bàn 40 ô: 24%).

## Kỹ năng hồi lại (thay đổi so với GDD: "mỗi kỹ năng 1 lần/ván")

- **Luật**: dùng kỹ năng xong, kỹ năng hồi lại sau **3 lượt của chính người đó** (`characters.json` → `rules.skillCooldownRounds: 3`; đặt 0 là quay về 1 lần/ván). Kỹ năng có thể đặt thời gian hồi riêng (`skill.cooldownRounds`) hoặc không hồi (`skill.recharge: false`). Đếm lùi ở đầu mỗi lượt của người đó (lượt trong Bãi giữ xe cũng tính); hồi xong có dòng nhật ký "… hồi kỹ năng …". Bảng quyết định hiện "hồi lại sau N lượt nữa".
- **Mô phỏng** (`--patch {"rules":{"skillCooldownRounds":N}}`, 6.000 ván/ô, 4 người 40 ô và 6 người 48 ô): cho hồi đồng loạt sau 3 lượt mà không chỉnh gì thì Tài xế Grab +8,5 đ% (tung lại quá thường xuyên), Idol TikTok +4,7, còn Nghiện Tarot −5,3, Nô lệ tư bản −4,7 và hai nhân vật có kỹ năng không "dùng" được (Thiếu gia Vin, SVBK) tụt lại. Ván cũng dài hơn ~15%.
- **Cân bằng lại** (đã đưa vào `characters.json`):

| Nhân vật | Thay đổi |
|---|---|
| C01 Thiếu gia Vin | lương 250 → **260**; giảm giá Vinhomes/Vincom 20% → **30%**; Bố ơi cứu con tối đa 400 → **500**, hồi sau **4** lượt |
| C02 Ninja Lead | Ăn vạ hồi sau **4** lượt |
| C03 Tài xế Grab | ±1 bước tối đa 3 → **2** lần/ván; Chạy cuốc đêm hồi sau **6** lượt |
| C04 Idol TikTok | Bóc phốt hồi sau **5** lượt |
| C05 Cò đất | Tung tin quy hoạch hồi sau 3 lượt (mặc định) |
| C06 Nghiện Tarot | Giải hạn hồi sau **2** lượt; đất cấm bỏ Hồ Tây (P20), còn P08, P14 |
| C07 SVBK | Tốt nghiệp sau **4** lần qua Hoàng thành (từ 5), lương lên **260**; không hồi (tự kích hoạt) |
| C08 Nô lệ tư bản | tiền khởi đầu 1.600 → **1.750**; Xin nghỉ phép hồi sau 3 lượt |

- **Kết quả** (10.000 ván mỗi cấu hình, lệch tỉ lệ thắng, đ%): 4 người 40 ô — Vin +0,2, Ninja +2,0, Grab +1,9, TikTok +1,4, Cò đất +0,8, Tarot −2,9, SVBK −2,1, Nô lệ −1,5. 6 người 48 ô — tất cả trong ±2,5 **trừ Thiếu gia Vin −4,4**. Vin yếu riêng trên bàn 48 ô vì dựa vào lương mà vòng bàn dài hơn; bỏ thuế 300 của Vin trên bàn này kéo lên ~+1,3 đ% — cần anh/chị quyết định có cho nhân vật luật riêng theo bàn hay không.
