// ============================================================================
// DebtVault — AI Vault Coach Backend (2025, Smart Adaptive Personality System)
// Versioned API: /v1/coach/*
// ============================================================================

import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

// ============================================================================
// Init
// ============================================================================

const app = express();
const PORT = process.env.PORT || 8080;

// Body parser
app.use(bodyParser.json());

// ============================================================================
// Supabase (service role required)
// ============================================================================
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ============================================================================
// CORS — allow localhost + production domains
// ============================================================================
const allowedOrigins = [
  "http://localhost:5173",
  "https://debtvault.co",
  "https://www.debtvault.co",
];

const corsOptions = {
  origin: (origin, callback) => {
    // Allow server tools like curl/Postman (no origin)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);

    console.warn("❌ [CORS BLOCKED]:", origin);
    return callback(new Error("Not allowed by CORS"));
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));

// ============================================================================
// OpenAI Setup
// ============================================================================

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ============================================================================
// Helper — Get Vault Context
// ============================================================================
async function getVaultContext(user_id) {
  if (!user_id) return "User not logged in.";

  const { data: vaults } = await supabase
    .from("vaults")
    .select("vault_type, current_balance, target_amount, streak")
    .eq("user_id", user_id)
    .eq("archived", false);

  if (!vaults || vaults.length === 0) {
    return "User currently has no vaults.";
  }

  return vaults
    .map((v) => {
      const pct = Math.round((v.current_balance / v.target_amount) * 100);
      return `${v.vault_type}: ${pct}% saved, streak ${v.streak} days`;
    })
    .join("\n");
}

// ============================================================================
// Adaptive Personality Detection
// ============================================================================
function detectAdaptiveMode(question, requestedMode) {
  const lower = question.toLowerCase();

  if (
    lower.includes("stressed") ||
    lower.includes("overwhelmed") ||
    lower.includes("anxious")
  ) return "Soothing & Calm";

  if (
    lower.includes("hype") ||
    lower.includes("motivation") ||
    lower.includes("boost")
  ) return "Energetic & Motivating";

  if (
    lower.includes("discipline") ||
    lower.includes("hold me accountable")
  ) return "Professional & Direct";

  if (
    lower.includes("strategy") ||
    lower.includes("optimize") ||
    lower.includes("plan")
  ) return "Expert Financial Advisor";

  return requestedMode || "Warm & Friendly";
}

// ============================================================================
// Build System Prompt
// ============================================================================
function buildSystemPrompt(finalMode, vaultContext) {
  const personalities = {
    "Warm & Friendly": `You are warm, supportive, and conversational.`,
    "Energetic & Motivating": `You are high-energy and motivating.`,
    "Professional & Direct": `You are structured and direct.`,
    "Soothing & Calm": `You are gentle, grounding, and calming.`,
    "Expert Financial Advisor": `You are analytical, strategic, and expert-level.`,
  };

  return `
You are the AI Vault Coach for the DebtVault app.

User Vault Status:
${vaultContext}

Tone Mode: ${finalMode}

Personality Rules:
${personalities[finalMode]}

Rules:
• Always give ONE actionable step.
• Always be encouraging.
• Keep responses short unless detail is required.
`;
}

// ============================================================================
// MAIN ENDPOINT — Smart AI Coach
// ============================================================================
app.post("/v1/coach/ask", async (req, res) => {
  try {
    const {
      question,
      user_id,
      coachMode: requestedMode = "Warm & Friendly",
    } = req.body;

    if (!question)
      return res.status(400).json({ error: "Missing question." });

    const vaultContext = await getVaultContext(user_id);

    const finalMode = detectAdaptiveMode(question, requestedMode);

    const systemPrompt = buildSystemPrompt(finalMode, vaultContext);

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.65,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: question },
      ],
    });

    const reply =
      completion.choices[0]?.message?.content ||
      "I'm not sure — try rephrasing your question.";

    res.json({ reply, finalMode });

  } catch (err) {
    console.error("❌ /v1/coach/ask Error:", err);
    res.status(500).json({ error: "AI failed to respond." });
  }
});

// ============================================================================
// Nudge Generator Endpoint
// ============================================================================
app.post("/v1/coach/nudge", async (req, res) => {
  try {
    const { streak, vault_type, progress } = req.body;

    const emojiMap = {
      "Credit Card": "💳",
      Emergency: "🚨",
      Bills: "📄",
      Car: "🚗",
      Custom: "🧩",
      General: "🏦",
    };

    const emoji = emojiMap[vault_type] || "🏦";

    let nudge = `Your ${emoji} ${vault_type} vault is growing. Add a little today 🌱`;

    if (progress < 15)
      nudge = `Kickstart your ${emoji} ${vault_type} vault — even $1 builds momentum.`;
    else if (streak >= 5)
      nudge = `🔥 You're on a ${streak}-day streak in your ${emoji} ${vault_type} vault!`;
    else if (progress >= 90)
      nudge = `🎉 You're ${100 - progress}% from completing your ${emoji} ${vault_type} vault!`;
    else if (vault_type === "Credit Card" && progress >= 50)
      nudge = `🏁 You're halfway to defeating your ${emoji} Credit Card vault!`;

    res.json({ nudge });

  } catch (err) {
    console.error("❌ nudge error:", err);
    res.status(500).json({ error: "Nudge failed." });
  }
});

// ============================================================================
// Start Server
// ============================================================================
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 AI Vault Coach running on port ${PORT}`);
});
