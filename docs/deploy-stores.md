# Phát hành bản app: Steam, Google Play, App Store

Bản app là cùng một client React, bọc trong vỏ native. Luật chơi, server và dữ liệu không đổi; app vẫn nối về server Colyseus trên Render.

| Nền tảng | Vỏ | Thư mục |
|---|---|---|
| Android, iOS | Capacitor 8 | `packages/mobile` |
| Windows / macOS / Linux (Steam) | Electron | `packages/desktop` |

Client có thêm chế độ build `app` (`pnpm --filter @hanoi-monopoly/client run build:app`), xuất ra `packages/client/dist-app`. Địa chỉ server và địa chỉ web cho link mời nằm trong `packages/client/.env.app`. Đổi server thì sửa file này rồi build lại.

## Việc cần làm trước khi nộp bất kỳ store nào

- **Server**: gói Render miễn phí ngủ sau một lúc không dùng, lần mở đầu chờ khá lâu. Người chơi tải app từ store sẽ gặp màn hình treo, và người duyệt app cũng vậy. Nên nâng gói trả phí trước khi nộp.
- **Tên và thương hiệu**: "Monopoly" là nhãn hiệu của Hasbro. Không dùng chữ này trong tên app, mô tả, từ khóa hay ảnh chụp. Mã app đã đặt là `com.cotyphuhanoi.app`; muốn đổi thì đổi **trước lần tải lên đầu tiên**, sau đó không đổi được.
- **Icon và màn hình chờ**: project Android/iOS đang dùng icon mặc định của Capacitor. Cần một icon 1024×1024, rồi chạy `npx @capacitor/assets generate` trong `packages/mobile`.
- **Chính sách quyền riêng tư**: cả ba store đều đòi một trang web công khai.
- **Thử trên máy thật**: bố cục màn hình dọc, tai thỏ, bàn phím ảo chưa được kiểm tra trên điện thoại thật.

## Steam

1. Đăng ký Steamworks, đóng phí Steam Direct (khoảng 100 USD mỗi game), hoàn tất hồ sơ thuế và ngân hàng. Nhận App ID và Depot ID.
2. Build: `pnpm --filter @hanoi-monopoly/desktop run dist` → `packages/desktop/release/win-unpacked`.
3. Tải lên bằng `steamcmd` (`app_build` trỏ vào thư mục trên), đặt file chạy là `Co Ty Phu Ha Noi.exe` trong phần Launch Options.
4. Làm trang cửa hàng (ảnh, trailer, mô tả), gửi duyệt cả trang lẫn bản build. Steam bắt trang "Coming soon" hiển thị một thời gian trước ngày phát hành.

Chưa tích hợp Steamworks SDK (thành tựu, mời bạn qua Steam, overlay). Steam không bắt buộc; khi có App ID có thể thêm bằng `steamworks.js`.

## Google Play

1. Tạo tài khoản Google Play Console (phí một lần, khoảng 25 USD).
2. Cài Android Studio, rồi: `pnpm --filter @hanoi-monopoly/mobile run android`.
3. Trong Android Studio: Build → Generate Signed App Bundle, tạo keystore (giữ kỹ, mất là không cập nhật được app). Ra file `.aab`.
4. Tải `.aab` lên Play Console, điền phân loại nội dung, an toàn dữ liệu, ảnh chụp.
5. Tài khoản cá nhân mới phải chạy thử nghiệm kín với một nhóm người thử trong một thời gian trước khi được mở công khai — xem yêu cầu hiện hành trong Play Console.

Mỗi lần cập nhật tăng `versionCode` trong `packages/mobile/android/app/build.gradle`.

## App Store (iOS)

1. Đăng ký Apple Developer Program (khoảng 99 USD mỗi năm).
2. **Cần máy Mac có Xcode** để ký và tải lên. Không có Mac thì dùng dịch vụ build đám mây (Codemagic, Xcode Cloud, hoặc runner macOS của GitHub Actions kèm chứng chỉ ký).
3. Trên Mac: `pnpm --filter @hanoi-monopoly/mobile run ios`, chọn Team trong Signing & Capabilities, Product → Archive → Distribute App.
4. Tạo app trong App Store Connect, thử qua TestFlight, rồi gửi duyệt.

Apple hay từ chối app chỉ là trang web bọc lại (mục 4.2 trong hướng dẫn duyệt). Game có đồ họa 3D và chơi nhiều người thời gian thực nên có cơ sở để qua, nhưng nên chuẩn bị tinh thần bị hỏi lại.

## Build kiểm tra trên GitHub Actions

Workflow `Apps` (`.github/workflows/apps.yml`, chạy tay) build APK debug, bản iOS cho simulator và thư mục Windows. Đây là bản không ký, để biết project còn build được, không phải bản nộp store.
