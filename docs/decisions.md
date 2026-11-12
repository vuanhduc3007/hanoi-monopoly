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

## 4 nhân vật mới, bàn 56 ô cho 8 người, cân bằng lại toàn bộ

### Nhân vật mới (C09–C12)

- **C09 Con bạc** — tài xỉu dùng **3 xúc xắc riêng** (không đụng xúc xắc đi quân): 11–17 Tài, 4–10 Xỉu, ba mặt giống nhau = **bão**.
  - Nội tại *Liều ăn nhiều* (`gamble_payment`): khi mua đất của ngân hàng, nộp thuế, phạt Bãi giữ xe hoặc tiền thẻ (từ 50 tỷ) được chọn chơi: thắng trả bớt 30%, thua trả thêm 40% (phạt cao hơn thưởng như ý tưởng gốc), ra bão khỏi trả. Xác suất thắng 48,6% → trung bình đắt hơn ~2%, chủ yếu là may rủi. Mua đất chỉ được cược khi đủ tiền nếu thua. Không áp dụng cho tiền thuê.
  - Kỹ năng *Mở sòng* (`host_sicbo`): mọi đối thủ đặt Tài/Xỉu **cùng lúc** (chung một đồng hồ; hết giờ ai chưa đặt thì chọn ngẫu nhiên — trước đây đặt lần lượt từng người, bàn đông phải chờ lâu), Con bạc làm nhà cái; người thắng nhận 80% tiền cược, bão nhà cái ăn hết. Tổng tiền cược cố định **240 tỷ chia đều** (làm tròn lên hàng chục) — nếu mỗi người cược cố định thì bàn 8 người mạnh gấp đôi bàn 4 người (+10 đ%).
  - Điểm yếu: bắt đầu 1.400 tỷ.
- **C10 Thợ xây** — xây rẻ hơn 25%; *Tự tay xây* (`free_build`): xây 1 nhà miễn phí, được xây **"nhà chui"** (1 nhà) lên ô chưa đủ nhóm màu, tối đa 1 căn cùng lúc; bắt đầu 1.450 tỷ. Không giới hạn số nhà chui thì quá mạnh (+20 đ% ở bàn 6–8 người, vì cuối ván ô nào cũng có nhà).
  - Vì nhà chui, một nhóm màu có thể chia nhiều chủ mà có nhà: luật *"bán hết nhà trong nhóm trước khi thế chấp / giao dịch"* giờ chỉ xét **nhà của chính người đó** trong nhóm.
- **C11 F0 chứng khoán** — *cổ tức* 2% giá đất đang giữ (trừ đất thế chấp) mỗi lần qua Hoàng thành; *Bắt đáy* (`buy_mortgaged`): mua ngay 1 ô đối thủ đang thế chấp, trả họ giá thế chấp +10%, ô vẫn thế chấp; điểm yếu: tiền thẻ ×1,3.
- **C12 Tổ trưởng dân phố** — miễn Phí gửi xe Phố cổ; *Họp tổ dân phố* (`collect_contribution`): các đối thủ góp tổng 20 tỷ cho tổ trưởng và 20 tỷ vào Quỹ (chia đều); điểm yếu: mỗi lần qua Hoàng thành góp 20 tỷ vào Quỹ.

### Bàn đại 56 ô (7–8 người)

- Thử bàn lục giác 60 ô trước, nhưng ô quá nhỏ và người chơi quen bàn vuông nên đổi sang **bàn vuông 56 ô** (`data/board-large.json`, mỗi cạnh 13 ô, góc ở 0 / 14 / 28 / 42).
- 41 ô sở hữu: thêm nhóm **Bạc** (P29 Phố Tràng Tiền, P30 Nhà hát Lớn, P31 Phố Phan Đình Phùng), nhóm **Mận** (P32 Phố Hàng Ngang, P33 Phố Hàng Đào), giao thông **T06 Bến xe Giáp Bát**; 3 Cơ hội, 3 Cộng đồng, 3 Event, 2 ô thuế. Thêm nhiều ô thẻ hơn làm Nghiện Tarot quá mạnh (+6 đ% ở bản thử 4+4 thẻ).
- Kinh tế riêng: lương ×1,2 (×1,35 cho kết quả cân bằng như nhau nhưng ván dài hơn), thuê giao thông 6 mức, kho 48 nhà / 17 khách sạn. Bàn 48 ô đổi từ "lương +40" sang **lương ×1,2**: lương riêng của nhân vật (Thiếu gia Vin, SVBK, Tài xế Grab) giờ co giãn theo độ dài vòng.
- Mỗi bàn có `maxPlayers` (40 và 48 ô: 6; 56 ô: 8); phòng tối đa 8 người. Chọn bàn Tự động: 2–4 người bàn 40 ô, 5–6 người 48 ô, 7–8 người 56 ô (`config.json` → `room.autoBoardFrom`).

### Thẻ chia theo số người

CH16 (khao cả xóm) và CD10 (sinh nhật) đổi từ "mỗi người 50 / 10" sang **tổng 150 / 30 chia đều** (làm tròn lên hàng chục): bàn 4 người giữ đúng con số cũ, bàn 8 người không còn mất/nhận gấp 2–3 lần.

### Chỉ số theo số người chơi (`byTableSize`)

Bàn 2–3 người chơi khác hẳn (2 người: 99% ván kết thúc bằng phá sản sau ~65 vòng). Ngay cả 8 nhân vật cũ đã lệch ±9 đ% ở bàn 2 người. Mỗi nhân vật có thể có chỉ số riêng cho vài cỡ bàn (`characters.json` → `byTableSize`), màn chọn nhân vật ghi "Chỉ số riêng cho bàn N người". Đang dùng cho bàn 2 và 3 người: Thợ xây (không nhà chui, giảm giá xây ít hơn), Tổ trưởng (góp ít hơn), Tài xế Grab (bỏ/giảm phạt lương), Nghiện Tarot (rút 2 chọn 1 cả Cộng đồng, thêm tiền), F0 (cổ tức 4%), Nô lệ tư bản, Cò đất, Idol TikTok, SVBK, Ninja Lead.

### Cân bằng lại 8 nhân vật cũ

Thiếu gia Vin lương 280, giảm 25% cho cả Vincom Bà Triệu; Nghiện Tarot rút 2 chọn 1 chỉ với Cơ hội, bỏ đất cấm, điểm yếu tiền thẻ ×1,2, Giải hạn hồi sau 3 lượt; Nô lệ tư bản khởi đầu 1.800.

### Kết quả kiểm chứng (seed mới 2026, chưa dùng khi chỉnh)

Lệch tỉ lệ thắng so với mức công bằng, điểm %:

| | 2 người | 3 | 4 | 5 (48 ô) | 6 (48 ô) | 7 (56 ô) | 8 (56 ô) |
|---|---|---|---|---|---|---|---|
| C01 Thiếu gia Vin | +1,9 | +2,2 | +1,0 | −0,4 | −0,7 | −1,3 | −1,9 |
| C02 Ninja Lead | +0,3 | +1,2 | +2,4 | +0,8 | −0,4 | −0,7 | −0,5 |
| C03 Tài xế Grab | +0,8 | −0,6 | +1,5 | +1,1 | +1,0 | −1,2 | −0,8 |
| C04 Idol TikTok | −3,3 | −0,1 | +1,2 | −0,7 | +0,2 | −0,2 | −0,1 |
| C05 Cò đất | +0,6 | −0,5 | +0,8 | +1,2 | −1,2 | +1,6 | +0,4 |
| C06 Nghiện Tarot | −1,7 | −0,7 | −2,5 | −1,5 | +0,5 | +2,0 | +2,1 |
| C07 SVBK | −0,3 | −0,5 | −1,2 | −1,1 | +1,4 | +0,3 | −1,0 |
| C08 Nô lệ tư bản | −2,1 | +0,4 | −0,5 | +0,8 | +0,0 | +0,8 | +1,2 |
| C09 Con bạc | +2,5 | −1,2 | −0,3 | −0,3 | +0,9 | +0,2 | +0,8 |
| C10 Thợ xây | −1,4 | +1,3 | −0,9 | −2,2 | −1,9 | −1,0 | −0,4 |
| C11 F0 chứng khoán | +0,1 | −0,9 | −2,9 | +0,2 | −0,7 | −0,5 | −0,5 |
| C12 Tổ trưởng dân phố | +2,7 | −0,6 | +1,5 | +2,0 | +0,6 | +0,1 | +0,7 |

20.000 ván ở 2–4 người, 15.000 ở 5–6, 12.000 ở 7–8 (bot theo GDD 7.4, nhân vật chia ngẫu nhiên). Tất cả trong ±3,3 đ%. (Cột 7–8 người chạy lại sau khi đổi sang bàn vuông 56 ô.)

### Chưa xử lý (đề xuất)

- **Lợi thế đi trước** lớn và tăng theo số người: người đi đầu thắng 34% ở bàn 4 người (công bằng 25%), 26% ở bàn 8 người (công bằng 12,5%). Có thể bù cho người đi sau (thêm tiền khởi đầu theo thứ tự) — cần anh/chị quyết.
- Ván 8 người kiểu Truyền thống dài (~160 vòng, ~1.280 lượt); nên gợi ý chơi chế độ Nhanh khi đông người.

## Thẻ mới, tiền khởi đầu bàn lớn, bảng nhân vật trong ván

### 16 thẻ mới (65 → 81)

- **Cơ hội**: CH18 theo hội nhóm "lùa gà" chứng khoán (trả 80), CH19 không đội mũ bảo hiểm — Nghị định 168 (trả 60), CH20 chốt lời đúng đỉnh (nhận 100), CH21 săn được vé concert ở Mỹ Đình (đi đến Mỹ Đình).
- **Cộng đồng**: CD17 mua máy lọc không khí (trả 40), CD18 chơi pickleball (trả 30), CD19 clip review quán phở lên xu hướng (nhận 60), CD20 trúng Vietlott giải nhỏ (nhận 50).
- **Hanoi Event gắn với nhân vật**: EV33 công an phường triệt phá sòng tài xỉu (Con bạc nộp 150 vào Quỹ — được chơi tài xỉu với khoản phạt này), EV34 VN-Index lập đỉnh (F0 nhận 150), EV35 F0 bị gọi ký quỹ (F0 trả 120), EV36 mùa sửa nhà cuối năm (chủ nhà trả 15/nhà, 50/khách sạn cho Thợ xây), EV37 tổ dân phố vận động quỹ (mọi người góp 10 cho Tổ trưởng), EV38 KOL bị phạt vì quảng cáo sai sự thật (Idol TikTok trả 100), EV39 AQI vượt 300 (mọi người góp 20 vào Quỹ), EV40 công ty tăng lương cuối năm (Nô lệ tư bản nhận 100). Nhân vật không có trong ván thì thẻ dùng hiệu ứng thay thế (`fallback`).
- Hai loại hiệu ứng mới: `character_pays`, `character_gain`; `repairs_all` có thêm `toCharacter`.

### Tiền khởi đầu theo bàn

Lượng đất mỗi người ở bàn lớn không ít hơn (40 ô/4 người: 1.422 tỷ, 48 ô/6 người: 1.198, 56 ô/8 người: 1.137), nhưng đất bàn lớn đắt hơn và lương về chậm hơn tính theo lượt nên đầu ván mua được ít. `startingCashMultiplier` (làm tròn lên hàng chục, nhân cả tiền khởi đầu riêng của nhân vật): **×1,15 bàn 48 ô, ×1,3 bàn 56 ô** (1.500 → 1.950). Cân bằng nhân vật gần như không đổi, nhưng **lợi thế đi trước giảm rõ**: 8 người 26,5% → 18% (công bằng 12,5%), 6 người 27,8% → 23,6% (16,7%). Ván dài hơn ~6%. Bàn 40 ô giữ nguyên (×1,1 chỉ giảm 33,7% → 32,3%).

### Bảng nhân vật trong ván

Nút **Nhân vật** cạnh Tài sản / Giao dịch: nội tại, điểm yếu, kỹ năng của mọi người trong ván và trạng thái kỹ năng (sẵn sàng / hồi lại sau N lượt), các nhân vật còn lại xếp bên dưới. Con số đúng theo bàn (lương, tiền khởi đầu "trên bàn này") và số người (ghi "Chỉ số riêng cho bàn N người"). Màn chọn nhân vật cũng hiện số theo bàn sẽ chơi.

### Chỉnh thêm sau khi có thẻ mới

Bàn 2 người: Tổ trưởng góp tổng 10 + 10, SVBK tốt nghiệp sau 3 lần lương 280, Idol TikTok thưởng 30% (thẻ ×1,2). Bàn 5 người: Tài xế Grab ±1 bước tối đa 1 lần/ván.

### Kiểm chứng (seed 77)

| | 2 người | 3 | 4 | 5 (48 ô)* | 6 (48 ô) | 7 (56 ô) | 8 (56 ô) |
|---|---|---|---|---|---|---|---|
| C01 Thiếu gia Vin | +1,1 | +2,4 | +1,5 | +0,5 | −0,3 | −1,3 | −1,6 |
| C02 Ninja Lead | +0,9 | +1,8 | +2,4 | +2,2 | +0,7 | −0,5 | +0,0 |
| C03 Tài xế Grab | +1,5 | +0,7 | +0,6 | +0,1 | +2,1 | +1,3 | +1,4 |
| C04 Idol TikTok | −2,5 | −2,1 | +0,4 | −0,3 | −1,0 | −0,1 | −0,7 |
| C05 Cò đất | +0,5 | −2,1 | +1,6 | +1,0 | +0,1 | +0,4 | +0,1 |
| C06 Nghiện Tarot | −1,6 | −0,9 | −3,1 | −2,5 | −0,2 | +1,3 | +1,4 |
| C07 SVBK | +1,8 | −0,4 | −2,2 | +0,2 | +1,1 | −0,4 | −0,0 |
| C08 Nô lệ tư bản | −1,0 | +1,1 | −0,2 | −0,3 | −0,7 | −0,5 | −0,6 |
| C09 Con bạc | +1,3 | −0,8 | −1,6 | +0,2 | −0,0 | −0,4 | +0,9 |
| C10 Thợ xây | +0,1 | +1,8 | +0,6 | −1,8 | −1,0 | −0,8 | −0,8 |
| C11 F0 chứng khoán | −0,5 | −1,9 | −2,1 | −0,4 | −1,6 | +0,1 | −0,9 |
| C12 Tổ trưởng dân phố | −1,6 | +0,4 | +2,2 | +1,1 | +0,8 | +0,9 | +0,7 |

20.000 ván ở 2–4 người, 15.000 ở 6, 12.000 ở 7–8; *cột 5 người chạy lại 25.000 ván sau khi chỉnh Tài xế Grab. Người đi đầu thắng: 40% / 32,5% / 33,5% / 28,1% / 23,6% / 21,5% / 18,1% (công bằng 50 / 33 / 25 / 20 / 16,7 / 14,3 / 12,5%).

## Giá và tiền thuê theo tần suất dừng chân, chế độ đội, bốc thăm nhân vật, cờ cắm đất

### Tính lại giá và tiền thuê từng ô

Đo bằng bot: với mỗi nhóm, **tổng tiền thuê thu được / tổng tiền bỏ ra (mua đất + xây nhà)** qua cả ván. Con số này gộp sẵn tần suất dừng chân (ô sau Bãi giữ xe, ô bị thẻ dịch chuyển tới…), độ khó gom đủ nhóm và thời gian kịp xây. Trước khi chỉnh, nhóm lệch xa nhất so với trung vị là:

| Bàn | Trước | Sau (seed kiểm chứng 7700, chưa dùng khi chỉnh) |
| --- | --- | --- |
| 40 ô, 4 người | Xanh lá −40%, Vàng −25%, Đỏ −22% | Xanh lá −19%, các nhóm khác trong ±10% |
| 48 ô, 6 người | Giao thông +38%, Xanh đậm +34%, Xanh lá −34% | Xanh lá −15%, các nhóm khác trong ±13% |
| 56 ô, 8 người | Giao thông +67%, Tiện ích +59%, Bạc −28% | Tiện ích +12%, các nhóm khác trong ±8% |

Cách chỉnh (lặp mô phỏng, mỗi bàn 8 vòng × 1.500–3.000 ván, rồi kiểm chứng bằng seed khác):
- **Tiền thuê** mỗi nhóm nhân cùng một hệ số cho mọi mức (đất trống → khách sạn), giới hạn −10% đến +30% để bậc giá không bị đảo.
- Nhóm vẫn lời ít khi tiền thuê đã +30% (Đỏ, Vàng, Xanh lá, Tím, Bạc): **giảm giá xây nhà** thay vì giảm giá đất, nên giá đất vẫn tăng dần theo vòng bàn.
- Nhóm 2 ô cuối bàn (Xanh đậm; thêm Mận ở bàn 56 ô) gom đủ bộ quá dễ nên lời nhiều nhất. Không hạ tiền thuê, mà giữ chúng là **đất vàng thu thuê cao nhất bàn** và tăng giá đất / giá xây nhà (bàn 56 ô: 340–360 tỷ một căn).
- **Giao thông và tiện ích** ở bàn lớn (5–6 bến) hạ tiền thuê 15–30%. Riêng bàn 56 ô tăng thêm giá mua (bến 250, tiện ích 180).

Bàn 2 người không dùng để chỉnh: ván ngắn, ít nhóm được xây, trung vị lợi nhuận chỉ 0,38 nên tỉ lệ lệch không có nghĩa.

Cân bằng nhân vật sau khi đổi giá (seed 77; 12.000 / 10.000 / 8.000 / 6.000 / 6.000 / 5.000 / 5.000 ván; sai số 95% ±2,2 → ±1,0 điểm):

| | 2 người | 3 | 4 | 5 (48 ô) | 6 (48 ô) | 7 (56 ô) | 8 (56 ô) |
|---|---|---|---|---|---|---|---|
| C01 Thiếu gia Vin | +1,9 | +3,2 | +1,4 | +1,6 | +0,2 | −0,6 | −2,1 |
| C02 Ninja Lead | +1,4 | +0,9 | +2,5 | +1,2 | +0,4 | −0,5 | −1,0 |
| C03 Tài xế Grab | +1,3 | +0,1 | −0,4 | −0,4 | +1,7 | +0,9 | +0,3 |
| C04 Idol TikTok | −2,0 | −2,6 | +0,4 | +0,6 | −0,9 | −1,1 | −0,8 |
| C05 Cò đất | +1,5 | −0,3 | +1,6 | +0,9 | −0,9 | −0,4 | +0,3 |
| C06 Nghiện Tarot | −0,6 | −1,0 | −2,1 | −3,5 | −0,3 | +0,2 | +2,3 |
| C07 SVBK | +1,2 | −0,8 | −1,4 | +0,8 | +0,9 | −0,2 | −0,0 |
| C08 Nô lệ tư bản | +0,9 | +1,3 | −0,4 | −1,4 | −0,3 | +0,6 | +0,5 |
| C09 Con bạc | −1,3 | −0,3 | −1,4 | +0,2 | +0,2 | −0,0 | +0,1 |
| C10 Thợ xây | −1,8 | +0,4 | −0,1 | −0,1 | −0,5 | +0,7 | +0,5 |
| C11 F0 chứng khoán | −0,1 | −2,2 | −2,5 | −0,5 | −1,2 | −1,7 | −1,6 |
| C12 Tổ trưởng dân phố | −2,4 | +1,2 | +2,6 | +0,5 | +0,6 | +2,1 | +1,6 |

Người đi đầu thắng: 39,6% / 32,7% / 33,6% / 29,6% / 25,3% / 24,0% / 20,3%, gần như cũ. Nghiện Tarot ở bàn 5 người (−3,5) là điểm yếu nhất, theo dõi thêm.

### Chế độ đội

Chủ phòng chọn 2, 3 hoặc 4 đội (Rồng, Phượng, Lân, Quy). Người chơi tự bấm "Vào đội", chủ phòng có nút xáo đều. Ván chỉ bắt đầu khi đội nào cũng có người và các đội lệch nhau tối đa 1 người. Luật:
- Ví tiền và đất của ai người nấy giữ. **Tiền không bao giờ chuyển giữa đồng đội**: vào đất đồng đội thì miễn thuê. Thẻ "trả mỗi người" / "thu của mỗi người" chỉ tính đối thủ, và tổng tiền chia cho số đối thủ. Kỹ năng Họp tổ, Mở sòng chỉ áp vào đội khác. Bóc phốt không nhắm được đồng đội. Thẻ thu tiền về cho một nhân vật thì đồng đội của người đó được miễn, riêng tiền sửa nhà thì đồng đội nộp cho ngân hàng.
- Giao dịch giữa đồng đội vẫn như thường. Bot sẽ nhường đồng đội ô cuối của một nhóm mà đồng đội đang gom gần đủ, và nhận đề nghị của đồng đội nếu nó giúp một bên gom đủ nhóm mà không phá nhóm nào của mình.
- Thứ tự lượt: tung xúc xắc như cũ, rồi **xếp xen kẽ các đội**. Đội có người tung cao nhất đi trước; trong đội giữ thứ tự tung.
- Thắng: **đội cuối cùng còn người chưa phá sản**. Hết giờ (chế độ Nhanh) thì cộng tài sản những người còn trụ của mỗi đội. Bảng xếp hạng xếp theo đội, trong đội theo tài sản.

### Bốc thăm nhân vật

Cấu hình phòng "Chọn nhân vật: Bốc thăm ngẫu nhiên": thứ tự lượt do xúc xắc quyết định như cũ, còn nhân vật thì máy bốc lần lượt cho từng người, mỗi lần cách nhau 1,2 giây (`timers.drawRevealSec`), không ai được chọn. Ở chế độ chọn bình thường, người đang đến lượt chọn có thêm nút **Chọn ngẫu nhiên**.

### Cờ cắm đất

Chấm màu nhỏ ở góc ô được thay bằng **lá cờ cán tre** mang màu người chủ, kèm viền và nền ô ngả màu chủ đất. Đất đang thế chấp thì cờ rủ, có gạch chéo. Cờ to theo kích cỡ ô (10–22px).


### Sửa lỗi bot gửi đi gửi lại một đề nghị giao dịch

Server hỏi bot theo thứ tự ghế, nên bot đề nghị đổi đất cho một người ngồi sau nó sẽ được hỏi lại trước khi người kia kịp trả lời. Kết quả là nó gửi lại đúng đề nghị đó liên tục cho đến hết đồng hồ lượt (test với số liệu giá mới làm lộ ra lỗi này). Giờ bot chờ khi còn đề nghị đang mở, và mỗi lượt chỉ đề nghị mỗi người một lần (`turn.offeredTo`).

## Kỹ năng Mở sòng, Họp tổ nặng tay hơn; Bố ơi cứu con theo bàn

Ở bàn đông, Mở sòng và Họp tổ chia một tổng nhỏ cho nhiều đối thủ, nên mỗi lần dùng chỉ được vài chục tỷ: bàn 8 người, Họp tổ được ~21 tỷ, Mở sòng lời trung bình ~35 tỷ. Bấm vào mà gần như không thấy gì. Hướng sửa: tăng tổng tiền cho kỹ năng có cảm giác, rồi bù bằng thời gian hồi, hoa hồng hoặc điểm yếu.

| | Trước | Sau |
| --- | --- | --- |
| **Mở sòng** (Con bạc) | tổng cược 240, người thắng nhận 80%, hồi 3 lượt | **tổng cược 560**, người thắng nhận 90%, hồi 4 lượt. Bàn 2 người: 240 / 80% / 3 lượt; bàn 3 người: 320 / 80% / 3 lượt; bàn 4 người: người thắng nhận 85% |
| **Họp tổ dân phố** (Tổ trưởng) | 20 cho mình + 20 vào Quỹ, hồi 3 lượt | **45 cho mình + 20 vào Quỹ**, hồi 5 lượt. Bàn 2–3 người: 35 + 10/15; bàn 4 người: 40 + 20 |
| Điểm yếu Tổ trưởng | góp 20 vào Quỹ mỗi lần qua ô Xuất phát | **góp 40** |
| **Bố ơi cứu con** (Thiếu gia Vin) | tối đa 500 ở mọi bàn | tăng như tiền khởi đầu (`scaleWithBoard`): **500 / 580 / 650** ở bàn 40 / 48 / 56 ô |

Mỗi lần dùng ở bàn 8 người: Mở sòng mỗi đối thủ cược 80 tỷ (cả bàn 560), Họp tổ mỗi đối thủ góp 7 + 3 tỷ (được 49 tỷ). Mô tả kỹ năng trong game ghi luôn con số này theo số người ở bàn. Bố ơi cứu con ghi rõ chỉ cứu khi đã bán hết nhà, thế chấp hết đất mà vẫn thiếu.

Thử 4 bộ số trên seed 901 trước khi chọn. Riêng việc tăng tổng cược mà giữ hoa hồng 20% làm Con bạc +5 điểm % ở bàn 5–6 người, nên hạ hoa hồng. Cược lớn ở bàn 2–3 người thì Con bạc thua (−7), nên bàn nhỏ giữ mức cũ. Kiểm chứng (seed 77; 12.000 / 10.000 / 8.000 / 6.000 / 6.000 / 5.000 / 5.000 ván):

| | 2 người | 3 | 4 | 5 (48 ô) | 6 (48 ô) | 7 (56 ô) | 8 (56 ô) |
|---|---|---|---|---|---|---|---|
| C01 Thiếu gia Vin | +1,9 | +2,8 | +2,2 | +1,1 | −0,5 | −0,7 | −1,3 |
| C02 Ninja Lead | +1,2 | +0,8 | +1,4 | +0,2 | −0,2 | −0,1 | −0,3 |
| C03 Tài xế Grab | +0,5 | +1,0 | −0,5 | −0,6 | +0,8 | +1,1 | +0,1 |
| C04 Idol TikTok | −2,2 | −2,1 | +0,6 | −0,2 | −0,7 | −1,1 | −0,5 |
| C05 Cò đất | +1,0 | −1,1 | +1,1 | −0,1 | +0,2 | −0,4 | −0,4 |
| C06 Nghiện Tarot | −0,9 | −1,0 | −2,8 | −1,2 | −0,9 | +0,8 | +2,0 |
| C07 SVBK | +1,2 | +0,3 | −1,3 | +1,0 | +1,3 | +1,0 | −0,9 |
| C08 Nô lệ tư bản | +0,3 | +1,7 | −0,2 | +0,4 | −0,2 | +0,3 | +0,3 |
| C09 Con bạc | −1,6 | +0,1 | +0,0 | −0,2 | +1,0 | −1,0 | +0,5 |
| C10 Thợ xây | −2,4 | +0,4 | +0,2 | −0,6 | −0,8 | +0,7 | +0,3 |
| C11 F0 chứng khoán | −0,9 | −2,1 | −2,0 | −0,6 | −1,1 | −0,8 | −0,4 |
| C12 Tổ trưởng dân phố | +1,7 | −0,5 | +1,3 | +0,7 | +1,2 | +0,1 | +0,7 |

Mọi nhân vật ở mọi cỡ bàn đều trong ±2,8 điểm % (trước đó ±3,5). Người đi đầu thắng: 39,6% / 32,7% / 33,9% / 28,5% / 25,5% / 24,2% / 20,1%.

## Mở sòng đặt cùng lúc, mã phòng trong ván, thanh nút cố định

- **Mở sòng**: `sicboBet` không còn `player` (người đang đặt) mà có `waiting` — danh sách người chưa đặt. Mọi đối thủ đặt cùng lúc theo thứ tự bất kỳ; người cuối cùng đặt xong thì tung ngay. Một đồng hồ chung (`timers.sicboBetSec`); hết giờ, ai chưa đặt được chọn ngẫu nhiên (nhật ký ghi "hết giờ, chọn ngẫu nhiên"). `actorOf` trả `null` như lúc đấu giá, bot của từng ghế tự đặt phần mình.
- **Mã phòng trong ván**: góc trên thanh bên hiện mã phòng; bấm vào để chép link mời. Trước đây khóa giữ ghế chỉ sống trong một tab, nên đóng tab rồi nhập lại mã chỉ được vào xem. Nay trình duyệt nhớ khóa ghế theo mã phòng (`hanoi-monopoly:seats`, 10 phòng gần nhất, chỉ ghi khi thật sự có ghế). Nhập lại mã thì client thử `reclaim` trước; server chỉ trả ghế khi ghế đó đang mất kết nối hoặc đã giao cho bot, nên không bao giờ giật ghế của một tab khác còn mở. Vào từ máy hoặc trình duyệt khác thì vẫn chỉ xem được.
- **Thanh nút**: Tài sản · Giao dịch · Nhân vật nằm riêng một hàng lưới 3 cột, không chung hàng với đồng hồ nên không bao giờ bị đẩy xuống dòng. Đồng hồ khi chật thì cắt bớt chữ, luôn giữ số giây. Người đã phá sản / khán giả thấy hai nút đầu bị mờ thay vì biến mất.

## Hướng dẫn người mới, hình mua đất

- **Hướng dẫn người mới** (`client/src/lib/tutorial.ts`, chữ ở `i18n/vi.ts` → `tutorial.tips`): 28 mẹo, mỗi mẹo có điều kiện theo trạng thái ván và thứ tự ưu tiên. Việc phải trả lời ngay (mua đất, trả thuê, đấu giá, rút thẻ, tài xỉu, thiếu nợ, đề nghị giao dịch) xếp trước; sau đó là chào mừng, tung xúc xắc, rồi lời khuyên theo tiến độ (đủ nhóm thì chỉ Tài sản để xây, thiếu 1 ô thì gợi ý Giao dịch, ít tiền thì giải thích thế chấp, dư tiền thì chuộc…). Bảng Tài sản và Giao dịch có mẹo riêng khi mở lần đầu.
  - Mỗi lần chỉ hiện một mẹo, ở thanh bên ngay trên khung quyết định. Nút được nhắc tới nhấp nháy (thuộc tính `data-coach`). Mẹo mất hẳn khi bấm "Đã hiểu", hoặc khi người chơi đã làm điều nó hướng dẫn (đã hiện ít nhất 1,5 giây rồi tình huống qua đi) — nên người mới chơi theo là tự tiến.
  - Bật/tắt ở trang chủ, phòng chờ và nút 🎓 trong ván; lưu trong trình duyệt. **Mặc định bật** với trình duyệt chưa chọn lần nào — người mở link mời lần đầu là người mới. "Xem lại hướng dẫn từ đầu" xóa các mẹo đã xem.
  - Server biết ai bật (`learner`): cả bàn thấy dấu 🎓 cạnh tên, và người đó được thêm `timers.learnerExtraSec` (10 giây) cho mỗi quyết định — vừa đọc mẹo vừa bấm. Đồng hồ lượt 90 giây không đổi.
- **Hình mua đất**: mô hình 3D lúc mua trước đây có một căn nhà, dễ hiểu nhầm là được tặng nhà. Nay là mảnh đất trống có hàng rào, cột mốc và lá cờ màu người mua (giống cờ cắm trên ô), chữ ghi "mua đất … (đất trống)". Giao thông / tiện ích vẫn ghi "mua …".

## Đội tính chung nhóm màu, Du lịch, Con bạc nhẹ tay hơn, rà soát chế độ Nhanh / Đội

- **Chế độ đội — nhóm màu chung**: `ownsFullGroup` tính cả đất của đồng đội. Cả đội giữ đủ nhóm thì tiền thuê đất trống ×2, và mỗi người xây trên ô của mình. Xây đều tính trên cả nhóm (kể cả ô đồng đội), và một ô đang thế chấp trong nhóm chặn xây cả nhóm. Mỗi người chỉ thế chấp, chuộc, bán nhà trên ô của mình; thế chấp chỉ cần ô của mình trong nhóm không có nhà, để không ai bị kẹt vì nhà của đồng đội. Không được đem bán hay đổi ra ngoài một ô của nhóm đang có nhà (của bất kỳ ai trong đội).
  - Cờ và nhà trên bàn (2D và 3D) mang **màu đội**; bấm vào ô để xem chủ là ai. Tài sản hiện thêm ô của đồng đội trong cùng nhóm (chỉ xem) và số ô "x/y" tính cả đội.
  - Bot: bỏ "tặng ô cho đồng đội" (không cần nữa). Đề nghị của đồng đội được nhận trừ khi đòi tiền quá tay; đề nghị của đối thủ chỉ nhận khi giúp *đội* đủ nhóm.
- **Nô lệ tư bản — Du lịch** (`travel`, hồi 10 lượt): thay cho tung xúc xắc, chọn một ô bất kỳ trên bàn (bấm vào ô). Quân đi tới đó (qua Hoàng thành vẫn nhận lương), ô được xử lý như sau một lần tung. Không dùng ở Bãi giữ xe, không dùng sau khi đã tung. Dừng ở Tiện ích khi lượt này không có xúc xắc thì tung 2 xúc xắc mới để tính tiền. Bot đi Du lịch khi có ô chưa chủ giúp nó gần đủ hoặc đủ nhóm mà vẫn giữ được vốn.
  - Du lịch rất mạnh: với vốn cũ (1.800) C08 thắng hơn mức công bằng 10–14 điểm %, và càng đông người càng mạnh. Vốn khởi đầu vì thế giảm theo cỡ bàn: 1.700 / 1.550 / 1.350 / 1.300 / 1.200 / 1.150 / 1.100 cho 2–8 người — hợp với tên "Nô lệ tư bản". Kỹ năng cũ Xin nghỉ phép (`free_jail_exit`) vẫn còn trong engine, không nhân vật nào dùng.
- **Con bạc nhẹ tay hơn**: trong mô phỏng Con bạc không mạnh (bot ít khi liều), nhưng khi người chơi thật thì cảm giác quá lời — nhất là trúng bão được khỏi trả tiền mua đất, và mở sòng ở bàn ít người. Thay đổi: Liều ăn nhiều thắng chỉ bớt **25%** (trước 30%), ra bão chỉ bớt **một nửa** (trước khỏi trả); Mở sòng tổng cược **480** (trước 560), bàn 2 người 200 (trước 240), 3 người 280 (trước 320); vốn 1.450 (trước 1.400) để không quá yếu.
- **Thợ xây**: ở bàn 2–3 người "nhà chui" bị tắt (`anyTile: false`), nên mua đất chưa đủ nhóm rồi bấm Tự tay xây chỉ thấy "Chưa có ô phù hợp" — người chơi tưởng lỗi. Nay mọi cỡ bàn đều được xây 1 nhà chui (bàn nhỏ vẫn hồi lâu hơn). Khi không có ô nào, giao diện nói lý do (ví dụ "cần sở hữu đủ cả nhóm màu", "có ô trong nhóm đang thế chấp"). Danh sách ô lấy thẳng từ engine (`whyCantFreeBuild`) thay vì tự tính lại ở client.
- **Cân bằng sau thay đổi** (seed 78, 5.000–12.000 ván mỗi cỡ bàn): mọi nhân vật trong khoảng ±2,9 điểm % ở mọi cỡ bàn 2–8 người; C08 −0,7…+0,9; C09 −1,9…+0,2.

| | 2p | 3p | 4p | 5p | 6p | 7p | 8p |
| --- | --- | --- | --- | --- | --- | --- | --- |
| C08 trước (vốn 1.800) | +11,6 | +13,6 | +11,2 | +10,1 | +9,5 | +12,9 | +11,8 |
| C08 sau | +0,2 | +0,9 | −0,2 | −0,5 | +0,5 | −0,7 | +0,4 |
| C09 sau | +0,2 | −0,7 | −0,2 | −1,9 | −0,3 | −1,6 | −0,4 |

- **Rà soát chế độ Nhanh / Đội / Nhanh + Đội**:
  - Ván Nhanh trước đây không cho biết khi nào hết giờ. Nay server gửi `quickEndsAt`; giữa bàn có "⏳ Ván Nhanh còn mm:ss" và điều kiện kết thúc (hết giờ, hoặc khi N người phá sản — chế độ đội ghi "đội có tổng tài sản cao nhất").
  - Bảng người chơi ở chế độ Nhanh / Đội có thêm tổng tài sản của từng người (cách tính điểm khi hết giờ). Chế độ Nhanh còn có thứ hạng #1, #2…; chế độ Đội có dòng tổng tài sản từng đội, đội còn trụ xếp trước.
  - Màn kết thúc ván ở chế độ đội có bảng tổng của từng đội.
  - Mô tả kỹ năng "mỗi đối thủ …" tính đúng số đối thủ (người đội khác) thay vì cả bàn.
  - Màn chọn nhân vật ghi rõ thứ tự lượt xen kẽ theo đội (số tung không xếp giảm dần nữa).
  - Điện thoại: dòng giải thích dưới đồng hồ Nhanh bị ẩn, để không đè lên lá bài giữa bàn.

## 5 nhân vật mới (C13–C17)

- **C13 Thánh săn sale** — *Săn sale* (`auction_discount`): thắng đấu giá chỉ trả 80% giá đã đặt. *Flash sale* (`flash_sale`, hồi 6 lượt): trong lượt mình, mua ngay một ô chưa có chủ ở bất kỳ đâu trên bàn với giá giảm 20% (bấm vào ô trên bàn cờ), không cần đi tới; vẫn tính là mua của ngân hàng (Cò đất ăn hoa hồng). Điểm yếu: vốn 1.400.
  - Sức mạnh thật của Flash sale không nằm ở giá giảm mà ở chỗ **mua từ xa đúng ô cuối cùng cho đủ nhóm**. Ở bàn 6–8 người ô đó bị tranh nhau, nên dù giảm giá 0% và chỉ dùng được 1 lần, C13 vẫn +3…+6 điểm %. Vì vậy ở bàn **5–8 người Flash sale không được mua ô làm mình đủ nhóm** (`completesGroup: false`; bàn 7–8 người còn giảm 15%, hồi 7 lượt). Bàn 2–4 người thì được (bàn 2 người giảm 30%, hồi 3 lượt, vốn 1.500; bàn 3 người giảm 25%, hồi 4 lượt) — nếu cấm cả ở bàn ít người thì C13 còn −5…−13 điểm %.
- **C14 Chủ trọ** — *Phòng trọ giá rẻ* (`rent_bonus_groups`): tiền thuê ở nhóm Nâu và Xanh nhạt cao hơn 50%. *Tăng giá phòng* (`raise_rent`): chọn một ô đất của mình, tiền thuê ô đó tăng thêm 25% mãi mãi (khi còn giữ ô), mỗi ô tối đa 2 lần. Hệ số tính sau bước ×2 đủ nhóm, trước thẻ ⏳ (GDD 4.4). Điểm yếu: nộp thuế cao hơn (250 / 150), trừ bàn 2 người (ở đó Chủ trọ đã −4 điểm %).
- **C15 Thầy phong thủy** — miễn các thẻ sửa nhà (CH15, CD14, EV03, EV25, EV36), vốn 1.650. *Dời nhà* (`move_house`, hồi 2 lượt): dời 1 nhà từ ô này sang ô khác của mình, miễn phí. Nhà rời đi như bán (bớt đều trên ô của mình, chỉ nhà, không khách sạn), đến nơi như xây (đủ nhóm, xây đều, không thành khách sạn). Kỹ năng chỉ có ích khi đã có nhà, nên với vốn thường Thầy phong thủy −4…−7 điểm %; bù bằng vốn và hồi nhanh.
  - Trước đây `immune_events` chỉ có tác dụng với vài loại thẻ (một xúc xắc, phạt nguội). Nay áp dụng chung: thẻ chỉ tác động người rút (trả tiền, sửa nhà, đi tới…) thì không có tác dụng với người miễn ("được miễn thẻ …" trong nhật ký); thẻ tác động cả bàn thì người miễn được bỏ qua như Giải hạn.
- **C16 Tín dụng đen** — cơ chế **vay** mới, khoản nợ nằm trên người vay (`debts`), bảng người chơi hiện "💸 nợ … ".
  - *Vay nóng* (`loan_shark`, nội tại): ai thiếu tiền trả một khoản (thuê, thuế, thẻ…) thấy nút "Vay nóng" cạnh thế chấp / phá sản: vay đúng phần thiếu (tối đa 300 tỷ, Tín dụng đen phải đủ tiền), trả 130%. Tín dụng đen không phải bấm gì. Không cho vay để trả chính Tín dụng đen (sẽ thành đảo nợ mãi).
  - *Giải ngân* (`forced_loan`, kỹ năng): ép một **đối thủ ngẫu nhiên** (không chọn được — người chơi góp ý: tránh cảm giác bị nhắm vào) nhận khoản vay 150 tỷ, phải trả lại 140% (210 tỷ); hồi 4 lượt. Trả 150% thì C16 +3…+6 điểm %, trả 130% thì −4…−5. Lúc đầu người dùng muốn chủ nợ chủ động chào vay, nhưng chờ ai đó thiếu tiền thì kỹ năng hiếm khi dùng được, nên kỹ năng là ép vay.
  - Trả nợ **tự động khi người vay qua Hoàng thành lần tới**, sau khi nhận lương và trước khi xử lý ô dừng. Không đủ tiền thì đó là một khoản nợ thường với Tín dụng đen (bán, thế chấp, hoặc phá sản — tài sản về tay Tín dụng đen). Người vay phá sản với người khác, hoặc Tín dụng đen phá sản, thì khoản vay mất. Tổng tài sản (chế độ Nhanh / Đội) tính khoản cho vay vào người cho vay và trừ vào người vay. Đồng đội không vay của nhau.
- **C17 Bác sĩ lạ** — miễn thẻ Khám bệnh định kỳ, máy lọc không khí, AQI 300 (CD11, CD17, EV39); vốn 1.650 (bàn 2 người 1.950, bàn 3 người 1.550); không có điểm yếu (bản đầu phải góp 20 tỷ mỗi vòng thì quá yếu). *Mở cổng* (`portal`, hồi 4 lượt): thay cho tung xúc xắc, đổi chỗ với một **đối thủ ngẫu nhiên** (không phải đồng đội, không ai đang ở Bãi giữ xe, không ai đứng cùng ô), rồi xử lý ô mới như vừa dừng ở đó. Không nhận lương; người bị đổi chỗ chỉ dời quân, không xử lý ô. Nút nằm cạnh "Tung xúc xắc" và mờ đi khi không có ai để đổi. *(Đã đổi: xem "Ví chung cho đội, Mở cổng chọn người" bên dưới.)*
  - Bot chỉ mở cổng khi giá trị trung bình các ô có thể tới hơn hẳn giá trị trung bình một lần tung (một lần tung còn đưa quân đi quanh bàn để nhận lương) — dùng bừa thì Bác sĩ lạ thua −18 điểm % ở bàn 2 người.
- Thẻ mới: **EV41** Công an triệt phá đường dây tín dụng đen (Tín dụng đen nộp 150 vào Quỹ; không có thì người rút nhận 30), **EV42** Mùa nhập học, phòng trọ cháy hàng (Chủ trọ nhận 120; không có thì mỗi người nhận 20).
- **Cân bằng 17 nhân vật** (seed 79, 7.500–16.000 ván mỗi cỡ bàn, khoảng tin cậy ±1,1…±2,3): mọi nhân vật trong ±3,2 điểm %; 5 nhân vật mới trong ±2,4.

| | 2p | 3p | 4p | 5p | 6p | 7p | 8p |
| --- | --- | --- | --- | --- | --- | --- | --- |
| C13 Thánh săn sale | −1,6 | −1,3 | +0,7 | −2,2 | +1,2 | +0,5 | +1,2 |
| C14 Chủ trọ | −2,1 | −1,1 | −0,1 | +0,8 | +1,5 | +1,2 | +0,6 |
| C15 Thầy phong thủy | +0,2 | +0,4 | −1,5 | +0,3 | −0,9 | −0,6 | −1,9 |
| C16 Tín dụng đen | −2,4 | −1,2 | −0,6 | +0,6 | +1,8 | +0,4 | +1,3 |
| C17 Bác sĩ lạ | +1,7 | −1,7 | −0,2 | +0,6 | −1,2 | −0,1 | +0,5 |
| xa nhất trong C01–C12 | C05 +3,1 | C12 −2,9 | C06 −3,2 / C02 +3,1 | C12 +1,6 | C11 −2,5 | C09 −1,8 | C06 +1,4 |

## Kỹ năng chủ động cho mọi nhân vật, cân bằng riêng cho chế độ Nhanh / Đội, thêm 14 thẻ

- **Nhân vật không có kỹ năng chủ động**: Thiếu gia Vin (Bố ơi cứu con tự bật khi sắp phá sản) và SVBK (Tốt nghiệp tự bật) — người chơi không bao giờ phải quyết gì. Ninja Lead, Tài xế Grab, Nghiện Tarot có kỹ năng "phản ứng" (bật khi trả thuê / sau khi tung / khi rút Event) — vẫn là một quyết định của người chơi nên giữ nguyên.
  - **C01 Thiếu gia Vin — Mua đứt** (`buyout`): trong lượt mình, mua một ô **lẻ** của đối thủ (họ không giữ ô nào khác cùng nhóm, nhóm chưa có nhà, ô không thế chấp), trả chủ 150% giá đất; **không được mua ô làm mình đủ nhóm** (`completesGroup: false`). Bố ơi cứu con thành nội tại, mỗi ván cứu 1 lần (`bailoutUsed`).
    - Bản đầu cho mua cả ô làm đủ nhóm: +17…+31 điểm % ở bàn 4–8 người và chế độ Nhanh (chia đất đầu ván để lại rất nhiều ô lẻ). Chủ ô luôn được trả hậu, và chỉ ô lẻ mới bị mua, để không ai thấy mình bị "nhắm" mất nhóm đang gom.
  - **C07 SVBK — Săn học bổng** (`scholarship`): rút tối đa 60 tỷ từ Quỹ khuyến học; Quỹ trống hoặc tắt (chế độ Nhanh) thì ngân hàng cấp 30 (Nhanh 40). Bỏ nội tại Tốt nghiệp: giữ cả hai thì SVBK +3…+4; bản đầu (100 tỷ, hồi 4 lượt) +8…+20 vì Quỹ ở chế độ Truyền thống hầu như lúc nào cũng đầy.
- **Mô phỏng chế độ đội** (`sim --teams N`): ghế xen kẽ theo đội, thắng cùng đội, mức công bằng là 1/N. Lần chạy đầu làm lộ một lỗi: bot F0 dùng Bắt đáy theo luật cũ (chỉ xét nhà của chủ ô), engine theo luật đội (cả nhà của đồng đội) nên từ chối — bot đứng hình. Đã sửa bot theo đúng luật đội.
- **Số riêng theo chế độ** (`characters.json` → `byMode`): giống `byTableSize`, mỗi mục có `mode` (`quick` / `classic`), `teams` (true / false), `players` (tùy chọn); mọi mục khớp được áp lần lượt sau `byTableSize`. Màn chọn nhân vật và nút Nhân vật ghi "Chỉ số riêng cho chế độ Nhanh / Đội". Đo trước khi chỉnh (8.000 ván mỗi cấu hình):
  - Thợ xây +6…+11 ở chế độ Nhanh (đất chia sẵn ⇒ giảm giá xây và nhà chui rất lời) và +7…+10 ở đội 4 người (nhóm màu chung đầy đủ sớm).
  - Tài xế Grab, Cò đất, Ninja Lead +3…+6 ở đội 6–8 người; Tín dụng đen, Nghiện Tarot, F0, Con bạc −3…−7 ở chế độ Đội; F0 −4…−6 ở chế độ Nhanh.
  - Chỉnh: Thợ xây (Nhanh: giảm giá 5–15%, không nhà chui ở bàn 2–4; Đội 4 người: không giảm giá, hồi 8 lượt; Đội 6 người: giảm 10%), Thiếu gia Vin (Nhanh: lương 250, mua đứt 250%, hồi 8; Đội Truyền thống: hồi 4, bàn 6–8 lương 300 và hồi 3), SVBK (Đội: tối đa 100, hồi 4; Đội + Nhanh: ngân hàng cấp 60), F0 (cổ tức 5% ở Nhanh, 7% ở Đội), Nghiện Tarot (Nhanh / Đội: bỏ điểm yếu, rút 2 chọn 1 cả Cộng đồng; Đội còn vốn 1.700), Con bạc (vốn 1.550 Nhanh, 1.650 Đội), Tài xế Grab (Đội 6–8: chỉnh bước 1 lần/ván, hồi 9; Nhanh 4 người: lương 175), Cò đất (Đội 6–8: hoa hồng 5), Ninja Lead (Nhanh: hồi 3; Nhanh 8 người: bỏ phí phát thải, hồi 2), Nô lệ tư bản (Đội 4 người: hồi 13; bàn 3 người vốn 1.450), Thánh săn sale (bàn 3 người giảm 30%, hồi 3; Nhanh 5–8: giảm 15%; Đội 5–6: được mua ô đủ nhóm nhưng giảm 10%, hồi 20), Chủ trọ (bàn 2–3 người và Nhanh, Đội 4 người: không thuế cao; Nhanh và Đội 4 người hồi 3), Tín dụng đen (Đội: vốn 1.500, bàn 6–8 giải ngân 200 trả 150%; Nhanh 2–4: vốn 1.500).
- **Không có vay nóng giữa đồng đội**: đã thử cho đồng đội của Tín dụng đen vay không lãi, nhưng bỏ — người cùng đội vẫn chuyển tiền cho nhau bằng Giao dịch, luật này thừa.
- **Chủ trọ — khách sạn**: tiền Tăng giá phòng không tính khi ô đã lên khách sạn. Bot chỉ xây tối đa 3 nhà nên mô phỏng không thấy, nhưng người chơi thật dồn +50% vào khách sạn Hồ Gươm thì một lần dừng là 3.300 tỷ.
- **14 thẻ mới** (97 lá): Cơ hội CH22–CH26 (pháo hoa Hồ Tây, Metro mới, chợ đêm Long Biên, lỡ xe buýt lùi 2 ô, voucher ngày sale đôi), Cộng đồng CD21–CD24 (thưởng Tết dương lịch, phí quản lý chung cư, nhổ răng khôn — Bác sĩ lạ được miễn, định danh điện tử), Event EV43–EV47 (ngày hội 12.12 — Thánh săn sale nhận 120; mùa cúm — cả bàn trả Bác sĩ lạ 20; xem ngày động thổ — Thầy phong thủy nhận 100; Vành đai 4 thông xe — thuê nhóm Cam, Đỏ ×1,5 trong 1 vòng ⏳; treo cờ mừng đại lễ — mỗi người nhận 30).
- **Bot và Mua đứt**: bot chỉ mua đứt khi ô đó gần đủ bộ (ví dụ giao thông thứ 4). Một bản bot mua mọi ô lẻ với giá 150–250% làm Thiếu gia Vin tụt −6…−13 điểm % ở Nhanh / Đội — mua đắt chỉ đáng khi gần đủ nhóm.
- **Kết quả cuối** (seed 81 cho Truyền thống, 7.500–16.000 ván mỗi cỡ bàn; seed 505 cho các chế độ, 6.000–8.000 ván mỗi cấu hình; khoảng tin cậy ±1,2…±2,3): Truyền thống mọi nhân vật trong ±3,5 trừ Thiếu gia Vin bàn 3 người +4,2; Nhanh / Đội / Đội + Nhanh trong ±3,7 trừ Thiếu gia Vin Đội + Nhanh 6 người −4,4.

| | Q4 | Q6 | Q8 | Đội 4 (2×2) | Đội 6 (2×3) | Đội 6 (3×2) | Đội 8 (4×2) | Đội+Nhanh 4 | Đội+Nhanh 6 | Đội+Nhanh 8 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| lệch xa nhất | C07 +3,5 | C10 −3,6 | C13 +3,5 | C10 +2,8 | C13 +3,5 | C05 +2,5 | C01 −2,3 | C01 −2,9 | C01 −4,4 | C05 +3,6 |
| Thợ xây trước → sau | +10,7 → +0,3 | +9,9 → −3,6 | +11,3 → −3,2 | +8,8 → +2,8 | +5,9 → +2,5 | +1,8 → +0,3 | +0,5 → +1,1 | +11,2 → −0,1 | +4,7 → +0,2 | +3,3 → +1,8 |
| Tín dụng đen trước → sau | +0,0 → +1,3 | +1,2 → +0,6 | −1,5 → −0,2 | −1,9 → −0,4 | −4,1 → +2,9 | −6,5 → +0,9 | −5,1 → −1,1 | −3,1 → +0,2 | −5,5 → −0,3 | −5,6 → −1,5 |

## Ví chung cho đội, Mở cổng chọn người, bấm người chơi để xem vị trí

- **Ví chung** (luôn bật ở chế độ Đội): mỗi đội một ví, khởi đầu bằng tổng tiền khởi đầu của các thành viên. Mỗi thành viên vẫn có `cash` nhưng luôn bằng cả ví; engine cộng thay đổi của mọi thành viên vào ví sau mỗi bước (`syncTeamCash`, ví lưu ở `state.teamCash`), nên luật nào cũng chỉ cần trừ / cộng tiền của một người như cũ.
  - Ai trong đội cũng xây, bán nhà, thế chấp, chuộc mọi ô của đội (chủ ô vẫn giữ nguyên, cờ màu đội). Xây đều và bán đều tính trên cả nhóm của đội.
  - Thiếu tiền: bán / thế chấp được cả ô của đồng đội. Không xoay nổi thì **cả đội phá sản cùng lúc**: tiền, đất, thẻ ra tù của cả đội về chủ nợ (hoặc ngân hàng).
  - Xếp hạng khi hết giờ: ví tính một lần cho cả đội, cộng đất và khoản nợ của từng người.
- **Mở cổng** (Bác sĩ lạ): người dùng **chọn** đối thủ để đổi chỗ (không phải đồng đội, không ở Bãi giữ xe, không cùng ô); dùng được trước khi tung (thay cho lượt tung) hoặc sau khi tung (thêm một lần dừng). Bác sĩ lạ xử lý ô mới trước, rồi đối thủ **xử lý ô cũ của Bác sĩ lạ như vừa dừng ở đó**: trả tiền thuê (ví dụ đổi đối thủ về đúng nhà của mình), nộp thuế, rút thẻ, vào tù, ô trống thì được hỏi mua / đấu giá ngay trong lượt của Bác sĩ lạ. Không ai nhận lương. Bot chọn đối thủ có lợi nhất (ô mình tới + tiền thuê đối thủ trả cho mình).
- **Bấm vào người chơi** trong bảng người chơi: ô người đó đang đứng sáng lên 3 giây kèm tên, và bàn cờ cuộn tới ô đó nếu đang phóng to.
- **Đầu hàng** (`surrender`): rời ván bất cứ lúc nào, kể cả ngoài lượt mình, sau một bước hỏi lại. Không được khi đang có quyết định của chính mình chờ (mua đất, trả thuê, rút thẻ, đặt cược…), để không bỏ dở một bước giữa chừng; đang thiếu tiền (bảng xoay tiền) thì được — mọi thứ về tay chủ nợ ngay, không bán nhà trước. Không nợ ai: tiền về ngân hàng, đất trả về và đem đấu giá như phá sản với ngân hàng. Chơi đội mà đồng đội còn trụ: đất và thẻ ra tù chuyển cho một đồng đội, ví chung giữ nguyên. Đang đấu giá thì người đầu hàng ra khỏi danh sách trả giá (giá cao nhất của họ bị hủy).
- **Cân bằng lại sau khi đổi luật** (seed 505, 5.000–8.000 ván mỗi cấu hình, khoảng tin cậy ±1,2…±3,2):
  - *Bác sĩ lạ*: Mở cổng mới (chọn người, đối thủ xử lý ô, dùng sau khi tung) đẩy lên +20 điểm % ở bàn 2 người, +10 ở bàn 3 người, +6…+13 ở chế độ Đội. Chỉnh: vốn 1.500 mọi cỡ bàn (bỏ 1.950 / 1.550), hồi 8 lượt (bàn 3 người 10, chế độ Đội 14). Sau chỉnh: −2,7…+3,5.
  - *Ví chung* làm lệch chế độ Đội: điểm yếu "ít vốn" gần như mất tác dụng khi cả đội chung ví (Nô lệ tư bản +5…+8), Thánh săn sale +6 ở đội 6 người, Thiếu gia Vin −4…−6, Tín dụng đen −5. Chỉnh (chỉ chế độ Đội): Nô lệ tư bản vốn 1.100 (bàn 5–8: 1.000); Thánh săn sale đội 5–6 người giảm 30%, hồi 4, không mua ô làm đủ nhóm, Đội + Nhanh 4 người và 7–8 người giảm đấu giá còn 10% và vốn 1.250 / 1.200; Cò đất đội 6–8 bỏ hoa hồng, kỹ năng hồi 5; Thiếu gia Vin đội 6–8 lương 340, Đội + Nhanh lương 300, mua đứt 150% hồi 5; Tín dụng đen vốn 1.600, Đội + Nhanh giải ngân 200 trả 150%; F0 cổ tức 9%; SVBK Đội + Nhanh ngân hàng cấp 90; Idol TikTok đội 6–8 Bóc phốt hồi 7; Con bạc đội 4 người vốn 1.500.
  - Lưu ý khi chỉnh Thánh săn sale: ở bàn 4 người `byTableSize` cho Flash sale mua cả ô làm đủ nhóm; một mục `byMode` ghi `completesGroup: false` sẽ tắt quyền đó và kéo nhân vật xuống −10.
  - Kết quả cuối: mọi nhân vật trong ±3,7 ở mọi cấu hình, trừ Thiếu gia Vin bàn 3 người Truyền thống +4,3 (có từ trước, không đổi).

| | C2 | C3 | C4 | C6 | C8 | Q4 | Q6 | Q8 | Đội 4 | Đội 6 (2×3) | Đội 6 (3×2) | Đội 8 | Đội+Nhanh 4 | Đội+Nhanh 6 | Đội+Nhanh 8 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Bác sĩ lạ | −0,2 | +0,2 | −1,4 | −0,4 | +1,0 | −2,0 | −2,5 | −2,7 | +3,5 | +2,2 | +0,5 | −0,2 | +1,6 | +0,7 | −0,3 |
| Nô lệ tư bản | +0,1 | −1,1 | −1,9 | −0,2 | +0,7 | +0,5 | −1,2 | −0,1 | −1,2 | +1,9 | −0,4 | +1,3 | −0,4 | +0,4 | +1,3 |
| Thánh săn sale | −1,3 | −3,6 | +0,8 | +0,4 | +1,2 | +0,2 | +2,9 | +3,7 | +3,4 | −3,5 | −1,5 | +1,1 | +1,8 | +0,4 | −0,6 |
| lệch xa nhất | C11 −3,1 | C01 +4,3 | C06 −3,2 | C15 −2,4 | C04 −1,5 | C07 +3,5 | C10 −3,5 | C13 +3,7 | C13 +3,4 | C13 −3,5 | C03 +2,6 | C02 +2,5 | C10 −3,4 | C09 +3,1 | C07 +2,0 |

