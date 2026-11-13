
const db = require("./database");

async function testConnection() {
    try {
        const connection = await db.getConnection();
        console.log("MySQL Connected Successfully!");
        connection.release();
        process.exit(0);
    } catch (error) {
        console.error("Database Error:", error.message);
        process.exit(1);
    }
}

testConnection();
