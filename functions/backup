const { onRequest } = require("firebase-functions/v2/https"); // นำเข้า onRequest จาก Firebase Functions
const line = require("./utils/line"); // นำเข้าฟังก์ชันสำหรับจัดการกับ LINE API
const gemini = require("./utils/gemini"); // นำเข้าฟังก์ชันสำหรับจัดการกับ Gemini API

const NodeCache = require("node-cache"); // นำเข้า NodeCache สำหรับจัดการ cache
const cache = new NodeCache(); // สร้างอินสแตนซ์ของ NodeCache
const CACHE_IMAGE = "image_"; // ค่าคงที่สำหรับการจัดเก็บ cache ของภาพ


// ฟังก์ชัน webhook ที่ถูกเรียกใช้เมื่อมีการส่ง request มายัง endpoint นี้
exports.webhook = onRequest(async (req, res) => {
  const events = req.body.events; // ดึงข้อมูล events จาก body ของ request
  for (const event of events) {
    // วน loop เพื่อจัดการกับแต่ละ event
    const userId = event.source.userId; // ดึง userId จาก source ของ event
    console.log("User ID : ", userId);
    switch (event.type) {
      case "message": // ถ้า event เป็นประเภท message
        if (event.message.type === "text") {
          // ถ้าข้อความเป็นประเภท text
          const prompt = event.message.text; // ดึงข้อความที่ส่งมา
          console.log("Prompt :", prompt);

          if (prompt.startsWith("http://") || prompt.startsWith("https://")) {
            // ถ้าข้อความเป็น URL
            const generatedText = await gemini.urlToText(prompt); // เรียกฟังก์ชัน urlToText
            await line.reply(event.replyToken, [{ type: "text", text: generatedText }]); // ตอบกลับข้อความที่สร้างขึ้นจาก URL
            break;
          }

          /* 3. Generate text from text-and-image input (multimodal) */
          const cacheImage = cache.get(CACHE_IMAGE + userId);
          if (cacheImage) {
            const text2 = await gemini.multimodal(cacheImage); // ไม่ต้องรับ prompt จากผู้ใช้โดยตรง
            await line.reply(event.replyToken, [{ type: "text", text: text2 }]);
            break;
          }

          /* 1. Generate text from text-only input */
          const text = await gemini.textOnly(prompt);
          await line.reply(event.replyToken, [{ type: "text", text: text }]);
          break;
        }

        if (event.message.type === "image") {
          // ถ้าข้อความเป็นประเภท image
          const ImageBinary = await line.getImageBinary(event.message.id);
          console.log("Img : ", ImageBinary);
          const ImageBase64 = Buffer.from(ImageBinary, "binary").toString(
            "base64"
          );

          // ตั้งค่า cache สำหรับภาพ
          cache.set(CACHE_IMAGE + userId, ImageBase64, 30);

          // ใช้ฟังก์ชัน multimodal ในการสร้างข้อความจากรูปภาพ
          const generatedText = await gemini.multimodal(ImageBase64); // เรียก multimodal โดยไม่ต้องรับ prompt จากผู้ใช้
          await line.reply(event.replyToken, [
            {
              type: "text",
              text: generatedText, // ตอบกลับข้อความที่สร้างขึ้นจากรูปภาพ
            },
          ]);
          break;
        }
        break;
    }
  }
  res.end(); // ส่งสัญญาณว่าการประมวลผลเสร็จสิ้น
});