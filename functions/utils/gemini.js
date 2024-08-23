const { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory  } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI(process.env.API_KEY);

const textOnly = async (prompt) => {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  const result = await model.generateContent(prompt);
  return result.response.text();
};

const multimodal = async (fileBinary, fileType = "image/png") => {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  const prompt = "Extract text from this file:"; // ปรับ prompt ให้เป็นภาษาไทยตามความต้องการ

  // แปลงไฟล์ binary เป็น GoogleGenerativeAI.Part object
  const fileParts = [
    {
      inlineData: {
        data: Buffer.from(fileBinary, "binary").toString("base64"),
        mimeType: fileType
      }
    }
  ];

  const safetySettings = [
    {
      category: HarmCategory.HARM_CATEGORY_HARASSMENT,
      threshold: HarmBlockThreshold.BLOCK_ONLY_MEDIUM,
    },
    {
      category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
      threshold: HarmBlockThreshold.BLOCK_ONLY_MEDIUM,
    },
    {
      category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
      threshold: HarmBlockThreshold.BLOCK_ONLY_MEDIUM,
    },
    {
      category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
      threshold: HarmBlockThreshold.BLOCK_ONLY_MEDIUM,
    },
  ];

  const result = await model.generateContent([prompt, ...fileParts], safetySettings);
  const text = result.response.text();
  return text;
};

const chat = async (prompt) => {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  const chat = model.startChat({
    history: [
      {
        role: "user",
        parts: [{ text: "สวัสดีนะ" }],
      },
      {
        role: "model",
        parts: [{ text: "สวัสดีครับผมคือ Panya Bot ผมเป็นผู้ช่วยเกี่ยวกับการสรุปเนื้อหาของคุณ" }],
      },
    ]
  });

  const result = await chat.sendMessage(prompt);
  return result.response.text();
};

module.exports = { textOnly, multimodal, chat };