import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import OpenAI from "openai";

const app = express();
const PORT = process.env.PORT || 8080;

// 🛡️ CORS: Only allow your frontend
app.use(cors({
  origin: "https://www.debtvault.co",
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"],
}));

app.use(bodyParser.json());

// 🧠 OpenAI Client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ✅ Root Route (for Railway status)
app.get("/", (req, res) => {
  res.send("Vault Coach API is running.");
});

// 🧠 Main Coach Endpoint
app.post("/ask", async (req, res) => {
  const userMessage = req.body.question || req.body.message; // ← supports both

  if (!userMessage) {
    return res.status(400).json({ error: "Missing message input." });
  }

  try {
    const chat = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: "You are the AI Vault Coach." },
        { role: "user", content: userMessage },
      ],
    });

    const reply = chat.choices[0]?.message?.content || "No reply generated.";
    res.json({ reply });
  } catch (err) {
    console.error("❌ OpenAI error:", err);
    res.status(500).json({ error: "OpenAI failed to respond." });
  }
});

// 🚀 Start server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ AI Vault Coach running on port ${PORT}`);
});
