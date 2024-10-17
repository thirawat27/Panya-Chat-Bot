const { onRequest } = require("firebase-functions/v2/https");
const line = require("./utils/line");
const gemini = require("./utils/gemini");
const NodeCache = require("node-cache");
const sharp = require("sharp");

const cache = new NodeCache();
const CACHE_IMAGE = "image_";
const CACHE_CHAT = "chat_";

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

        // ตรวจสอบข้อความและภาพจาก cache
        const previousChat = cache.get(CACHE_CHAT + userId);
        const cachedResponse = cache.get(CACHE_CHAT + userId + prompt);

        // ถ้ามีข้อมูลเก่าใน cache ใช้ข้อมูลนั้นแทนการเรียก API
        if (cachedResponse) {
          console.log(`Using cached response for: ${prompt}`);
          await line.reply(event.replyToken, [{ type: "text", text: cachedResponse }]);
          continue;
        }

        // ตรวจสอบประเภทข้อความ
        if (messageType === "text") {
          if (prompt.startsWith("http://") || prompt.startsWith("https://")) {
            // ลบแคชเก่าหากผู้ใช้ส่งลิงก์มาใหม่
            cache.del(CACHE_IMAGE + userId);
            cache.del(CACHE_CHAT + userId);

            const generatedText = await gemini.urlToText(prompt);
            console.log(`Tokens used for urlToText: ${prompt.length}`);
            cache.set(CACHE_CHAT + userId + prompt, generatedText, 30);
            await line.reply(event.replyToken, [{ type: "text", text: generatedText }]);
            continue;
          }

          // ถ้ามีข้อมูลแชทเก่าในแคช ใช้แคชเพื่อสร้างข้อความใหม่
          if (previousChat) {
            const combinedPrompt = `${previousChat} ${prompt}`.trim();
            const text = await gemini.textOnly(combinedPrompt);
            cache.set(CACHE_CHAT + userId, combinedPrompt, 30);
            console.log(`Tokens used for textOnly: ${combinedPrompt.length}`);
            await line.reply(event.replyToken, [{ type: "text", text }]);
            continue;
          }

          // ตรวจสอบ cache ของภาพ และสร้างข้อความจากภาพถ้ามี
          const cacheImage = cache.get(CACHE_IMAGE + userId);
          let text = cacheImage
            ? await gemini.multimodal(cacheImage)
            : await gemini.textOnly(prompt);
          
          cache.set(CACHE_CHAT + userId + prompt, text, 30);
          console.log(`Tokens used: ${prompt.length}`);
          await line.reply(event.replyToken, [{ type: "text", text }]);
        }

        if (messageType === "image") {
          const ImageBinary = await line.getImageBinary(event.message.id);
          const ImageBase64 = await sharp(ImageBinary)
            .toFormat("jpeg", { quality: 75 })
            .toBuffer()
            .then((data) => data.toString("base64"));

          cache.set(CACHE_IMAGE + userId, ImageBase64, 30);
          console.log("ImageBase64:", ImageBase64); 
          const generatedText = await gemini.multimodal(ImageBase64);
          cache.set(CACHE_CHAT + userId, generatedText, 30);
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