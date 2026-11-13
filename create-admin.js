
const db = require("./database");
const bcrypt = require("bcryptjs");
const readline = require("readline");

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

rl.question("Admin username: ", (username) => {
    rl.question("Admin password: ", async (password) => {
        try {
            const [existing] = await db.execute(
                "SELECT id FROM users WHERE username = ?",
                [username]
            );

            if (existing.length) {
                console.log("Username already exists!");
            } else {
                const hash = await bcrypt.hash(password, 12);

                await db.execute(
                    `INSERT INTO users
                    (username, password_hash, full_name, role)
                    VALUES (?, ?, ?, ?)`,
                    [username, hash, "Administrator", "admin"]
                );

                console.log("Admin account created successfully!");
            }
        } catch (error) {
            console.error("Error:", error.message);
        } finally {
            rl.close();
            await db.end();
        }
    });
});
