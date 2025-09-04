// test-client.js
const { io } = require("socket.io-client");

// --- CẤU HÌNH ---
const SERVER_URL = "http://localhost:5000";
// Lấy streamKey từ response của API /api/v1/streams/start
const STREAM_KEY = "89afe212e1925e762a3d65dd02438bc0"; // <--- THAY BẰNG STREAM KEY BẠN NHẬN ĐƯỢC
const USER_ID = "creator-test-01";
const USERNAME = "Creator_Test";
// --- KẾT THÚC CẤU HÌNH ---

console.log(`Đang kết nối tới server tại ${SERVER_URL}...`);

const socket = io(SERVER_URL, {
  // Nếu server có cấu hình `path` khác mặc định, thêm vào đây
  // path: "/my-custom-path/socket.io"
});

socket.on("connect", () => {
  console.log("✅ Kết nối tới server Socket.IO thành công!");
  console.log(`   Socket ID: ${socket.id}`);

  const joinData = {
    roomId: STREAM_KEY,
    userId: USER_ID,
    username: USERNAME,
    userType: 'creator' // hoặc 'viewer'
  };

  console.log("\n🚀 Gửi sự kiện 'join_room_stream' với dữ liệu:", joinData);
  socket.emit("join_room_stream", joinData);
});

// Lắng nghe các phản hồi từ server
socket.on("room_joined", (data) => {
  console.log("\n🎉 THÀNH CÔNG: Server đã xác nhận 'room_joined':", data);
  console.log("Bây giờ bạn có thể bắt đầu gửi dữ liệu stream.");
  socket.disconnect(); // Ngắt kết nối sau khi test thành công
});

socket.on("viewer_count_updated", (data) => {
    console.log(`[INFO] Số người xem đã cập nhật: ${data.count}`);
});

socket.on("error", (error) => {
  console.error("\n❌ LỖI: Server đã gửi về một lỗi:", error);
  socket.disconnect();
});

socket.on("connect_error", (err) => {
  console.error(`\n❌ Kết nối thất bại: ${err.message}`);
  console.error("   Hãy chắc chắn rằng server backend đang chạy và có thể truy cập tại URL đã chỉ định.");
});

socket.on("disconnect", (reason) => {
  console.log(`\n🔌 Đã ngắt kết nối khỏi server. Lý do: ${reason}`);
});
