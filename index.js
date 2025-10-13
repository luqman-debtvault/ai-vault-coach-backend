import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import OpenAI from "openai";

const app = express();
const PORT = process.env.PORT || 8080;

// 🔐 Middleware
app.use(cors({
  origin: "https://www.debtvault.co",
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"],
}));
app.use(bodyParser.json());

// 🧠 Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ✅ Root route
app.get("/", (req, res) => {
  res.send("Vault Coach API is running.");
});

// 🧠 Mini memory for short-term context
let conversationHistory = [];

app.post("/ask", async (req, res) => {
  const userMessage = req.body.question || req.body.message;
  const mode = req.body.mode || "Normal";

  if (!userMessage) {
    return res.status(400).json({ error: "Missing message input." });
  }

  // 🧠 Update system prompt based on mode
  let systemPrompt = `
You are the AI Vault Coach — a supportive, practical financial guide who helps users build good saving habits, pay off debt, and stay motivated.

Your tone is encouraging, empathetic, and goal-oriented — like a mix of a financial therapist and accountability partner.

Speak in clear, human, friendly language (not robotic or overly formal). Avoid jargon. Use short sentences. Always explain "why" when giving advice.

When a user asks something vague or emotional (e.g. "I’m stuck" or "I feel lost"), respond with reassurance first, then offer a small step forward.

Always assume they are using the DebtVault app, where users can:
- Create vaults (like for rent, credit cards, emergency)
- Save daily micro-amounts toward those vaults
- Track progress and streaks
- Celebrate wins

Be brief but helpful. If you're unsure how to respond, suggest asking the Vault Coach again in a more specific way.
`.trim();

  if (mode === "Strict") {
    systemPrompt = `
You are a strict financial advisor who gives tough love. Be direct, firm, and focused on results. No fluff. Make the user take action. If they’re wasting money, call it out. Don’t be mean — just brutally honest. Always tie advice to their goals in the DebtVault app.
`.trim();
  } else if (mode === "Friendly") {
    systemPrompt = `
You are a warm, supportive financial coach who sounds like a kind friend. Be very encouraging, uplifting, and use relatable examples. Never judge. Always start with reassurance. End with a small suggestion or gentle push. Assume the user is using DebtVault to save daily for things like rent, credit cards, or emergencies.
`.trim();
  }

  // Save user message
  conversationHistory.push({ role: "user", content: userMessage });
  if (conversationHistory.length > 3) {
    conversationHistory = conversationHistory.slice(-3);
  }

  const messages = [
    { role: "system", content: systemPrompt },
    ...conversationHistory
  ];

  try {
  const completion = await openai.chat.completions.create({
    model: "gpt-4o", // or "gpt-3.5-turbo"
    messages,
    temperature: 0.7
  });

  const reply = completion.choices[0]?.message?.content?.trim() || "No reply generated.";

  // Save reply
  conversationHistory.push({ role: "assistant", content: reply });
  if (conversationHistory.length > 6) {
    conversationHistory = conversationHistory.slice(-6);
  }

  res.json({ reply });
} catch (err) {
  console.error("❌ OpenAI error:", err);
  res.status(500).json({ error: "OpenAI failed to respond." });
}
});

// 🚀 Launch server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ AI Vault Coach running on port ${PORT}`);
});


