// ==========================================
// 🚀 EXPRESS SERVER
// File: /server.js
// Local dev server with generate proxy + logging
// ==========================================

require("dotenv").config();

const express = require("express");
const path = require("path");
const { readHistory, appendEntry, ensureStorageExists } = require("./utils/logger");

const app = express();
const PORT = process.env.PORT || 3000;

// ==========================================
// 🔧 MIDDLEWARE
// ==========================================
app.use(express.json());
app.use(express.static(path.join(__dirname), {
    extensions: ["html"]
}));

// ==========================================
// 🧠 POST /api/generate — Proxy to OpenRouter
// ==========================================
app.post("/api/generate", async (req, res) => {

    try {

        const prompt = req.body?.prompt?.trim();

        if (!prompt) {
            return res.status(400).json({
                success: false,
                error: "Prompt is required"
            });
        }

        // ── ENV VARIABLE ──
        const API_KEY = process.env.API_KEY;

        if (!API_KEY) {
            return res.status(500).json({
                success: false,
                error: "API_KEY is missing. Add it to your .env file."
            });
        }

        // ── SYSTEM PROMPT ──
        const systemPrompt = `
You are an expert JSON data generator.

Rules:
- Return ONLY valid JSON
- No markdown
- No explanations
- No comments
- Output must be parseable JSON
`;

        // ── REQUEST TIMEOUT ──
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 25000);

        // ── OPENROUTER REQUEST ──
        const response = await fetch(
            "https://openrouter.ai/api/v1/chat/completions",
            {
                method: "POST",
                signal: controller.signal,
                headers: {
                    Authorization: `Bearer ${API_KEY}`,
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://json-data-pro.vercel.app",
                    "X-Title": "Json Data Pro"
                },
                body: JSON.stringify({
                    model: "openai/gpt-3.5-turbo",
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: prompt }
                    ],
                    temperature: 0,
                    max_tokens: 1000
                })
            }
        );

        clearTimeout(timeout);

        if (!response.ok) {
            const errorText = await response.text();
            console.error("OpenRouter Error:", errorText);
            return res.status(response.status).json({
                success: false,
                error: "AI request failed"
            });
        }

        const data = await response.json();

        let aiText = data?.choices?.[0]?.message?.content?.trim();

        if (!aiText) {
            return res.status(500).json({
                success: false,
                error: "Empty AI response"
            });
        }

        // ── CLEAN MARKDOWN ──
        aiText = aiText
            .replace(/```json/gi, "")
            .replace(/```/g, "")
            .trim();

        // ── SAFE JSON PARSE ──
        let parsedJSON;
        try {
            parsedJSON = JSON.parse(aiText);
        } catch {
            console.error("Invalid JSON:", aiText);
            return res.status(500).json({
                success: false,
                error: "AI returned invalid JSON",
                raw: aiText
            });
        }

        return res.status(200).json(parsedJSON);

    } catch (error) {

        console.error("SERVER ERROR:", error);

        if (error.name === "AbortError") {
            return res.status(408).json({
                success: false,
                error: "Request timeout"
            });
        }

        return res.status(500).json({
            success: false,
            error: "Internal Server Error"
        });
    }
});

// ==========================================
// 📝 POST /api/log — Background Agent Endpoint
// ==========================================
app.post("/api/log", async (req, res) => {

    try {

        const { userPrompt, generatedOutput } = req.body;

        if (!userPrompt || !generatedOutput) {
            return res.status(400).json({
                success: false,
                error: "Both userPrompt and generatedOutput are required"
            });
        }

        const entry = await appendEntry(userPrompt, generatedOutput);

        return res.status(201).json({
            success: true,
            entry
        });

    } catch (error) {

        console.error("Log Error:", error);

        return res.status(500).json({
            success: false,
            error: "Failed to save log entry"
        });
    }
});

// ==========================================
// 📖 GET /api/history — Retrieve All Logs
// ==========================================
app.get("/api/history", async (req, res) => {

    try {
        const history = await readHistory();
        return res.status(200).json(history);
    } catch (error) {
        console.error("History Read Error:", error);
        return res.status(500).json({
            success: false,
            error: "Failed to read history"
        });
    }
});

// ==========================================
// 🟢 START SERVER
// ==========================================
async function start() {
    await ensureStorageExists();

    app.listen(PORT, () => {
        console.log("");
        console.log("  ┌──────────────────────────────────────────┐");
        console.log("  │                                          │");
        console.log(`  │   🚀 Json Data Pro — Server Running      │`);
        console.log(`  │   📡 http://localhost:${PORT}               │`);
        console.log("  │   📝 Background Agent: ACTIVE            │");
        console.log("  │   📂 Logs: data/history.json             │");
        console.log("  │                                          │");
        console.log("  └──────────────────────────────────────────┘");
        console.log("");
    });
}

start();
