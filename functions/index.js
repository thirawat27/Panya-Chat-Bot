const { onRequest } = require("firebase-functions/v2/https"); // นำเข้า onRequest จาก Firebase Functions
const line = require("./utils/line"); // นำเข้าฟังก์ชันสำหรับจัดการกับ LINE API
const gemini = require("./utils/gemini"); // นำเข้าฟังก์ชันสำหรับจัดการกับ Gemini API
const NodeCache = require("node-cache"); // นำเข้า NodeCache สำหรับจัดการ cache
const sharp = require("sharp"); // นำเข้า sharp สำหรับจัดการกับภาพ

const cache = new NodeCache(); // สร้างอินสแตนซ์ของ NodeCache
const CACHE_IMAGE = "image_"; // ค่าคงที่สำหรับการจัดเก็บ cache ของภาพ
const CACHE_CHAT = "chat_"; // ค่าคงที่สำหรับการจัดเก็บ cache ของการสนทนา

// ฟังก์ชัน webhook ที่ถูกเรียกใช้เมื่อมีการส่ง request มายัง endpoint นี้
exports.webhook = onRequest(async (req, res) => {
  const events = req.body.events; // ดึงข้อมูล events จาก body ของ request
  for (const event of events) { // วน loop เพื่อจัดการกับแต่ละ event
    const userId = event.source.userId; // ดึง userId จาก source ของ event
    console.log("User ID : ", userId);
    
    if (event.type === "message") { // ตรวจสอบว่า event เป็นประเภท message หรือไม่
      try {
        if (event.message.type === "text") { // ถ้าข้อความเป็นประเภท text
          const prompt = event.message.text.trim(); // ดึงข้อความที่ส่งมาและลดช่องว่าง
          console.log("Prompt :", prompt);

          // ตรวจสอบ chat ก่อนหน้านี้ใน cache
          const previousChat = cache.get(CACHE_CHAT + userId); 
          const cachedResponse = cache.get(CACHE_CHAT + userId + prompt); // เช็คแคชก่อนเรียกใช้ API

          if (previousChat) { // ถ้ามีข้อความก่อนหน้านี้
            const combinedPrompt = `${previousChat} ${prompt}`.trim(); // รวมข้อความก่อนหน้าและข้อความปัจจุบัน
            const text = await gemini.textOnly(combinedPrompt); // สร้างข้อความใหม่จากข้อความรวม
            console.log(`Tokens used for textOnly: ${combinedPrompt.length}`); 
            await line.reply(event.replyToken, [{ type: "text", text }]); // ตอบกลับผู้ใช้
            cache.set(CACHE_CHAT + userId, combinedPrompt, 30); // อัปเดต cache ของการสนทนา
            continue; // ข้ามไปยัง event ถัดไป
          }

          if (cachedResponse) { // ถ้ามีข้อมูลในแคช
            console.log(`Using cached response for: ${prompt}`);
            await line.reply(event.replyToken, [{ type: "text", text: cachedResponse }]); // ใช้ข้อมูลจากแคช
            continue; // ข้ามไปยัง event ถัดไป
          }

          // ตรวจสอบว่าข้อความเป็น URL หรือไม่
          if (prompt.startsWith("http://") || prompt.startsWith("https://")) {
            cache.del(CACHE_IMAGE + userId); // ลบแคชภาพเก่า
            cache.del(CACHE_CHAT + userId); // ลบแคชการสนทนาเก่า

            const generatedText = await gemini.urlToText(prompt); // เรียกฟังก์ชัน urlToText
            console.log(`Tokens used for urlToText: ${prompt.length}`); 
            await line.reply(event.replyToken, [{ type: "text", text: generatedText }]); // ตอบกลับข้อความที่สร้างขึ้นจาก URL
            cache.set(CACHE_CHAT + userId + prompt, generatedText, 30); // เก็บข้อความที่สร้างขึ้นจาก URL โดยมีระยะเวลา 30 วินาที
            continue; // ข้ามไปยัง event ถัดไป
          }

          // ตรวจสอบภาพใน cache
          const cacheImage = cache.get(CACHE_IMAGE + userId);
          let text; // ตัวแปรสำหรับเก็บข้อความที่จะตอบกลับ

          if (cacheImage) { // ถ้ามีแคชภาพ
            text = await gemini.multimodal(cacheImage); // ใช้ฟังก์ชัน multimodal ในการสร้างข้อความจากรูปภาพ
            console.log(`Tokens used for multimodal: ${cacheImage.length}`); 
            cache.set(CACHE_CHAT + userId, text, 30); // เก็บข้อความที่สร้างขึ้นใน cache
          } else { // ถ้าไม่มีแคชภาพ
            text = await gemini.textOnly(prompt); // เรียกฟังก์ชัน textOnly
            console.log(`Tokens used for textOnly: ${prompt.length}`); 
            cache.set(CACHE_CHAT + userId + prompt, text, 30); // เก็บข้อความที่สร้างขึ้นใน cache
          }

          await line.reply(event.replyToken, [{ type: "text", text }]); // ตอบกลับข้อความที่สร้างขึ้น
          continue; // ข้ามไปยัง event ถัดไป
        }

        if (event.message.type === "image") { // ถ้าข้อความเป็นประเภท image
          const ImageBinary = await line.getImageBinary(event.message.id); // ดึงข้อมูลภาพ
          const ImageBase64 = await sharp(ImageBinary)
            .toFormat('jpeg', { quality: 80 }) // บีบอัดภาพเป็น JPEG คุณภาพ 80%
            .toBuffer() // เปลี่ยนผลลัพธ์เป็น buffer
            .then(data => data.toString('base64')); // แปลงเป็น base64 หลังบีบอัด

          cache.set(CACHE_IMAGE + userId, ImageBase64, 30); // เก็บภาพใน cache

          const generatedText = await gemini.multimodal(ImageBase64); // เรียก multimodal โดยไม่ต้องรับ prompt จากผู้ใช้
          console.log(`Tokens used for multimodal image: ${ImageBase64.length}`); 
          await line.reply(event.replyToken, [{ type: "text", text: generatedText }]); // ตอบกลับข้อความที่สร้างขึ้นจากรูปภาพ
          cache.set(CACHE_CHAT + userId, generatedText, 30); // เก็บข้อความที่สร้างขึ้นจากรูปภาพ
        }
      } catch (error) {
        console.error("Error processing event: ", error); // แสดงข้อผิดพลาดใน console
        await line.reply(event.replyToken, [{ type: "text", text: "เกิดข้อผิดพลาดลองใหม่อีกครั้งในภายหลัง" }]); // ตอบกลับผู้ใช้เมื่อเกิดข้อผิดพลาด
      }
    }
  }
  res.end(); // ส่งสัญญาณว่าการประมวลผลเสร็จสิ้น
});