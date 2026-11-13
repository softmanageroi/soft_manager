
const express = require("express");
const session = require("express-session");
const path = require("path");
require("dotenv").config();

const app = express();

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(session({
    name: "softmanager.sid",
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: false,
        sameSite: "lax",
        maxAge: 8 * 60 * 60 * 1000
    }
}));

app.use("/api/auth", require("./routes/auth"));
app.use("/api/data", require("./routes/data"));

app.get("/api", (req, res) => {
    res.json({
        success: true,
        message: "Soft Manager Backend is Running!"
    });
});

app.use(express.static(__dirname));

app.get("/", (req, res) => {
    res.redirect("/html/index.html");
});

const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
    console.log(`Soft Manager running at http://localhost:${PORT}`);
});
