const express = require("express");
const db = require("../database");

const router = express.Router();
const MAX_KEY_LENGTH = 191;
let storageTableReady;

function requireLogin(req, res, next) {
    if (!req.session.user) {
        return res.status(401).json({ error: "Authentication required." });
    }
    next();
}

function getKey(req, res) {
    const key = req.query.key;
    if (typeof key !== "string" || !key || key.length > MAX_KEY_LENGTH) {
        res.status(400).json({ error: `A key of 1-${MAX_KEY_LENGTH} characters is required.` });
        return null;
    }
    return key;
}

function sendStorageError(res, error) {
    console.error("MySQL storage error:", error.message);
    if (!process.env.MYSQL_HOST || !process.env.MYSQL_USER || !process.env.MYSQL_DATABASE) {
        return res.status(503).json({
            code: "MYSQL_NOT_CONFIGURED",
            error: "MySQL storage is not configured. Set MYSQL_* values in .env and restart the server."
        });
    }
    return res.status(503).json({
        code: "MYSQL_STORAGE_UNAVAILABLE",
        error: "MySQL storage is unavailable."
    });
}

function ensureStorageTable() {
    if (!storageTableReady) {
        storageTableReady = db.execute(`
            CREATE TABLE IF NOT EXISTS user_app_data (
                user_id BIGINT NOT NULL,
                data_key VARCHAR(${MAX_KEY_LENGTH}) NOT NULL,
                data_value LONGTEXT NOT NULL,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (user_id, data_key)
            ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
        `).catch((error) => {
            storageTableReady = null;
            throw error;
        });
    }
    return storageTableReady;
}

function recordsFromRows(rows) {
    return Object.fromEntries(rows.map((row) => [row.data_key, row.data_value]));
}

router.use(requireLogin);

router.get("/", async (req, res) => {
    try {
        await ensureStorageTable();
        const key = req.query.key;
        if (key !== undefined) {
            const validatedKey = getKey(req, res);
            if (validatedKey === null) return;
            const [rows] = await db.execute(
                "SELECT data_value FROM user_app_data WHERE user_id = ? AND data_key = ?",
                [req.session.user.id, validatedKey]
            );
            return res.json({ value: rows[0]?.data_value ?? null });
        }

        const [rows] = await db.execute(
            "SELECT data_key, data_value FROM user_app_data WHERE user_id = ?",
            [req.session.user.id]
        );
        return res.json({ records: recordsFromRows(rows) });
    } catch (error) {
        return sendStorageError(res, error);
    }
});

router.put("/", async (req, res) => {
    const key = getKey(req, res);
    if (key === null) return;
    if (typeof req.body?.value !== "string") {
        return res.status(400).json({ error: "A string value is required." });
    }

    try {
        await ensureStorageTable();
        await db.execute(
            `INSERT INTO user_app_data (user_id, data_key, data_value)
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE data_value = VALUES(data_value)`,
            [req.session.user.id, key, req.body.value]
        );
        return res.json({ success: true });
    } catch (error) {
        return sendStorageError(res, error);
    }
});

router.delete("/", async (req, res) => {
    const key = getKey(req, res);
    if (key === null) return;
    try {
        await ensureStorageTable();
        await db.execute(
            "DELETE FROM user_app_data WHERE user_id = ? AND data_key = ?",
            [req.session.user.id, key]
        );
        return res.json({ success: true });
    } catch (error) {
        return sendStorageError(res, error);
    }
});

router.post("/migrate", async (req, res) => {
    const records = req.body?.records;
    if (!records || typeof records !== "object" || Array.isArray(records)) {
        return res.status(400).json({ error: "A records object is required." });
    }
    const entries = Object.entries(records);
    if (entries.length > 2000 || entries.some(([key, value]) =>
        !key || key.length > MAX_KEY_LENGTH || typeof value !== "string"
    )) {
        return res.status(400).json({ error: "The submitted data contains invalid or unsupported records." });
    }

    let connection;
    try {
        await ensureStorageTable();
        connection = await db.getConnection();
        await connection.beginTransaction();
        let imported = false;
        for (let offset = 0; offset < entries.length; offset += 100) {
            const batch = entries.slice(offset, offset + 100);
            const placeholders = batch.map(() => "(?, ?, ?)").join(", ");
            const values = batch.flatMap(([key, value]) => [req.session.user.id, key, value]);
            const [result] = await connection.execute(
                `INSERT IGNORE INTO user_app_data (user_id, data_key, data_value) VALUES ${placeholders}`,
                values
            );
            imported ||= result.affectedRows > 0;
        }
        const [rows] = await connection.execute(
            "SELECT data_key, data_value FROM user_app_data WHERE user_id = ?",
            [req.session.user.id]
        );
        await connection.commit();
        return res.json({
            success: true,
            imported,
            records: recordsFromRows(rows)
        });
    } catch (error) {
        if (connection) {
            try {
                await connection.rollback();
            } catch (rollbackError) {
                console.error("MySQL storage rollback error:", rollbackError.message);
            }
        }
        return sendStorageError(res, error);
    } finally {
        connection?.release();
    }
});

module.exports = router;
