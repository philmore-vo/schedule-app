# 🧠 TaskFlow AI — Ứng dụng Quản lý Công việc Thông minh

<p align="center">
  <strong>Dành cho những người hay trì hoãn, khó quản lý thời gian, và không biết nên làm task nào trước.</strong>
</p>

---

## 📋 Mục lục

1. [Giới thiệu](#-giới-thiệu)
2. [Tính năng chính](#-tính-năng-chính)
3. [Cài đặt (Dành cho người mới)](#-cài-đặt-dành-cho-người-mới)
4. [Hướng dẫn lấy API Key miễn phí](#-hướng-dẫn-lấy-api-key-miễn-phí)
5. [Hướng dẫn sử dụng](#-hướng-dẫn-sử-dụng)
6. [Phím tắt](#-phím-tắt)
7. [Câu hỏi thường gặp (FAQ)](#-câu-hỏi-thường-gặp-faq)
8. [Xử lý lỗi](#-xử-lý-lỗi)

---

## 🎯 Giới thiệu

**TaskFlow AI** là ứng dụng desktop giúp bạn:

- ✅ Ghi lại tất cả công việc cần làm (kèm deadline, thời gian ước tính)
- 🤖 **AI tự động sắp xếp** thứ tự ưu tiên — bạn không cần suy nghĩ nên làm gì trước
- 💬 **Chat AI** hỗ trợ — hỏi bất cứ điều gì về quản lý thời gian
- 💾 Dữ liệu được **lưu vĩnh viễn** trên máy tính (không mất khi tắt app)

> 💡 **Ai nên dùng?** Sinh viên, freelancer, nhân viên văn phòng — bất kỳ ai cảm thấy "có quá nhiều việc phải làm nhưng không biết bắt đầu từ đâu".

---

## ✨ Tính năng chính

| Tính năng | Mô tả |
|-----------|-------|
| 📝 **Quản lý Task** | Thêm, sửa, xóa, đánh dấu hoàn thành |
| ⏰ **Deadline & Duration** | Ghi deadline và thời gian ước tính cho mỗi task |
| 🏷️ **Phân loại** | Chia task theo: Work, Personal, Study, Health, Finance |
| 🚦 **Mức độ ưu tiên** | 4 mức: Critical > High > Medium > Low |
| 🤖 **AI Scheduling** | AI phân tích và sắp xếp thứ tự ưu tiên tối ưu |
| 💬 **AI Chat** | Chat trực tiếp với AI để được tư vấn |
| 🎓 **Moodle Sync** | Tự động import deadline từ Moodle (LMS trường học) |
| 🌙 **Dark / Light mode** | Giao diện tối hoặc sáng |
| 💾 **Lưu tự động** | Dữ liệu lưu vào file, không mất khi tắt app |
| 📊 **Thống kê** | Hiển thị số task, tổng thời gian, task hoàn thành |

---

## 🚀 Cài đặt (Dành cho người mới)

### 📥 Bước 1: Tải app về máy

<p align="center">
  <a href="https://github.com/philmore-vo/schedule-app/archive/refs/heads/main.zip">
    <img src="https://img.shields.io/badge/⬇️_TẢI_VỀ_MÁY-TaskFlow_AI-7c3aed?style=for-the-badge&logo=windows&logoColor=white" alt="Download" />
  </a>
</p>

> 👆 **Nhấn nút trên** hoặc copy link này vào trình duyệt:
> ```
> https://github.com/philmore-vo/schedule-app/archive/refs/heads/main.zip
> ```

### 📂 Bước 2: Giải nén

1. Sau khi tải về, bạn sẽ có file **`schedule-app-main.zip`**
2. **Click chuột phải** → chọn **"Extract All..."** (Giải nén tất cả)
3. Chọn nơi lưu (ví dụ: Desktop) → nhấn **Extract**
4. Mở thư mục **`schedule-app-main`** vừa giải nén

### ⚡ Bước 3: Cài đặt tự động (1 click)

1. **Click đúp** vào file **`setup.bat`** trong thư mục vừa giải nén
2. Chương trình setup sẽ tự động:
   - ✅ Kiểm tra và cài Node.js (nếu máy chưa có)
   - ✅ Cài đặt thư viện Electron
   - ✅ Hỏi bạn có muốn tạo shortcut trên Desktop không
   - ✅ Hỏi bạn có muốn chạy app ngay không
3. **Xong!** Từ giờ chỉ cần click **"TaskFlow AI"** trên Desktop để mở app.

### Cách 2: Cài đặt thủ công

Nếu bạn biết dùng terminal:

```bash
# Bước 1: Cài Node.js (nếu chưa có)
# Tải tại: https://nodejs.org → chọn LTS → cài đặt

# Bước 2: Mở terminal, vào thư mục app
cd đường-dẫn-tới-thư-mục/schedule-app

# Bước 3: Cài thư viện
npm install

# Bước 4: Chạy app
npm start
```

---

## 🔑 Hướng dẫn lấy API Key miễn phí

App cần **API Key** để sử dụng tính năng AI (sắp xếp tasks và chat). Dưới đây là cách lấy **miễn phí**:

### Tùy chọn 1: Google Gemini (Đã cài sẵn) ⭐

App đã được cài sẵn API key Gemini. Bạn **không cần làm gì thêm**, mở app và dùng thôi!

> ⚠️ Nếu gặp lỗi "Rate limit" (429), nghĩa là đã hết lượt miễn phí trong ngày. Chờ đến ngày mai hoặc dùng Groq (xem bên dưới).

### Tùy chọn 2: Groq (Miễn phí, nhanh hơn, ổn định hơn) ⭐⭐

Groq là dịch vụ AI miễn phí, cực nhanh, và ít bị giới hạn hơn Gemini.

**Bước 1:** Vào [console.groq.com](https://console.groq.com)

**Bước 2:** Đăng nhập bằng tài khoản Google

**Bước 3:** Nhấn **"Create API Key"**
- Đặt tên bất kỳ (ví dụ: "TaskFlow")
- Copy key bắt đầu bằng `gsk_...`

**Bước 4:** Trong app TaskFlow AI, nhấn **⚙️ Settings** (góc trên phải)
- **API Key**: Paste key vừa copy
- **API Endpoint**: `https://api.groq.com/openai/v1`
- **Model**: `llama-3.3-70b-versatile`
- Nhấn **Save Settings**

**Xong!** Bây giờ bạn có thể dùng AI Schedule và Chat.

### Tùy chọn 3: Tự tạo key Gemini mới

Nếu key Gemini mặc định bị hết quota, bạn có thể tạo key riêng:

**Bước 1:** Vào [aistudio.google.com/apikey](https://aistudio.google.com/apikey)

**Bước 2:** Đăng nhập bằng tài khoản Google

**Bước 3:** Nhấn **"Create API Key"** → copy key bắt đầu bằng `AIza...`

**Bước 4:** Trong app, nhấn **⚙️ Settings**
- **API Key**: Paste key mới
- **API Endpoint**: `https://generativelanguage.googleapis.com/v1beta/openai`
- **Model**: `gemini-2.0-flash`
- Nhấn **Save Settings**

### Tùy chọn 4: OpenAI ChatGPT (Trả phí)

Nếu bạn có tài khoản OpenAI trả phí:

**Bước 1:** Vào [platform.openai.com/api-keys](https://platform.openai.com/api-keys)

**Bước 2:** Tạo API key → copy key bắt đầu bằng `sk-...`

**Bước 3:** Trong app, nhấn **⚙️ Settings**
- **API Key**: Paste key
- **API Endpoint**: `https://api.openai.com/v1`
- **Model**: `gpt-4o-mini` (rẻ) hoặc `gpt-4o` (mạnh hơn)
- Nhấn **Save Settings**

> ⚠️ OpenAI tính phí. Cần nạp tối thiểu $5 vào tài khoản.

### Bảng so sánh

| Dịch vụ | Miễn phí? | Tốc độ | Chất lượng | Ghi chú |
|---------|-----------|--------|-----------|---------|
| **Gemini** | ✅ Có | ⚡ Nhanh | ⭐⭐⭐⭐ | Giới hạn ~1500 request/ngày |
| **Groq** | ✅ Có | ⚡⚡ Rất nhanh | ⭐⭐⭐⭐ | Giới hạn 30 request/phút |
| **OpenAI** | ❌ Trả phí | ⚡ Nhanh | ⭐⭐⭐⭐⭐ | ~$0.01/lần gọi |

---

## 📖 Hướng dẫn sử dụng

### 1. Thêm task mới

1. Nhấn nút **"＋ New Task"** (bên trái dưới) hoặc **"＋ Add Task"** (góc phải trên)
2. Điền thông tin:
   - **Title**: Tên công việc (bắt buộc)
   - **Description**: Mô tả chi tiết (tuỳ chọn)
   - **Deadline**: Hạn chót
   - **Estimated time**: Thời gian ước tính (phút)
   - **Category**: Phân loại (Work, Study, Personal...)
   - **Priority**: Mức ưu tiên (Critical > High > Medium > Low)
3. Nhấn **"Save Task"**

### 2. Đánh dấu hoàn thành

- Click vào **ô vuông ☐** bên trái tên task → task sẽ được đánh dấu ✅
- Xem lại task đã hoàn thành trong mục **"Completed"** ở sidebar

### 3. Sửa / Xóa task

- **Sửa**: Hover chuột lên task → click biểu tượng **✏️**
- **Xóa**: Hover chuột lên task → click biểu tượng **🗑️** → xác nhận

### 4. Lọc và sắp xếp

**Sidebar (bên trái):**
- 📋 **All Tasks** — Tất cả task
- ☀️ **Today** — Task hết hạn hôm nay
- 📅 **Upcoming** — Task trong 7 ngày tới
- 🔥 **Overdue** — Task đã quá hạn
- ✅ **Completed** — Task đã hoàn thành

**Thanh sắp xếp (trên cùng):**
- 📅 **Deadline** — Sắp theo hạn chót (gần nhất trước)
- ⚡ **Priority** — Sắp theo mức ưu tiên (Critical trước)
- ⏱ **Duration** — Sắp theo thời gian (ngắn trước)

### 5. AI Schedule (Sắp xếp tự động) 🤖

Đây là tính năng **quan trọng nhất** — AI sẽ phân tích tất cả tasks và tạo lịch trình tối ưu cho bạn.

1. Thêm vài tasks (ít nhất 2-3 tasks)
2. Nhấn nút **"🤖 AI Schedule"** (góc phải trên)
3. Đợi AI phân tích (5-15 giây)
4. Một bảng timeline hiện ra, cho biết:
   - Nên làm task nào trước
   - Thời gian bắt đầu và kết thúc
   - Lý do vì sao task được xếp ở vị trí đó
5. Tasks sẽ được gắn nhãn thứ tự (🤖 #1, #2, #3...)

### 6. AI Chat (Hỏi đáp AI) 💬

1. Panel chat ở **bên phải** màn hình
2. Click nhanh vào các chip:
   - 🎯 **"What's next?"** — Hỏi nên làm gì tiếp theo
   - 📊 **"Workload analysis"** — Phân tích khối lượng công việc
   - 😰 **"Feeling stuck"** — Khi cảm thấy bế tắc
   - 💪 **"Motivate me"** — Cần động lực
3. Hoặc gõ câu hỏi bất kỳ vào ô chat
4. AI sẽ trả lời dựa trên danh sách task hiện tại của bạn

### 7. Đổi giao diện Sáng / Tối

- Nhấn biểu tượng **🌙** (mặt trăng) trên thanh header để đổi sang Light mode
- Nhấn **☀️** (mặt trời) để đổi lại Dark mode

### 8. 🎓 Tích hợp Moodle (Import deadline từ trường)

Tính năng này giúp tự động lấy bài tập và deadline từ **Moodle** (hệ thống LMS của trường học) và tạo thành task trong app.

#### Bước 1: Lấy Moodle Token

1. Đăng nhập vào **trang Moodle của trường** (ví dụ: `https://moodle.truonghoc.edu.vn`)
2. Vào **Profile** (ảnh đại diện góc trên phải) → **Preferences** (Cài đặt)
3. Tìm mục **"Security Keys"** hoặc **"Web Services"**
4. Copy token (chuỗi ký tự dài)

> 💡 Nếu không thấy mục này, nhờ **admin/thầy cô** bật Web Services và tạo token cho bạn tại: Site Admin → Plugins → Web Services → Manage Tokens

#### Bước 2: Cấu hình trong app

1. Mở app → nhấn **⚙️ Settings** (góc trên phải)
2. Cuộn xuống phần **"🎓 Moodle Integration"**
3. Điền:
   - **Moodle URL**: Địa chỉ trang Moodle (ví dụ: `https://moodle.truonghoc.edu.vn`)
   - **Moodle Token**: Paste token vừa copy
4. Nhấn **"🔍 Test kết nối"** để kiểm tra
5. Nếu thành công, sẽ hiển tên trường và tên bạn
6. (Tuỳ chọn) Bật **"Tự động sync khi mở app"**
7. Nhấn **Save Settings**

#### Bước 3: Sync deadline

1. Nhìn sidebar bên trái → xuất hiện mục **"🎓 Moodle"**
2. Nhấn **"🔄 Sync Moodle"**
3. App sẽ tự động:
   - Lấy tất cả bài tập/deadline từ các môn học trên Moodle
   - Tạo task với deadline, tên môn học, và mức ưu tiên tự động
   - Bỏ qua các task đã tồn tại (không bị trùng)
4. Tasks từ Moodle được gắn nhãn **"🎓 Moodle"**

> 💡 **Mức ưu tiên tự động**: Deadline < 24h → Critical | < 3 ngày → High | < 7 ngày → Medium | > 7 ngày → Low

---

## ⌨️ Phím tắt

| Phím tắt | Chức năng |
|----------|----------|
| `Ctrl + N` | Thêm task mới |
| `Ctrl + Shift + A` | Chạy AI Schedule |
| `Esc` | Đóng cửa sổ popup |

---

## ❓ Câu hỏi thường gặp (FAQ)

### "Dữ liệu lưu ở đâu?"

Dữ liệu được lưu tại:
```
C:\Users\[Tên user]\AppData\Roaming\taskflow-ai\taskflow-db\data.json
```
File này sẽ **không bị mất** khi bạn đóng app, khởi động lại máy, hoặc cập nhật app.

### "Có cần kết nối mạng không?"

- **Thêm/sửa/xóa task**: ❌ Không cần mạng
- **AI Schedule & Chat**: ✅ Cần mạng (để gọi API)

### "API Key có an toàn không?"

API Key được lưu **trên máy bạn** (trong file data.json), không gửi đi đâu ngoài server AI mà bạn đã chọn.

### "App có chạy trên Mac/Linux không?"

Hiện tại app được thiết kế cho **Windows**. Tuy nhiên, code có thể chạy trên Mac/Linux nếu cài Node.js và chạy `npm start`.

### "Làm sao backup dữ liệu?"

Copy file `data.json` (đường dẫn ở trên) ra nơi an toàn. Để restore, paste file đó lại vào thư mục cũ.

---

## 🔧 Xử lý lỗi

### Lỗi "API error 429: Rate limit exceeded"

**Nguyên nhân**: Đã hết lượt gọi AI miễn phí trong ngày/phút.

**Cách khắc phục**:
1. **Đợi 1-2 phút** rồi thử lại (nếu là lỗi per-minute)
2. **Đợi đến ngày mai** (nếu là lỗi daily quota)
3. **Đổi sang Groq** (xem hướng dẫn ở mục [Lấy API Key](#tùy-chọn-2-groq-miễn-phí-nhanh-hơn-ổn-định-hơn))
4. **Tạo API key Gemini mới** (xem hướng dẫn ở mục [Tự tạo key Gemini](#tùy-chọn-3-tự-tạo-key-gemini-mới))

### Lỗi "API error 401: Invalid API key"

**Nguyên nhân**: API key sai hoặc đã hết hạn.

**Cách khắc phục**: Mở Settings ⚙️ → kiểm tra lại API Key → tạo key mới nếu cần.

### App không mở được

1. Đảm bảo đã chạy `setup.bat` để cài đặt
2. Thử chạy lại `setup.bat`
3. Nếu vẫn lỗi, mở Command Prompt → chạy: `cd đường-dẫn\schedule-app` → `npm start`

### Mất dữ liệu

Kiểm tra file backup tại:
```
C:\Users\[Tên user]\AppData\Roaming\taskflow-ai\taskflow-db\data.backup.json
```
Đổi tên file này thành `data.json` để khôi phục.

---

## 📁 Cấu trúc thư mục

```
schedule-app/
├── 📄 setup.bat          ← Chạy file này để cài đặt
├── 📄 start-app.bat      ← Chạy file này để mở app
├── 📄 README.md           ← File bạn đang đọc
├── 📄 package.json        ← Cấu hình project
├── 📄 main.js             ← Code chính (Electron)
├── 📄 preload.js          ← Cầu nối giao tiếp
├── 📄 index.html          ← Giao diện chính
├── 📁 css/                ← File giao diện
│   ├── variables.css
│   ├── layout.css
│   ├── components.css
│   ├── chat.css
│   └── animations.css
├── 📁 js/                 ← Code logic
│   ├── app.js
│   ├── store.js
│   ├── taskManager.js
│   ├── aiService.js
│   ├── uiRenderer.js
│   ├── chatPanel.js
│   ├── scheduler.js
│   ├── moodleService.js   ← Tích hợp Moodle
│   └── utils.js
└── 📁 assets/             ← Icon và hình ảnh
```

---

<p align="center">
  Made with ❤️ by TaskFlow AI Team
</p>
