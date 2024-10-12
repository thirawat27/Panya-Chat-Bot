const axios = require('axios'); // นำเข้า axios
const { GoogleGenerativeAI } = require("@google/generative-ai"); // นำเข้าไลบรารี GoogleGenerativeAI
const puppeteer = require('puppeteer'); // นำเข้า Puppeteer
const genAI = new GoogleGenerativeAI(process.env.API_KEY); // สร้างอินสแตนซ์ของ GoogleGenerativeAI โดยใช้ API Key จาก Environment Variables

class Gemini {
  // ฟังก์ชันสำหรับการสร้างข้อความเพียงอย่างเดียว
  async textOnly(prompt) {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // กำหนดโมเดลเป็น gemini-1.5-flash
    const result = await model.generateContent(prompt); // สร้างเนื้อหาจาก prompt ที่กำหนด
    return result.response.text(); // ส่งกลับข้อความที่สร้างขึ้น
  }

  // ฟังก์ชันสำหรับการสร้างเนื้อหาหลายรูปแบบ (ข้อความ + รูปภาพ)
  async multimodal(base64Image) {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // ใช้โมเดล gemini-1.5-flash
    const prompt = "Extract the text from the attached image and summarize the key information in Thai. Ensure the summary includes an engaging and relevant title. The summary should be concise, consisting of no more than 2 to 3 paragraphs, and should be clear."; // กำหนดค่า prompt
    const mimeType = "image/png"; // กำหนดประเภท MIME ของรูปภาพเป็น PNG

    const imageParts = [{
      inlineData: { data: base64Image, mimeType } // ข้อมูลรูปภาพในรูปแบบ base64
    }];
    
    const result = await model.generateContent([prompt, ...imageParts]); // สร้างเนื้อหาจาก prompt และรูปภาพ
    return result.response.text(); // ส่งกลับข้อความที่สร้างขึ้น
  }

  // ฟังก์ชันสำหรับการดึงข้อมูลจาก URL โดยใช้ Puppeteer
  async urlToText(url) {
    let content;
    try {
      const browser = await puppeteer.launch(); // เปิด browser
      const page = await browser.newPage(); // เปิดหน้าใหม่
      await page.goto(url, { waitUntil: 'networkidle2' }); // ไปที่ URL และรอให้โหลดเสร็จ
      content = await page.evaluate(() => document.body.innerText); // ดึงข้อความจาก body
      await browser.close(); // ปิด browser
    } catch (error) {
      console.error("Error fetching URL:", error); // แสดงข้อผิดพลาดถ้าดึงข้อมูลล้มเหลว
      throw error; // ป throw ข้อผิดพลาดออกไป
    }

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // ใช้โมเดล gemini-1.5-flash
    const prompt = `Extract and summarize essential details from the following content or URL into 2 or 3 paragraphs with a concise title reflecting the main idea. Respond in Thai.: ${content}`; // กำหนด prompt
    
    const result = await model.generateContent(prompt); // สร้างเนื้อหาจาก prompt
    return result.response.text(); // ส่งกลับข้อความที่สร้างขึ้น
  }

  // ฟังก์ชันสำหรับการสนทนา โดยมีการเก็บประวัติการสนทนา
  async chat(cacheChatHistory, prompt) {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // ใช้โมเดล gemini-1.5-flash
    const chatHistory = [
      {
        role: "user",
        parts: [{ text: "สวัสดี" }] // ประวัติการสนทนาจากผู้ใช้
      },
      {
        role: "model",
        parts: [{ text: "สวัสดีนะ เราชื่อ Panya Chat Bot เราเป็นผู้จัดงานผู้ช่วยสรุปเนื้อหาของคุณ 😁" }] // ข้อความเริ่มต้นจากโมเดล
      }
    ];
    // ถ้ามีประวัติการสนทนาที่ถูกเก็บไว้ จะเพิ่มเข้าไปใน chatHistory
    if (cacheChatHistory.length > 0) {
      chatHistory.push(...cacheChatHistory);
    }
    const chat = model.startChat({ history: chatHistory }); // เริ่มการสนทนา
    const result = await chat.sendMessage(prompt); // ส่งข้อความจากผู้ใช้ไปยังโมเดล
    return result.response.text(); // ส่งกลับข้อความที่สร้างขึ้น
  }
}

module.exports = new Gemini(); // ส่งออกอินสแตนซ์ของคลาส Gemini