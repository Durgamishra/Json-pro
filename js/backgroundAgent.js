// ==========================================
// 🕵️ BACKGROUND LOGGING AGENT
// File: /js/backgroundAgent.js
// Runs silently — captures every Generate action
// ==========================================

(function () {
    "use strict";

    // ==========================================
    // ⚙️ CONFIG
    // ==========================================
    const LOG_ENDPOINT = "/api/log";
    const DEBOUNCE_MS = 300;

    // ==========================================
    // 🔒 STATE
    // ==========================================
    let lastLogTime = 0;
    let lastPromptHash = "";

    // ==========================================
    // 🔑 SIMPLE HASH (for duplicate detection)
    // ==========================================
    function quickHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash |= 0; // Convert to 32-bit integer
        }
        return String(hash);
    }

    // ==========================================
    // 📡 SEND LOG (fire-and-forget)
    // ==========================================
    async function sendLog(userPrompt, generatedOutput) {
        try {
            const response = await fetch(LOG_ENDPOINT, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userPrompt, generatedOutput })
            });

            if (!response.ok) {
                console.warn("[BackgroundAgent] Log failed:", response.status);
            }
        } catch (err) {
            // Silent failure — don't disrupt the user
            console.warn("[BackgroundAgent] Log error:", err.message);
        }
    }

    // ==========================================
    // 🎯 EVENT HANDLER
    // ==========================================
    function handleGenerated(event) {

        const { prompt, result } = event.detail || {};

        if (!prompt || !result) {
            return;
        }

        // ── Debounce: reject if fired within DEBOUNCE_MS ──
        const now = Date.now();
        if (now - lastLogTime < DEBOUNCE_MS) {
            return;
        }

        // ── Duplicate detection: same prompt hash within 2s ──
        const hash = quickHash(prompt);
        if (hash === lastPromptHash && now - lastLogTime < 2000) {
            return;
        }

        lastLogTime = now;
        lastPromptHash = hash;

        // ── Fire and forget ──
        sendLog(prompt, result);
    }

    // ==========================================
    // 🚀 INIT — listen for custom event
    // ==========================================
    document.addEventListener("json:generated", handleGenerated);

    // Confirmation (only in dev)
    console.log(
        "%c[BackgroundAgent] ✅ Initialized — listening for json:generated events",
        "color: #b026ff; font-weight: bold;"
    );

})();
