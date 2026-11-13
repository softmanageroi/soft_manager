
const express = require("express");
const bcrypt = require("bcryptjs");
const db = require("../database");

const router = express.Router();

// Login API
router.post("/login", async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                error: "Username and password are required."
            });
        }

        const [users] = await db.execute(
            `SELECT id, username, password_hash, full_name, role, is_active
             FROM users
             WHERE username = ?
             LIMIT 1`,
            [username.trim()]
        );

        if (!users.length || !users[0].is_active) {
            return res.status(401).json({
                error: "Invalid username or password."
            });
        }

        const user = users[0];
        const passwordMatch = await bcrypt.compare(
            password,
            user.password_hash
        );

        if (!passwordMatch) {
            return res.status(401).json({
                error: "Invalid username or password."
            });
        }

        req.session.regenerate((error) => {
            if (error) {
                return res.status(500).json({
                    error: "Could not create login session."
                });
            }

            req.session.user = {
                id: user.id,
                username: user.username,
                full_name: user.full_name,
                role: user.role
            };

            req.session.save((saveError) => {
                if (saveError) {
                    return res.status(500).json({
                        error: "Could not save login session."
                    });
                }

                res.json({
                    success: true,
                    user: req.session.user
                });
            });
        });

    } catch (error) {
        console.error("Login error:", error.message);
        res.status(500).json({
            error: "Internal server error."
        });
    }
});

// Check login session
router.get("/session", (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({
            error: "Authentication required."
        });
    }

    res.json({
        success: true,
        user: req.session.user
    });
});

// Logout API
router.post("/logout", (req, res) => {
    req.session.destroy((error) => {
        if (error) {
            return res.status(500).json({
                error: "Logout failed."
            });
        }

        res.clearCookie("softmanager.sid");

        res.json({
            success: true,
            message: "Logged out successfully."
        });
    });
});

module.exports = router;
