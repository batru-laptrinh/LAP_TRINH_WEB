# Bài thực hành 6 — Website hội thảo khoa học

Website chủ đề **Chuyển đổi số và phát triển bền vững**, viết bằng HTML, CSS và JavaScript thuần theo mô hình **MVC phía trình duyệt**. Giao diện đơn giản, phù hợp máy tính, máy tính bảng và điện thoại. Không dùng framework, không cần cài thư viện npm.

Thời gian, địa điểm, diễn giả, chân dung và thông tin liên hệ đều là dữ liệu minh họa cho bài tập.

## 1. Mở và chạy bằng VS Code

### Cách 1: Node.js (khuyên dùng)

1. Cài [VS Code](https://code.visualstudio.com/) và [Node.js](https://nodejs.org/) phiên bản 20 trở lên.
2. Giải nén mã nguồn nếu tải file ZIP. Trong VS Code, chọn **File → Open Folder**, mở thư mục chứa `index.html` và `package.json`.
3. Chọn **Terminal → New Terminal**, chạy:

   ```sh
   npm start
   ```

4. Mở `http://localhost:3000` trong trình duyệt. Dừng máy chủ bằng **Ctrl+C**.

Không cần chạy `npm install` vì dự án không có thư viện phụ thuộc. Có thể dùng **Terminal → Run Task → Chạy website** thay cho lệnh trên. Máy chủ chỉ phục vụ file tĩnh, không xử lý đăng ký hay lưu dữ liệu trên server.

Nếu cổng 3000 đang được dùng, chọn cổng khác:

```powershell
# PowerShell trên Windows
$env:PORT=3001; npm start
```

```sh
# macOS / Linux
PORT=3001 npm start
```

Khi đó mở `http://localhost:3001`. Cấu hình chạy thử Edge bằng F5 có sẵn trong `.vscode/launch.json`, sử dụng cổng 3000 và yêu cầu máy chủ đã chạy.

### Cách 2: Live Server

Trong VS Code, cài tiện ích **Live Server** của Ritwick Dey. Nhấp chuột phải vào `index.html` → **Open with Live Server**. Cách này không cần Node.js để xem web.

**Không mở bằng cách nhấp đúp `index.html` (`file://`)**: trình duyệt có thể chặn ES Modules và localStorage. Luôn chạy qua một máy chủ HTTP. Đăng ký được tách biệt theo trình duyệt và địa chỉ web: đổi cổng hoặc đổi giữa `localhost` và `127.0.0.1` sẽ dùng vùng dữ liệu khác.

## 2. Cấu trúc MVC

```text
LAP_TRINH_WEB/
├── index.html                          # Khung giao diện và nội dung hội thảo
├── css/
│   └── style.css                       # Bố cục, responsive, menu điện thoại
├── assets/
│   └── speaker-1.svg ... speaker-4.svg  # Ảnh minh họa lưu cục bộ
├── js/
│   ├── app.js                          # Khởi tạo MVC
│   ├── models/
│   │   └── registration-model.js       # Kiểm tra, lưu/xóa, thống kê dữ liệu
│   ├── views/
│   │   └── registration-view.js        # Đọc form, hiển thị lỗi và kết quả
│   └── controllers/
│       └── registration-controller.js  # Tiếp nhận sự kiện, kết nối Model–View
├── tests/
│   ├── registration-model.test.js      # Kiểm thử tự động bằng Node.js
│   └── browser_smoke.py                # Kiểm thử trình duyệt (tùy chọn)
├── .vscode/                            # Cấu hình hỗ trợ VS Code
├── package.json                        # Lệnh chạy và kiểm thử
└── server.js                           # Máy chủ tĩnh, không phải backend MVC
```

Luồng đăng ký: người dùng gửi form → **Controller** nhận sự kiện → **View** đọc dữ liệu → **Model** kiểm tra và lưu vào `localStorage` → **Controller** yêu cầu **View** cập nhật kết quả, danh sách và thống kê. Model không truy cập DOM; View không tự lưu dữ liệu.

## 3. Chức năng theo đề

- Đầu trang có tên đơn vị tổ chức, menu và nút đăng ký; banner có chủ đề, thời gian, địa điểm và nút xem chương trình.
- Giới thiệu mục đích, đối tượng tham gia và 3 chủ đề thảo luận.
- 4 diễn giả có ảnh, họ tên, đơn vị và chủ đề trình bày; 9 hoạt động trong bảng chương trình.
- Form có đầy đủ họ tên, email, điện thoại, đơn vị, đối tượng, hình thức, chủ đề quan tâm, ghi chú và đồng ý sử dụng thông tin.
- Họ tên sau khi bỏ khoảng trắng đầu/cuối có ít nhất 2 ký tự; email hợp lệ; điện thoại đúng 10 chữ số và bắt đầu bằng 0; đơn vị bắt buộc; các lựa chọn hợp lệ; ít nhất một chủ đề; ghi chú tối đa 300 ký tự; phải xác nhận đồng ý.
- Lỗi xuất hiện cạnh trường liên quan, giữ nguyên dữ liệu khi có lỗi và chuyển đến trường lỗi đầu tiên.
- Đăng ký hợp lệ hiển thị họ tên, email, đơn vị và hình thức, sau đó làm trống form để nhập người tiếp theo.
- Email trùng bị chặn sau khi bỏ khoảng trắng đầu/cuối và chuyển về chữ thường.
- Lưu danh sách bằng `localStorage`; tải lại trang vẫn còn; thống kê tổng, trực tiếp, trực tuyến.
- Xóa từng đăng ký sau khi xác nhận, cập nhật danh sách và thống kê.
- Menu điện thoại mở/đóng, đóng sau khi chọn mục hoặc nhấn Escape; điều hướng đến các phần nội dung.
- Thông tin liên hệ và chân trang có bản quyền, liên kết về đầu trang.

## 4. Thử nhanh

1. Đăng ký với họ tên `Nguyễn Văn An`, email `an@example.com`, điện thoại `0901234567`, đơn vị `Trường Đại học Minh Họa`, chọn đối tượng, hình thức **Trực tiếp**, một chủ đề và đồng ý sử dụng thông tin.
2. Kiểm tra xác nhận, danh sách và thống kê `Tổng: 1`, `Trực tiếp: 1`, `Trực tuyến: 0`.
3. Tải lại trang: danh sách và thống kê còn nguyên.
4. Đăng ký lại với `AN@EXAMPLE.COM`: phải báo trùng email và giữ form.
5. Đăng ký email khác với hình thức **Trực tuyến**: tổng tăng lên 2, mỗi hình thức là 1.
6. Nhấn **Xóa đăng ký**, thử **Hủy** rồi **Đồng ý**, kiểm tra thống kê và tải lại trang.
7. Bỏ trống form, nhập điện thoại sai hoặc bỏ đồng ý để kiểm tra lỗi. Thu nhỏ cửa sổ để kiểm tra menu điện thoại.

Chạy kiểm thử Model (không cần máy chủ):

```sh
npm test
```

Bộ kiểm thử trình duyệt là tùy chọn, cần Python, Playwright và Chromium; xem phần đầu `tests/browser_smoke.py` để biết cách chạy. Các công cụ này chỉ phục vụ kiểm thử, không cần để chạy web.

## 5. Giới hạn và dữ liệu

Đây là mô phỏng đăng ký **chỉ trên trình duyệt**, không có tài khoản quản trị, database, gửi email hay API nhận đăng ký. Không nhập dữ liệu cá nhân thật. Dữ liệu không đồng bộ giữa các thiết bị; xóa dữ liệu trang web trong trình duyệt sẽ xóa đăng ký.

Nếu trình duyệt chặn bộ nhớ, hết dung lượng hoặc dữ liệu lưu bị hỏng, web hiển thị thông báo và không báo đăng ký thành công khi chưa lưu được. Dữ liệu cũ không bị tự động ghi đè khi đọc thất bại. Có thể xem/xóa dữ liệu bài tập tại **DevTools → Application → Local Storage**, khóa `scientific-conference.registrations.v1` (Firefox: **Storage**). Chỉ xóa khóa này nếu chấp nhận mất các đăng ký đã lưu.

Để đổi nội dung hội thảo, sửa `index.html`. Để đổi màu, cỡ chữ và bố cục, sửa `css/style.css`. Nếu đổi các giá trị lựa chọn của form, cập nhật danh sách tương ứng trong Model và kiểm thử để chúng thống nhất.
