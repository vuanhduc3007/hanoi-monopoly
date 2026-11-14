# Hanoi Monopoly — Game Design Document

Nov 9, 2026 · @Duc

## 1. Tổng quan

Hanoi Monopoly là game Cờ Tỷ Phú online nhiều người trên web, bối cảnh Hà Nội, concept "Cũ & Mới": đi từ ven đô vào Phố cổ, đất càng gần Hồ Gươm càng đắt. Luật nền giữ đúng Monopoly cổ điển; bản sắc nằm ở địa danh, bộ thẻ Hanoi Event, 8 nhân vật có kỹ năng và phong cách Đông Hồ hiện đại.

| Hạng mục | Giá trị |
| --- | --- |
| Tên | Hanoi Monopoly |
| Thể loại | Board game kinh tế / chiến thuật, online nhiều người |
| Nền tảng | Web (React + Colyseus) |
| Số người chơi | 2–6 mỗi phòng |
| Độ tuổi | 10+ |
| Thời lượng | Truyền thống 60–120 phút; Nhanh 45–60 phút |
| Đơn vị tiền | Tỷ đồng (ký hiệu hiển thị: "tỷ") |
| Mục tiêu | Người cuối cùng không phá sản (Truyền thống) hoặc tài sản cao nhất khi hết giờ (Nhanh) |
| Phong cách | Đông Hồ hiện đại, vui nhộn |

**Quy ước cho người lập trình (Claude Code):**

- Mọi ô, thẻ, nhân vật có ID cố định (P01, CH01, EV01, C01…). Dữ liệu số nằm trong file JSON (mục 9), không hard-code trong logic.
- "Vòng" (cho hiệu ứng ⏳) = từ lúc kích hoạt đến khi người kích hoạt bắt đầu lượt kế tiếp của họ.
- Máy chủ là nguồn sự thật duy nhất: xúc xắc, xáo bài, tính tiền đều chạy trên server.
- Mọi số tiền là số nguyên; phép tính phần trăm làm tròn lên (tiền thuê, phí) trừ khi ghi khác.

## 2. Bàn cờ 40 ô

Bàn cờ giữ nguyên vị trí ô của Monopoly gốc (để giữ cân bằng xác suất), đi ngược chiều kim đồng hồ từ ô 0. Gồm 22 bất động sản, 4 giao thông, 2 tiện ích, 6 ô thẻ, 2 ô thuế, 4 ô góc.

| Ô | ID | Tên | Loại | Nhóm |
| --- | --- | --- | --- | --- |
| 0 | GO | Hoàng thành Thăng Long | Góc: Xuất phát (di sản) | — |
| 1 | P01 | Đông Anh | BĐS | Nâu |
| 2 | CD | Cộng đồng | Thẻ | — |
| 3 | P02 | Gia Lâm | BĐS | Nâu |
| 4 | TAX1 | Thuế thu nhập cá nhân | Thuế | — |
| 5 | T01 | Bến xe Mỹ Đình | Giao thông | — |
| 6 | P03 | Hoàng Mai | BĐS | Xanh nhạt |
| 7 | CH | Cơ hội | Thẻ | — |
| 8 | P04 | Hà Đông | BĐS | Xanh nhạt |
| 9 | P05 | Bắc Từ Liêm | BĐS | Xanh nhạt |
| 10 | JAIL | Bãi giữ xe vi phạm | Góc: Tù / ghé qua | — |
| 11 | P06 | Thanh Xuân | BĐS | Hồng |
| 12 | U01 | Điện lực Hà Nội | Tiện ích | — |
| 13 | P07 | Mỹ Đình (Nam Từ Liêm) | BĐS | Hồng |
| 14 | P08 | Cầu Giấy | BĐS | Hồng |
| 15 | T02 | Metro Cát Linh – Hà Đông | Giao thông | — |
| 16 | P09 | Long Biên | BĐS | Cam |
| 17 | EV | Hanoi Event | Thẻ | — |
| 18 | P10 | Vinhomes Ocean Park | BĐS | Cam |
| 19 | P11 | Vinhomes Riverside | BĐS | Cam |
| 20 | PARK | Văn Miếu – Quốc Tử Giám | Góc: Quỹ khuyến học (di sản) | — |
| 21 | P12 | Hai Bà Trưng | BĐS | Đỏ |
| 22 | CH | Cơ hội | Thẻ | — |
| 23 | P13 | Times City | BĐS | Đỏ |
| 24 | P14 | Royal City | BĐS | Đỏ |
| 25 | T03 | Ga Hà Nội | Giao thông | — |
| 26 | P15 | Vincom Center Bà Triệu | BĐS | Vàng |
| 27 | P16 | Lotte Center Hanoi | BĐS | Vàng |
| 28 | U02 | Nước sạch Hà Nội | Tiện ích | — |
| 29 | P17 | Keangnam Landmark 72 | BĐS | Vàng |
| 30 | GOTOJAIL | CSGT thổi còi | Góc: Vào Bãi giữ xe | — |
| 31 | P18 | Đống Đa | BĐS | Xanh lá |
| 32 | P19 | Ba Đình | BĐS | Xanh lá |
| 33 | CD | Cộng đồng | Thẻ | — |
| 34 | P20 | Hồ Tây | BĐS | Xanh lá |
| 35 | T04 | Sân bay Nội Bài | Giao thông | — |
| 36 | EV | Hanoi Event | Thẻ | — |
| 37 | P21 | Phố cổ Hà Nội | BĐS | Xanh đậm |
| 38 | TAX2 | Phí gửi xe Phố cổ | Thuế | — |
| 39 | P22 | Hồ Gươm | BĐS | Xanh đậm |

Di sản không mua bán được: Hoàng thành Thăng Long (ô xuất phát, trước đây là Cửa Ô Quan Chưởng), Văn Miếu. Mã màu nhóm: Nâu #8B5A2B, Xanh nhạt #85B7EB, Hồng #ED93B1, Cam #EF9F27, Đỏ #E24B4A, Vàng #FAC775, Xanh lá #639922, Xanh đậm #0C447C (sẽ chỉnh lại theo bảng màu Đông Hồ ở mục 8).

## 3. Kinh tế & bất động sản

Thang giá dùng lại Monopoly gốc vì vị trí ô giống hệt, nên cân bằng đã được kiểm chứng. Đơn vị: tỷ.

### 3.1 Thông số chung

| Thông số | Giá trị |
| --- | --- |
| Tiền khởi đầu | 1.500 (nhân vật có thể đổi) |
| Lương qua Hoàng thành | 200 |
| Thuế thu nhập (ô 4) | 200 |
| Phí gửi xe Phố cổ (ô 38) | 100 |
| Phạt ra Bãi giữ xe | 50 |
| Thế chấp | 50% giá mua |
| Chuộc lại | Giá thế chấp + 10% |
| Bán nhà cho ngân hàng | 50% giá xây |
| Giới hạn công trình (tùy chọn phòng) | 48 nhà, 16 khách sạn (bàn 48 ô: 60 / 20; bàn 56 ô: 72 / 24) |

### 3.2 Bảng giá 22 bất động sản

Sở hữu đủ nhóm màu mà chưa xây: tiền thuê đất trống x2. Khách sạn = 4 nhà + 1 lần giá xây.

| ID | Tên | Nhóm | Giá mua | Đất trống | 1 nhà | 2 nhà | 3 nhà | 4 nhà | Khách sạn | Giá xây | Thế chấp |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P01 | Đông Anh | Nâu | 60 | 2 | 10 | 30 | 90 | 160 | 250 | 50 | 30 |
| P02 | Gia Lâm | Nâu | 60 | 4 | 20 | 60 | 180 | 320 | 450 | 50 | 30 |
| P03 | Hoàng Mai | Xanh nhạt | 100 | 6 | 30 | 90 | 270 | 400 | 550 | 50 | 50 |
| P04 | Hà Đông | Xanh nhạt | 100 | 6 | 30 | 90 | 270 | 400 | 550 | 50 | 50 |
| P05 | Bắc Từ Liêm | Xanh nhạt | 120 | 8 | 40 | 100 | 300 | 450 | 600 | 50 | 60 |
| P06 | Thanh Xuân | Hồng | 140 | 10 | 50 | 150 | 450 | 625 | 750 | 100 | 70 |
| P07 | Mỹ Đình | Hồng | 140 | 10 | 50 | 150 | 450 | 625 | 750 | 100 | 70 |
| P08 | Cầu Giấy | Hồng | 160 | 12 | 60 | 180 | 500 | 700 | 900 | 100 | 80 |
| P09 | Long Biên | Cam | 180 | 14 | 70 | 200 | 550 | 750 | 950 | 100 | 90 |
| P10 | Vinhomes Ocean Park | Cam | 180 | 14 | 70 | 200 | 550 | 750 | 950 | 100 | 90 |
| P11 | Vinhomes Riverside | Cam | 200 | 16 | 80 | 220 | 600 | 800 | 1.000 | 100 | 100 |
| P12 | Hai Bà Trưng | Đỏ | 220 | 18 | 90 | 250 | 700 | 875 | 1.050 | 150 | 110 |
| P13 | Times City | Đỏ | 220 | 18 | 90 | 250 | 700 | 875 | 1.050 | 150 | 110 |
| P14 | Royal City | Đỏ | 240 | 20 | 100 | 300 | 750 | 925 | 1.100 | 150 | 120 |
| P15 | Vincom Center Bà Triệu | Vàng | 260 | 22 | 110 | 330 | 800 | 975 | 1.150 | 150 | 130 |
| P16 | Lotte Center Hanoi | Vàng | 260 | 22 | 110 | 330 | 800 | 975 | 1.150 | 150 | 130 |
| P17 | Keangnam Landmark 72 | Vàng | 280 | 24 | 120 | 360 | 850 | 1.025 | 1.200 | 150 | 140 |
| P18 | Đống Đa | Xanh lá | 300 | 26 | 130 | 390 | 900 | 1.100 | 1.275 | 200 | 150 |
| P19 | Ba Đình | Xanh lá | 300 | 26 | 130 | 390 | 900 | 1.100 | 1.275 | 200 | 150 |
| P20 | Hồ Tây | Xanh lá | 320 | 28 | 150 | 450 | 1.000 | 1.200 | 1.400 | 200 | 160 |
| P21 | Phố cổ Hà Nội | Xanh đậm | 350 | 35 | 175 | 500 | 1.100 | 1.300 | 1.500 | 200 | 175 |
| P22 | Hồ Gươm | Xanh đậm | 400 | 50 | 200 | 600 | 1.400 | 1.700 | 2.000 | 200 | 200 |

### 3.3 Giao thông và tiện ích

| ID | Tên | Giá mua | Tiền thuê | Thế chấp |
| --- | --- | --- | --- | --- |
| T01–T04 | Bến xe Mỹ Đình, Metro Cát Linh – Hà Đông, Ga Hà Nội, Sân bay Nội Bài | 200 | Sở hữu 1/2/3/4 ô: 25/50/100/200 | 100 |
| U01–U02 | Điện lực Hà Nội, Nước sạch Hà Nội | 150 | 1 ô: 4 × tổng xúc xắc; cả 2: 10 × tổng xúc xắc | 75 |

Nhóm Cam và Đỏ có hiệu quả đầu tư tốt nhất (được dừng nhiều nhất sau Bãi giữ xe); Xanh đậm ít được dừng nhưng một lần trúng khách sạn Hồ Gươm (2.000) có thể gây phá sản.

## 4. Luật chơi

Luật nền theo Monopoly cổ điển, đã chỉnh cho chơi online: tiền thuê thu tự động, xây và thế chấp chỉ trong lượt của mình, giao dịch được đề nghị bất cứ lúc nào.

### 4.1 Chuẩn bị và thứ tự

1. Chủ phòng chọn cấu hình (mục 7.1). Máy chủ xáo 3 bộ thẻ.
2. Mỗi người tung 2 xúc xắc; tổng cao nhất đi trước, bằng nhau thì tung lại. Thứ tự lượt theo kết quả giảm dần.
3. Chọn nhân vật theo thứ tự ngược (người đi cuối chọn trước), mỗi nhân vật một người.
4. Phát tiền khởi đầu (1.500 hoặc theo nhân vật); mọi quân đứng ở ô 0.

### 4.2 Luồng một lượt

1. Đầu lượt: hết hạn các thẻ ⏳ do chính người này kích hoạt. Nếu đang ở Bãi giữ xe, xử lý mục 4.8.
2. (Tùy chọn) Xây, bán nhà, thế chấp, chuộc, dùng kỹ năng nhân vật.
3. Tung 2 xúc xắc, di chuyển tổng số bước. Đi qua hoặc dừng ở ô 0 nhận lương.
4. Xử lý ô dừng chân: mua/đấu giá, trả thuê, rút thẻ, nộp thuế, vào Bãi giữ xe, nhận Quỹ.
5. Tung đôi: lặp lại bước 3. Đôi lần 3 liên tiếp: không di chuyển, rút 1 thẻ Hanoi Event và xử lý, rồi vào thẳng Bãi giữ xe.
6. (Tùy chọn) Xây, thế chấp trước khi kết thúc lượt. Bấm Kết thúc lượt.

### 4.3 Mua đất và đấu giá

- Dừng ở ô chưa có chủ: mua theo giá in, hoặc từ chối để đấu giá ngay.
- Đấu giá: mọi người còn trong ván (kể cả người từ chối) được trả giá, giá khởi điểm 10, bước tối thiểu 10. Đồng hồ 10 giây, mỗi lần có giá mới đặt lại 5 giây. Không ai trả: ô vẫn thuộc ngân hàng.
- Không được trả giá vượt quá tiền mặt đang có.

### 4.4 Tiền thuê

- Thu tự động khi dừng chân. Đất thế chấp: không thu.
- Đủ nhóm màu, chưa xây: đất trống x2 (kể cả khi ô khác trong nhóm đang thế chấp).
- Chủ đang ở Bãi giữ xe vẫn thu.
- Thứ tự cộng dồn hệ số: tiền thuê cơ bản → x2 đủ nhóm → hệ số thẻ ⏳ (nhân lần lượt) → kỹ năng giảm (Ăn vạ) → làm tròn lên. Thưởng Idol TikTok tính trên số tiền thực trả.

### 4.5 Rút thẻ

- Rút lá trên cùng, thực hiện ngay, đặt xuống đáy bộ. Thẻ CH11 được giữ lại (giao dịch được), dùng xong mới về đáy.
- "Đi đến ô X": luôn đi tới, qua ô 0 thì nhận lương, xử lý ô như dừng chân thường. "Vào Bãi giữ xe": đi thẳng, không nhận lương.
- Thẻ ⏳: hiển thị ở giữa bàn; nhiều thẻ ⏳ cùng hiệu lực, mỗi thẻ hết hạn theo người đã rút.
- Thẻ trả tiền cho chủ một ô chưa có chủ: trả ngân hàng (hoặc vào Quỹ nếu thẻ ghi vậy).

### 4.6 Xây dựng

- Điều kiện: sở hữu đủ nhóm màu, không ô nào trong nhóm đang thế chấp, đang trong lượt của mình.
- Xây đều: chênh lệch tối đa 1 nhà giữa các ô cùng nhóm (cả khi bán).
- 4 nhà trên mọi ô của nhóm → nâng khách sạn (trả 1 lần giá xây, trả 4 nhà về kho).
- Giới hạn kho (nếu bật): hết nhà thì không xây được; bán khách sạn mà kho không đủ 4 nhà thì phải bán xuống mức có thể.
- Bán nhà/khách sạn: nhận 50% giá xây. Thẻ EV15 cấm xây mới, không cấm bán.

### 4.7 Thế chấp và giao dịch

- Thế chấp: nhận 50% giá mua; phải bán hết nhà cả nhóm trước. Chuộc: trả giá thế chấp + 10% (EV14: +0%, EV29: +20%).
- Giao dịch: gửi đề nghị bất cứ lúc nào gồm đất, tiền, thẻ CH11; tự hủy sau 30 giây. Không giao dịch đất có nhà. Không nợ, không hứa miễn thuê.
- Nhận đất thế chấp qua giao dịch: chuộc ngay, hoặc trả 10% lãi ngay và giữ nguyên thế chấp.

### 4.8 Bãi giữ xe

- Bị vào khi: dừng ô 30, thẻ CH10, CD16, EV19, hoặc tung đôi 3 lần. Dừng ô 10 do tung xúc xắc = ghé qua.
- Ra bằng: nộp 50 (vào Quỹ nếu bật), dùng thẻ CH11, hoặc tung đôi (đi theo số đó, không tung thêm). Tối đa 3 lượt; lượt 3 trượt đôi thì bắt buộc nộp 50 rồi đi.
- Trong Bãi giữ xe vẫn thu thuê, xây, giao dịch, thế chấp.

### 4.9 Quỹ khuyến học (ô 20)

- Vào Quỹ: thuế ô 4, phí ô 38, phạt ra Bãi giữ xe, mọi khoản trả ngân hàng từ thẻ, phí phát thải của nhân vật.
- Không vào Quỹ: mua đất, xây, đấu giá, chuộc.
- Dừng đúng ô 20 (xúc xắc hoặc thẻ CH17) nhận toàn bộ Quỹ, Quỹ về 0. Đi qua không nhận. Quỹ bắt đầu từ 0.
- Quỹ tắt: các khoản trên trả cho ngân hàng; ô 20 là ô nghỉ trống.

### 4.10 Phá sản và chiến thắng

- Không đủ tiền trả: hệ thống yêu cầu bán nhà/thế chấp/giao dịch (60 giây). Vẫn thiếu sau khi đã thanh lý hết → phá sản (Thiếu gia Vin được dùng kỹ năng trước).
- Nợ người chơi: chủ nợ nhận tiền, đất, thẻ; nhà bán về ngân hàng 50%, tiền chuyển cho chủ nợ; đất thế chấp xử lý như 4.7.
- Nợ ngân hàng: toàn bộ đất về ngân hàng, hủy thế chấp, đấu giá ngay từng ô.
- Thắng (Truyền thống): người cuối cùng còn lại.

### 4.11 Chế độ Nhanh

| Thay đổi | Chi tiết |
| --- | --- |
| Chia đất đầu ván | Mỗi người nhận ngẫu nhiên 2 ô (chỉ BĐS, giao thông, tiện ích), trả giá in cho ngân hàng. Nghện Tarot không nhận ô 14/24/34 |
| Lên khách sạn sớm | Chỉ cần 3 nhà mỗi ô |
| Bãi giữ xe | Tối đa 2 lượt |
| Kết thúc | Hết 60 phút hoặc khi người thứ 2 phá sản |
| Tính tài sản | Tiền mặt + giá mua đất (thế chấp tính 50%) + giá xây công trình; cao nhất thắng |
| Quỹ khuyến học | Tắt (SVBK nhận 150 khi dừng Văn Miếu) |

## 5. Bộ thẻ

Ba bộ thẻ, tổng 65 lá: Cơ hội (17, chủ yếu di chuyển), Cộng đồng (16, chủ yếu tiền), Hanoi Event (32, tác động cả bàn). Ô rút: Cộng đồng 2, 33; Cơ hội 7, 22; Hanoi Event 17, 36 và khi tung đôi 3 lần.

### 5.1 Cơ hội (CH)

| ID | Tên | Hiệu ứng |
| --- | --- | --- |
| CH01 | Bắt Grab ra Bờ Hồ | Đi đến Hồ Gươm (39) |
| CH02 | Về lại Hoàng thành | Đi đến ô 0, nhận lương |
| CH03 | Hẹn cà phê Hồ Tây | Đi đến Hồ Tây (34) |
| CH04 | Đi Times City xem phim | Đi đến Times City (23) |
| CH05 | Bắt xe buýt về Thanh Xuân | Đi đến Thanh Xuân (11) |
| CH06 | Ra sân bay đón người thân | Đi đến ô giao thông gần nhất phía trước; có chủ thì trả gấp đôi, chưa có thì được mua |
| CH07 | Đi tàu điện | Như CH06 |
| CH08 | Đóng tiền điện nước | Đi đến ô tiện ích gần nhất phía trước; có chủ thì tung xúc xắc, trả 10 × tổng |
| CH09 | Lạc đường, quay đầu xe | Lùi 3 ô (không nhận lương) |
| CH10 | Vượt đèn đỏ | Vào Bãi giữ xe |
| CH11 | Giấy tờ xe đầy đủ | Giữ lại; ra Bãi giữ xe miễn phí; giao dịch được |
| CH12 | Trúng hợp đồng kinh doanh | Nhận 150 |
| CH13 | Cổ phiếu chia cổ tức | Nhận 50 |
| CH14 | Phạt quá tốc độ trên Vành đai 3 | Trả 15 |
| CH15 | Cải tạo toàn bộ công trình | Trả 25/nhà, 100/khách sạn |
| CH16 | Làm tổ trưởng dân phố, khao cả xóm | Trả mỗi người chơi 50 |
| CH17 | Dâng hương Văn Miếu trước kỳ thi | Đi đến Văn Miếu (20) |

### 5.2 Cộng đồng (CD)

| ID | Tên | Hiệu ứng |
| --- | --- | --- |
| CD01 | Ngân hàng chuyển nhầm vào tài khoản bạn | Nhận 200 |
| CD02 | Lì xì Tết từ ông bà | Nhận 100 |
| CD03 | Nhận thừa kế | Nhận 100 |
| CD04 | Bảo hiểm đáo hạn | Nhận 100 |
| CD05 | Thanh lý đồ cũ trên chợ online | Nhận 50 |
| CD06 | Cho sinh viên thuê phòng trọ | Nhận 50 |
| CD07 | Nhận phí tư vấn | Nhận 25 |
| CD08 | Được hoàn thuế thu nhập | Nhận 20 |
| CD09 | Giải nhì thi gói bánh chưng | Nhận 10 |
| CD10 | Sinh nhật bạn | Mỗi người chơi chuyển bạn 10 |
| CD11 | Khám bệnh định kỳ | Trả 50 |
| CD12 | Đóng học phí | Trả 50 |
| CD13 | Ủng hộ đồng bào vùng lũ | Trả 50 |
| CD14 | Phường thu phí chỉnh trang đô thị | Trả 40/nhà, 115/khách sạn |
| CD15 | Về quê ăn Tết, khởi hành từ Hoàng thành | Đi đến ô 0, nhận lương |
| CD16 | Quên khóa xe, bị cẩu | Vào Bãi giữ xe |

### 5.3 Hanoi Event (EV)

⚡ = tức thời; ⏳ = kéo dài 1 vòng. Ô liên quan chưa có chủ: khoản tiền trả ngân hàng, trừ khi ghi khác. Thẻ 🎭 gắn nhân vật có phương án dự phòng.

| ID | Tên | Hiệu ứng | Loại |
| --- | --- | --- | --- |
| EV01 | Tết Nguyên Đán | Ngân hàng lì xì mỗi người 50 | ⚡ |
| EV02 | Mùa du lịch | Thuê Phố cổ, Hồ Gươm, Hồ Tây +50% | ⏳ |
| EV03 | Mưa lớn ngập phố | Mỗi chủ trả 15/nhà, 50/khách sạn | ⚡ |
| EV04 | Phố đi bộ cuối tuần | Ngân hàng trả 50 cho chủ mỗi ô Phố cổ, Hồ Gươm | ⚡ |
| EV05 | Tắc đường giờ cao điểm | Mọi người tung 1 xúc xắc (không có đôi); người trong Bãi giữ xe vẫn tung 2 để thử ra. Ninja Lead, Tài xế Grab miễn | ⏳ |
| EV06 | Lễ hội Thăng Long | Thuê nhóm Xanh lá, Xanh đậm +50% | ⏳ |
| EV07 | Trung thu phố Hàng Mã | Mỗi người trả 10 cho chủ Phố cổ | ⚡ |
| EV08 | Sốt đất ven đô | Thuê nhóm Nâu, Xanh nhạt x2 | ⏳ |
| EV09 | Khánh thành tuyến Metro mới | Ngân hàng trả 50 cho chủ mỗi ô giao thông | ⚡ |
| EV10 | Thanh tra thuế | Mỗi người nộp 10% tiền mặt (làm tròn xuống hàng chục); Thiếu gia Vin 20% | ⚡ |
| EV11 | Rét đậm, điện tăng giá | Mỗi người trả 20 cho chủ Điện lực | ⚡ |
| EV12 | Black Friday | Ngân hàng trả 30 cho chủ mỗi ô Times City, Royal City, Vincom, Lotte, Keangnam | ⚡ |
| EV13 | Nước sông Hồng lên | Chủ nhóm Cam trả 20 mỗi ô sở hữu | ⚡ |
| EV14 | Ngân hàng hạ lãi suất | Chuộc thế chấp không mất lãi | ⏳ |
| EV15 | Đóng băng thị trường BĐS | Không ai được xây mới | ⏳ |
| EV16 | Khai giảng năm học | Thuê nhóm Hồng +50% | ⏳ |
| EV17 | Chung cư mất điện cả ngày | Chủ nhóm Đỏ trả 20 mỗi ô sở hữu | ⚡ |
| EV18 | Vùng phát thải thấp | Dừng ở Phố cổ, Hồ Gươm, Ba Đình trả thêm 20 vào Quỹ; Tài xế Grab miễn | ⏳ |
| EV19 | Ra quân kiểm tra nồng độ cồn | Mỗi người tung 1 xúc xắc, ra 1 thì vào Bãi giữ xe; Ninja Lead miễn | ⚡ |
| EV20 | Countdown Hồ Gươm | Mỗi người trả 20 cho chủ Hồ Gươm | ⚡ |
| EV21 | Khởi công đại lộ sông Hồng | Thuê nhóm Cam +50% | ⏳ |
| EV22 | Sốt giá vàng | Người nhiều tiền mặt nhất nhận 100 (hòa thì chia đều, làm tròn xuống) | ⚡ |
| EV23 | Tuyển Việt Nam vô địch, đi bão Bờ Hồ | Mọi người nhận 30; chủ Hồ Gươm thêm 50 | ⚡ |
| EV24 | Lễ hội Áo dài Hà Nội | Ngân hàng trả 30 cho chủ Phố cổ, Hồ Tây; thêm 30 vào Quỹ | ⚡ |
| EV25 | Bão về, cây đổ | Mỗi chủ trả 50/khách sạn | ⚡ |
| EV26 | Phạt nguội camera AI | Mỗi người tung 1 xúc xắc, ra 6 trả 50 vào Quỹ (không ai miễn) | ⚡ |
| EV27 | 🎭 Grab tăng giá giờ cao điểm | Mỗi người trả 20 cho Tài xế Grab; dự phòng: mọi người trả 20 vào Quỹ | ⚡ |
| EV28 | Concert lớn ở Mỹ Đình | Ngân hàng trả 100 cho chủ Mỹ Đình (chưa có chủ: không ai nhận) | ⚡ |
| EV29 | Ngân hàng tăng lãi suất | Chuộc thế chấp mất 20% lãi | ⏳ |
| EV30 | Check-in phố đường tàu | Ngân hàng trả 50 cho chủ Ga Hà Nội | ⚡ |
| EV31 | 🎭 Phiên live triệu view | Mỗi người trả 20 cho Idol TikTok; dự phòng: người rút nhận 50 | ⚡ |
| EV32 | Mùa cưới, đi ăn cỗ | Mỗi người trả 30 vào Quỹ; Nô lệ tư bản trả 50 | ⚡ |

Khi một người phải trả cho chính mình (ví dụ chủ Phố cổ ở EV07), khoản đó bỏ qua. Mọi khoản "trả" từ thẻ của Idol TikTok nhân 1,5.

## 6. Nhân vật

Mỗi người chơi chọn 1 trong 8 nhân vật, gồm nội tại (+), điểm yếu (−) và kỹ năng dùng 1 lần/ván. Nhân vật cũng là quân cờ trên bàn. Chủ phòng có thể tắt hệ thống này (chế độ Cổ điển).

| ID | Nhân vật | Nội tại (+) | Điểm yếu (−) | Kỹ năng (1 lần/ván) |
| --- | --- | --- | --- | --- |
| C01 | Thiếu gia Vin | Lương 250. Mua P10, P11, P13, P14 giảm 20% | Thanh tra thuế (EV10) 20%. Thuế ô 4 trả 300 | Bố ơi cứu con: khi sắp phá sản, ngân hàng trả hộ tối đa 400 của khoản nợ |
| C02 | Ninja Lead | Dừng ô 30 không bị vào Bãi giữ xe (ở lại ô 30). Miễn EV05, EV19 | Dừng ở P21, P22 trả thêm 30 phí phát thải (vào Quỹ) | Ăn vạ: giảm 50% một lần trả tiền thuê |
| C03 | Tài xế Grab | Mỗi vòng 1 lần cộng hoặc trừ 1 bước sau khi tung, tối đa 3 lần/ván. Miễn EV05, EV18 | Lương 150 | Chạy cuốc đêm: tung lại xúc xắc, dùng kết quả mới |
| C04 | Idol TikTok | Nhận thêm 10% tiền thuê thu được (tối thiểu 10) từ ngân hàng | Mọi khoản phải trả từ thẻ x1,5 | Bóc phốt: chọn 1 đối thủ, đất của họ không thu thuê trong 1 vòng |
| C05 | Cò đất | Nhận 10 từ ngân hàng mỗi khi đối thủ mua đất từ ngân hàng (kể cả đấu giá) | Không được lên khách sạn | Tung tin quy hoạch: 1 nhóm màu tùy chọn, thuê x2 trong 1 vòng (mọi chủ đều hưởng) |
| C06 | Nghện Tarot | Rút thẻ Cơ hội, Cộng đồng: rút 2 chọn 1, lá còn lại về đáy | Không được sở hữu P08, P14, P20 (ô 14, 24, 34) | Giải hạn: hủy hiệu ứng của 1 thẻ Event đối với bản thân |
| C07 | SVBK | Dừng Văn Miếu nhận thêm 100 (150 khi Quỹ tắt). Mua nhóm Hồng giảm 20% | Bắt đầu 1.400 | Tốt nghiệp (tự động): từ lần qua ô 0 thứ 5, lương 250 |
| C08 | Nô lệ tư bản | Vốn khởi đầu thấp, giảm theo số người (số liệu ở `characters.json`) | Không (EV32 trả 50) | Du lịch: thay cho tung xúc xắc, chọn một ô bất kỳ rồi đi tới đó (qua Hoàng thành vẫn nhận lương, dừng ô nào xử lý như bình thường); không dùng khi ở Bãi giữ xe; hồi 10 lượt |

**Quy tắc và làm rõ:**

- Chọn theo thứ tự ngược lượt, mỗi nhân vật 1 người, tối đa 10 phút mỗi người. Hết giờ chọn: gán ngẫu nhiên.
- Giảm giá mua chỉ áp dụng khi mua theo giá in, không áp dụng cho đấu giá và giao dịch.
- "Vòng" của Tài xế Grab = giữa hai lần qua ô 0. Điều chỉnh bước không làm mất hay tạo đôi.
- Ninja Lead ở lại ô 30 vẫn bị vào Bãi giữ xe do thẻ CH10, CD16 hoặc đôi 3 lần.
- Nghện Tarot rút phải thẻ đi đến ô bị cấm: vẫn di chuyển, nếu chưa có chủ thì đấu giá ngay (không được tham gia).
- Bóc phốt và Tung tin quy hoạch hết hạn khi người dùng bắt đầu lượt kế tiếp, như thẻ ⏳.
- Các con số là bản nháp; chỉnh theo tỉ lệ thắng từ công cụ mô phỏng (mục 7.4). Mục tiêu: mọi nhân vật có tỉ lệ thắng trong khoảng ±3 điểm phần trăm quanh mức trung bình.
- Nhân vật thêm sau (C09–C17: Con bạc, Thợ xây, F0 chứng khoán, Tổ trưởng dân phố, Thánh săn sale, Chủ trọ, Thầy phong thủy, Tín dụng đen, Bác sĩ lạ) và các con số hiện hành: `data/characters.json`, lý do thiết kế trong `docs/decisions.md`. Kỹ năng nay hồi lại sau vài lượt thay vì 1 lần/ván.
- Đã chỉnh sau mô phỏng 10.000 ván (2026-11-09): Tài xế Grab giới hạn 3 lần ±1 mỗi ván (trước: không giới hạn, +11 điểm %); SVBK bắt đầu 1.400 (trước: 1.200, −5 đến −8 điểm %). Chi tiết: `docs/decisions.md`.

## 7. Online multiplayer & kỹ thuật

Kiến trúc server-authoritative: React client chỉ gửi hành động và hiển thị; Colyseus server giữ trạng thái, chạy luật, tung xúc xắc, xáo bài.

### 7.1 Cấu hình phòng

| Tham số | Giá trị | Mặc định |
| --- | --- | --- |
| mode | classic / quick | classic |
| characters | bật / tắt | bật |
| scholarshipFund (Quỹ khuyến học) | bật / tắt | bật (classic), tắt (quick) |
| buildingLimit | bật / tắt | bật |
| maxPlayers | 2–6 | 6 |
| allowSpectators | bật / tắt | bật |
| Vào phòng | Mã phòng 6 ký tự hoặc link mời | — |

### 7.2 Đồng hồ và kết nối

| Tình huống | Giới hạn | Hết giờ thì |
| --- | --- | --- |
| Tung xúc xắc | 15 giây | Tự tung |
| Quyết định mua | 20 giây | Từ chối → đấu giá |
| Cả lượt | 90 giây | Tự kết thúc lượt |
| Đấu giá | 10 giây, đặt lại 5 giây mỗi lần trả giá | Chốt người trả cao nhất |
| Đề nghị giao dịch | 30 giây | Tự hủy |
| Thanh lý khi thiếu tiền | 60 giây | Hệ thống tự bán nhà rồi thế chấp từ nhóm rẻ nhất |
| Chọn nhân vật | 10 phút mỗi người | Gán ngẫu nhiên |
| Mất kết nối | 60 giây | Bot chơi thay, người chơi quay lại được bất cứ lúc nào |
| Treo máy | Hết giờ 3 lượt liên tiếp | Bot chơi thay đến hết ván |

### 7.3 Thành phần hệ thống

1. **Client (React + Vite hoặc Next.js)**: màn hình mục 8, nhận state từ server, gửi action. Không chứa luật.
2. **Game server (Colyseus, TypeScript)**: mỗi phòng một `GameRoom`; state gồm players, board ownership, decks, activeEffects, fund, turn, phase, log.
3. **Rules engine (thuần TypeScript, không phụ thuộc mạng)**: hàm `applyAction(state, action) → state` và các hook nhân vật/thẻ (`onPassGo`, `onLand`, `onPayRent`, `onDrawCard`, `onTurnStart`, `onBankrupt`). Dùng chung cho server, bot và mô phỏng.
4. **Dữ liệu JSON** (mục 9): board, properties, cards, characters, config. Engine đọc, không hard-code.
5. **RNG có seed** trên server, ghi seed vào log để phát lại ván khi debug.

**Danh sách action từ client:** `roll`, `buy`, `declineBuy`, `bid`, `build`, `sellBuilding`, `mortgage`, `unmortgage`, `proposeTrade`, `respondTrade`, `payJailFine`, `useJailCard`, `useSkill`, `chooseCard` (Nghện Tarot), `adjustStep` (Tài xế Grab), `endTurn`, `chat`, `emote`.

### 7.4 Bot và cân bằng

- Bot cơ bản: luôn mua nếu còn ≥ 200 sau khi mua; xây đến 3 nhà khi đủ nhóm, dư tiền (còn ≥ 1.000 sau khi xây) thì xây tiếp lên khách sạn; đấu giá đến tối đa giá in; từ chối giao dịch trừ khi giúp hoàn thành nhóm.
- Công cụ mô phỏng CLI: chạy N ván bot vs bot, xuất tỉ lệ thắng theo nhân vật, độ dài ván, tần suất dừng từng ô, lợi nhuận theo nhóm màu. Mục tiêu: 10.000 ván mỗi lần chạy.

## 8. Giao diện, đồ họa, âm thanh

Phong cách Đông Hồ hiện đại: nét khắc gỗ, nền giấy dó, màu đất, vẽ cả địa danh cổ lẫn đồ vật hiện đại (tòa tháp, xe Grab, điện thoại livestream).

### 8.1 Màn hình

| ID | Màn hình | Nội dung |
| --- | --- | --- |
| S1 | Trang chủ | Tạo phòng, vào bằng mã, hướng dẫn chơi |
| S2 | Phòng chờ | Người chơi, cấu hình phòng, sẵn sàng, chat |
| S3 | Chọn nhân vật | 8 thẻ nhân vật, đếm ngược, thứ tự chọn |
| S4 | Bàn cờ | 40 ô, quân = avatar nhân vật; giữa bàn: Quỹ khuyến học, thẻ ⏳ đang hiệu lực, xúc xắc; bên cạnh: bảng người chơi, nhật ký, chat |
| S5 | Chi tiết ô | Giá, bảng thuê, chủ, số nhà, trạng thái thế chấp |
| S6 | Cửa sổ quyết định | Mua, đấu giá, rút thẻ (hoạt ảnh lật), Bãi giữ xe, dùng kỹ năng |
| S7 | Giao dịch | Hai cột đất + tiền, gửi / chấp nhận / từ chối / trả giá |
| S8 | Quản lý tài sản | Xây, bán, thế chấp, chuộc theo nhóm màu |
| S9 | Kết thúc ván | Xếp hạng, thống kê (ô sinh lời nhất, tổng thuê đã trả), chơi lại |

Bố cục: desktop trước (bàn cờ vuông bên trái, panel bên phải); mobile web: bàn cờ phóng to/thu nhỏ, panel thành ngăn kéo dưới.

### 8.2 Bảng màu

| Vai trò | Màu | Hex |
| --- | --- | --- |
| Nền giấy dó | Kem điệp | #F3E9D2 |
| Nét khắc, chữ | Đen than | #2B2522 |
| Nhấn chính | Đỏ son | #B8312F |
| Nhấn phụ | Vàng nghệ | #E3A72F |
| Nhóm Nâu | Nâu đất | #8A5A3B |
| Nhóm Xanh nhạt | Xanh tro | #8FB3C9 |
| Nhóm Hồng | Hồng điệp | #E7A6A1 |
| Nhóm Cam | Cam gạch | #D9822B |
| Nhóm Đỏ | Đỏ son | #B8312F |
| Nhóm Vàng | Vàng nghệ | #E3A72F |
| Nhóm Xanh lá | Xanh lá cây chàm | #5F7F3A |
| Nhóm Xanh đậm | Xanh chàm | #2E4A7D |

### 8.3 Chữ, minh họa, âm thanh

- Font nội dung: Be Vietnam Pro. Font tiêu đề: một font có chân hỗ trợ đủ dấu tiếng Việt, nét gợi thư pháp (chọn khi làm UI).
- Minh họa: mỗi BĐS một tranh nhỏ kiểu Đông Hồ; mỗi nhân vật một chân dung + avatar tròn làm quân cờ; mặt sau thẻ theo bộ (Cơ hội: đỏ son, Cộng đồng: vàng nghệ, Event: xanh chàm với họa tiết trống đồng). Nhà = nhà ống mái ngói; khách sạn = tòa cao tầng.
- Âm thanh: xúc xắc trong bát (tung), còi CSGT (vào Bãi giữ xe), chuông xe đạp (qua Hoàng thành), "ting ting" chuyển khoản (mua đất), trống hội (Hanoi Event), pháo hoa (chiến thắng). Có nút tắt tiếng.

## 9. Phụ lục: dữ liệu và việc còn mở

Toàn bộ số liệu trong tài liệu này đã được xuất thành 5 file JSON gửi kèm. Khi lệch nhau, file JSON là nguồn dữ liệu cho code; tài liệu này là nguồn cho ý đồ thiết kế.

| File | Nội dung |
| --- | --- |
| board.json | 40 ô, 8 nhóm màu (tên, màu), 22 BĐS, 4 giao thông, 2 tiện ích |
| economy.json | Tiền khởi đầu, lương, thuế, phạt, thế chấp, bảng thuê giao thông/tiện ích, đấu giá |
| cards.json | 17 Cơ hội, 16 Cộng đồng, 32 Hanoi Event, mỗi thẻ có `effect.type` có cấu trúc |
| characters.json | 8 nhân vật với passives, drawbacks, skill dạng dữ liệu |
| config.json | Cấu hình phòng, đồng hồ, chế độ Nhanh, Quỹ khuyến học |

**Lộ trình gợi ý cho Claude Code:**

1. Rules engine thuần TypeScript + unit test cho từng loại `effect.type`.
2. Công cụ mô phỏng bot, chạy cân bằng nhân vật trước khi làm giao diện.
3. Colyseus server: phòng, đồng hồ, mất kết nối, bot thay thế.
4. React client: S4 Bàn cờ trước, rồi S6, S7, S8, sau cùng S1–S3, S9.
5. Đồ họa Đông Hồ và âm thanh.

**Việc còn mở:**

- [ ] Chọn font tiêu đề có chân hỗ trợ tiếng Việt
- [ ] Chỉnh số liệu nhân vật theo kết quả mô phỏng
- [ ] Quyết định có chế độ chơi với bot (solo) hay chỉ online
- [ ] Quyết định có tài khoản người dùng/bảng xếp hạng hay chỉ chơi theo phòng
- [ ] Nếu phát hành công khai: rà lại tên thương hiệu (Monopoly, Vinhomes, Grab…) và nhân vật Thiếu gia Vin
