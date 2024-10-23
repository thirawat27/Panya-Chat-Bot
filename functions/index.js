const { onRequest } = require("firebase-functions/v2/https");
const line = require("./utils/line");
const gemini = require("./utils/gemini");
const sharp = require("sharp");

// ฟังก์ชัน webhook ที่ถูกเรียกใช้เมื่อมีการส่ง request มายัง endpoint นี้
exports.webhook = onRequest(async (req, res) => {
  const events = req.body.events;
  for (const event of events) {
    const userId = event.source.userId;
    console.log("User ID : ", userId);

    if (event.type === "message") {
      try {
        const messageType = event.message.type;
        const prompt = event.message.text?.trim() || "";
        console.log("Prompt :", prompt);

        // ตรวจสอบประเภทข้อความ
        if (messageType === "text") {
          if (prompt.startsWith("http://") || prompt.startsWith("https://")) {
            // ถ้าผู้ใช้ส่งลิงก์มา ให้เรียกใช้ API เพื่อสร้างข้อความจาก URL
            const generatedText = await gemini.urlToText(prompt);
            console.log(`Tokens used for urlToText: ${prompt.length}`);
            await line.reply(event.replyToken, [{ type: "text", text: generatedText }]);
            continue;
          }

          // สร้างข้อความจาก prompt ที่ส่งมา
          const text = await gemini.textOnly(prompt);
          console.log(`Tokens used for textOnly: ${prompt.length}`);
          await line.reply(event.replyToken, [{ type: "text", text }]);
        }

        if (messageType === "image") {
          const ImageBinary = await line.getImageBinary(event.message.id);
          const ImageBase64 = await sharp(ImageBinary)
            .toFormat("jpeg", { quality: 75 })
            .toBuffer()
            .then((data) => data.toString("base64"));

          console.log("Image :", ImageBinary); 
          const generatedText = await gemini.multimodal(ImageBase64);
          console.log(`Tokens used for multimodal image: ${ImageBase64.length}`);
          await line.reply(event.replyToken, [{ type: "text", text: generatedText }]);
        }
      } catch (error) {
        console.error("Error processing event: ", error);
        await line.reply(event.replyToken, [{ type: "text", text: "เกิดข้อผิดพลาดลองใหม่อีกครั้งในภายหลัง" }]);
      }
    }
  }
  res.end();
});