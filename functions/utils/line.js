const axios = require("axios"); // นำเข้าไลบรารี axios สำหรับการทำ HTTP requests

// กำหนด header สำหรับการเรียกใช้งาน API ของ LINE
const LINE_HEADER = {
  "Content-Type": "application/json", // ระบุประเภทของข้อมูลเป็น JSON
  Authorization: `Bearer ${process.env.CHANNEL_ACCESS_TOKEN}` // ใส่ Access Token สำหรับการเข้าถึง API
};

class LINE {
  // ฟังก์ชันสำหรับดึงข้อมูลภาพในรูปแบบ Binary จาก messageId
  async getImageBinary(messageId) {
    // ทำการเรียก API เพื่อดึงข้อมูลภาพโดยใช้ messageId
    const originalImage = await axios({
      method: "get", // กำหนดวิธีการเรียก GET
      headers: LINE_HEADER, // ใส่ headers ที่กำหนดไว้
      url: `https://api-data.line.me/v2/bot/message/${messageId}/content`, // URL สำหรับเรียกข้อมูลภาพ
      responseType: "arraybuffer" // กำหนดประเภทของข้อมูลที่ตอบกลับเป็น ArrayBuffer
    });
    return originalImage.data; // ส่งกลับข้อมูลภาพที่ได้รับ
  }
  
  // ฟังก์ชันสำหรับตอบกลับข้อความไปยังผู้ใช้
  reply(token, payload) {
    // ทำการเรียก API เพื่อตอบกลับข้อความ
    return axios({
      method: "post", // กำหนดวิธีการเรียก POST
      url: "https://api.line.me/v2/bot/message/reply", // URL สำหรับการตอบกลับข้อความ
      headers: LINE_HEADER, // ใส่ headers ที่กำหนดไว้
      data: { replyToken: token, messages: payload } // กำหนดข้อมูลที่ส่งไป รวมถึง replyToken และข้อความที่จะส่ง
    });
  }

  // ฟังก์ชันสำหรับเริ่มการโหลด
  loading(userId) {
    return axios({
      method: "post", // กำหนดวิธีการเรียก POST
      url: "https://api.line.me/v2/bot/chat/loading/start", // URL สำหรับการเริ่มการโหลด
      headers: LINE_HEADER, // ใส่ headers ที่กำหนดไว้
      data: { chatId: userId } // ส่งค่า chatId ของผู้ใช้
    });
  }
}

// ส่งออกอินสแตนซ์ของคลาส LINE เพื่อให้สามารถใช้งานได้ในที่อื่น
module.exports = new LINE();
