// ==========================================
// 📝 ASYNC JSON LOGGER
// File: /utils/logger.js
// ==========================================

const fs = require("fs/promises");
const path = require("path");

// ==========================================
// 📂 FILE PATHS
// ==========================================
const DATA_DIR = path.join(__dirname, "..", "data");
const HISTORY_FILE = path.join(DATA_DIR, "history.json");

// ==========================================
// 🔒 WRITE LOCK (prevents race conditions)
// ==========================================
let writeLock = false;
const writeQueue = [];

async function acquireLock() {
    return new Promise((resolve) => {
        if (!writeLock) {
            writeLock = true;
            resolve();
        } else {
            writeQueue.push(resolve);
        }
    });
}

function releaseLock() {
    if (writeQueue.length > 0) {
        const next = writeQueue.shift();
        next();
    } else {
        writeLock = false;
    }
}

// ==========================================
// 📄 INITIALIZE STORAGE
// ==========================================
async function ensureStorageExists() {
    try {
        await fs.access(DATA_DIR);
    } catch {
        await fs.mkdir(DATA_DIR, { recursive: true });
    }

    try {
        await fs.access(HISTORY_FILE);
    } catch {
        const initial = {
            metadata: {
                version: "1.0",
                lastUpdated: new Date().toISOString(),
                totalEntries: 0
            },
            entries: []
        };
        await fs.writeFile(
            HISTORY_FILE,
            JSON.stringify(initial, null, 2),
            "utf-8"
        );
    }
}

// ==========================================
// 📖 READ HISTORY
// ==========================================
async function readHistory() {
    await ensureStorageExists();

    const raw = await fs.readFile(HISTORY_FILE, "utf-8");

    try {
        return JSON.parse(raw);
    } catch {
        // Corrupted file — reset
        console.warn("⚠️  history.json was corrupted. Resetting...");
        const fresh = {
            metadata: {
                version: "1.0",
                lastUpdated: new Date().toISOString(),
                totalEntries: 0
            },
            entries: []
        };
        await fs.writeFile(
            HISTORY_FILE,
            JSON.stringify(fresh, null, 2),
            "utf-8"
        );
        return fresh;
    }
}

// ==========================================
// ✏️ APPEND ENTRY
// ==========================================
async function appendEntry(userPrompt, generatedOutput) {
    await acquireLock();

    try {
        const history = await readHistory();

        // Generate sequential ID
        const entryNumber = history.entries.length + 1;
        const id = `entry_${String(entryNumber).padStart(3, "0")}`;

        // Build entry
        const entry = {
            id,
            timestamp: new Date().toISOString(),
            userPrompt,
            generatedOutput
        };

        // Append
        history.entries.push(entry);

        // Update metadata
        history.metadata.lastUpdated = entry.timestamp;
        history.metadata.totalEntries = history.entries.length;

        // Write atomically (write to temp, then rename)
        const tempFile = HISTORY_FILE + ".tmp";
        await fs.writeFile(
            tempFile,
            JSON.stringify(history, null, 2),
            "utf-8"
        );
        await fs.rename(tempFile, HISTORY_FILE);

        console.log(`✅ Logged ${id} at ${entry.timestamp}`);
        return entry;

    } finally {
        releaseLock();
    }
}

// ==========================================
// 📤 EXPORTS
// ==========================================
module.exports = {
    readHistory,
    appendEntry,
    ensureStorageExists,
    HISTORY_FILE
};
