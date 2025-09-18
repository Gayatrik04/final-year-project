const express = require("express");
const dotenv = require("dotenv");
const mysql = require("mysql2");
const bcrypt = require("bcryptjs");
const bodyParser = require("body-parser");
const cors = require("cors");
const passport = require("passport");
const session = require("express-session");
const path = require("path");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const GitHubStrategy = require("passport-github2").Strategy;

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "..")));

// Sessions & Passport

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
  })
);

// MySQL Connection

const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "1234", // change if needed
  database: "auth_dbb",
});

db.connect((err) => {
  if (err) return console.error("MySQL Error:", err);
  console.log("MySQL Connected...");
});

// Helper function

const findOrCreateUser = (email, done) => {
  db.query("SELECT * FROM users WHERE email = ?", [email], (err, results) => {
    if (err) return done(err);
    if (results.length > 0) return done(null, results[0]);

    db.query(
      "INSERT INTO users (email, password) VALUES (?, ?)",
      [email, ""],
      (err, result) => {
        if (err) return done(err);
        db.query(
          "SELECT * FROM users WHERE id = ?",
          [result.insertId],
          (err, newUser) => {
            if (err) return done(err);
            done(null, newUser[0]);
          }
        );
      }
    );
  });
};

// Passport Strategies

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "http://localhost:5000/auth/google/callback",
    },
    (accessToken, refreshToken, profile, done) => {
      const email =
        profile.emails && profile.emails[0] ? profile.emails[0].value : null;
      if (!email) return done(new Error("No email found"), null);
      findOrCreateUser(email, done);
    }
  )
);

passport.use(
  new GitHubStrategy(
    {
      clientID: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      callbackURL: "http://localhost:5000/auth/github/callback",
    },
    (accessToken, refreshToken, profile, done) => {
      const email =
        profile.emails && profile.emails[0] ? profile.emails[0].value : null;
      if (!email) return done(new Error("No email found"), null);
      findOrCreateUser(email, done);
    }
  )
);

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser((id, done) => {
  db.query("SELECT * FROM users WHERE id = ?", [id], (err, results) => {
    if (err) return done(err);
    done(null, results[0]);
  });
});

// OAuth Routes

// Google
app.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);
app.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/signup" }),
  (req, res) => {
    res.redirect(`/expensetracker.html?userId=${req.user.id}`);
  }
);

// GitHub
app.get(
  "/auth/github",
  passport.authenticate("github", { scope: ["user:email"] })
);
app.get(
  "/auth/github/callback",
  passport.authenticate("github", { failureRedirect: "/signup" }),
  (req, res) => {
    res.redirect(`/expensetracker.html?userId=${req.user.id}`);
  }
);

// Signup/Login Routes

// Signup
app.post("/signup", async (req, res) => {
  const { email, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);

  db.query(
    "INSERT INTO users (email, password) VALUES (?, ?)",
    [email, hashedPassword],
    (err, result) => {
      if (err) {
        if (err.code === "ER_DUP_ENTRY")
          return res.status(400).json({ message: "Email already registered!" });
        return res.status(500).send("Database error");
      }
      res.json({
        message: "User registered successfully!",
        userId: result.insertId,
      });
    }
  );
});

// Login
app.post("/login", (req, res) => {
  const { email, password } = req.body;

  db.query(
    "SELECT * FROM users WHERE email = ?",
    [email],
    async (err, results) => {
      if (err) return res.status(500).send("Database error");
      if (results.length === 0) return res.status(400).send("User not found!");

      const user = results[0];
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) return res.status(400).send("Invalid password!");

      res.redirect(`/expensetracker.html?userId=${user.id}`);
    }
  );
});

//chatbot
app.post("/chat", (req, res) => {
  const { message } = req.body; // read message from frontend
  if (!message) {
    return res.status(400).json({ error: "Message is required" });
  }

  // For now, just reply back with the same message
  res.json({ reply: `You said: ${message}` });
});

// Start Server

app.listen(PORT, () =>
  console.log(`Server running on http://localhost:${PORT}`)
);
