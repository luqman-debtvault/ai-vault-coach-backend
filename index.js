import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);


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
  const { question, mode = "Normal", memory = "", systemPrompt: customPrompt, vaultType = "General" } = req.body;

  if (!question) {
    return res.status(400).json({ error: "Missing question." });
  }

  // ✅ Use frontend-passed systemPrompt if available
let systemPrompt = customPrompt || `
You are the AI Vault Coach — a supportive, practical financial guide who helps users build good saving habits, pay off debt, and stay motivated.

The user is currently asking about their "${vaultType}" vault.

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

  // 🧠 Include short-term memory as user context
  const messages = [
    { role: "system", content: systemPrompt },
    ...(memory
      ? [{ role: "system", content: `Here is recent user context:\n${memory}` }]
      : []),
    { role: "user", content: question }
  ];

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages,
      temperature: 0.7,
    });

    const reply = completion.choices[0]?.message?.content?.trim() || "No reply generated.";
    res.json({ reply });
  } catch (err) {
    console.error("❌ OpenAI error:", err);
    res.status(500).json({ error: "OpenAI failed to respond." });
  }
});

// ✅ Streaming response endpoint
app.post("/ask-stream", async (req, res) => {
  const { question, systemPrompt = "", memory = "", mode = "Normal" } = req.body;

  if (!question) {
    return res.status(400).send("Missing question.");
  }

  const messages = [
    { role: "system", content: systemPrompt },
    ...(memory
      ? [{ role: "system", content: `Here is recent user context:\n${memory}` }]
      : []),
    { role: "user", content: question }
  ];

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages,
      temperature: 0.7,
      stream: true,
    });

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Transfer-Encoding", "chunked");

    for await (const chunk of completion) {
      const content = chunk.choices?.[0]?.delta?.content || "";
      res.write(content);
    }

    res.end();
  } catch (err) {
    console.error("❌ Streaming error:", err);
    res.status(500).send("Error streaming response.");
  }
});

app.post("/get-nudge", async (req, res) => {
  const { user_id } = req.body;

  if (!user_id) {
    return res.status(400).json({ error: "Missing user_id" });
  }

  try {
    // Replace this logic later with smarter AI nudges if needed
    const dailyNudges = [
      "You’re only one small deposit away from keeping your streak alive.",
      "Small steps add up — drop $1 into your Rent vault today.",
      "Missing a day is okay, but don’t make it two.",
      "Momentum beats motivation. Just act once!",
      "Consistency > big deposits. Tap that Add button 💪",
    ];

    const random = Math.floor(Math.random() * dailyNudges.length);
    const message = dailyNudges[random];

    res.json({ message });
  } catch (err) {
    console.error("❌ Nudge generation error:", err);
    res.status(500).json({ error: "Nudge fetch failed." });
  }
});

// 🚀 Launch server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ AI Vault Coach running on port ${PORT}`);
});


