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
app.use(passport.initialize());
app.use(passport.session());

// CSP middleware

app.use((req, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; connect-src 'self' http://localhost:5000"
  );
  next();
});

// Suppress DevTools warning

app.get("/.well-known/appspecific/com.chrome.devtools.json", (req, res) => {
  res.json({ message: "OK" });
});

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
          });
      });
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
  passport.authenticate("google", { failureRedirect: "/signup." }),
  (req, res) => {
    res.redirect(`/expensetracker.html?userId=${req.user.id}`);
  });

// GitHub
app.get(
  "/auth/github",
  passport.authenticate("github", { scope: ["user:email"] })
);
app.get(
  "/auth/github/callback",
  passport.authenticate("github", { failureRedirect: "/signup.html" }),
  (req, res) => {
    res.redirect(`/expensetracker.html?userId=${req.user.id}`);
  }
);

// Signup Route
app.post("/signup", async (req, res) => {
  const { email, password } = req.body;

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 10);

  db.query(
    "INSERT INTO users (email, password) VALUES (?, ?)",
    [email, hashedPassword],
    (err, result) => {
     if (err) {
        if (err.code === 'ER_DUP_ENTRY') {
          return res.status(400).send("Email already registered!");
        }
        return res.status(500).send("Database error");
      }

      // Return userId as well
       res.redirect("/login.html");
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
      if (results.length === 0)
        return res.status(400).send( "User not found!");

      const user = results[0];
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) return res.status(400).send("Invalid password!");

      if (!isPasswordValid)
        return res.status(400).send("Invalid password!");

      res.redirect("/expensetracker");
    }
  );
});

// Chatbot Route Example

app.post("/chat", async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ reply: "Message is required." });

  try {
    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        },
        body: JSON.stringify({
          model: "meta-llama/llama-3-8b-instruct",
          messages: [{ role: "user", content: message }],
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("OpenRouter API error:", errText);
      return res.status(500).json({ reply: "AI API returned an error." });
    }

    const data = await response.json();
    const aiMessage =
      data?.choices?.[0]?.message?.content || "Sorry, no response.";
    res.json({ reply: aiMessage });
  } catch (err) {
    console.error("Chat fetch error:", err);
    res.status(500).json({ reply: "Sorry, could not process your request." });
  }
});

// Expense Tracker & Transactions Routes

//app.get("/expensetracker", (req, res) => {
  //res.sendFile(path.join(__dirname, "..", "expensetracker.html"));
//});

app.post("/transactions", (req, res) => {
  const { userId, date, amount, category, description } = req.body;
  db.query(
    "INSERT INTO transactions (user_id, date, amount, category, description) VALUES (?, ?, ?, ?, ?)",
    [userId, date, amount, category, description],
    (err, result) => {
      if (err) return res.status(500).json({ error: "Database error" });
      res.json({ id: result.insertId, message: "Transaction added" });
    }
  );
});

app.get("/transactions/:userId", (req, res) => {
  const { userId } = req.params;
  db.query(
    "SELECT id, user_id, DATE_FORMAT(date, '%Y-%m-%d') AS date, amount, category, description FROM transactions WHERE user_id = ? ORDER BY date DESC",
    [userId],
    (err, results) => {
      if (err) return res.status(500).json({ error: "Database error" });
      res.json(results);
    }
  );
});

app.put("/transactions/:id", (req, res) => {
  const { id } = req.params;
  const { date, amount, category, description } = req.body;
  db.query(
    "UPDATE transactions SET date=?, amount=?, category=?, description=? WHERE id=?",
    [date, amount, category, description, id],
    (err) => {
      if (err) return res.status(500).json({ error: "Database error" });
      res.json({ message: "Transaction updated" });
    }
  );
});

app.delete("/transactions/:id", (req, res) => {
  const { id } = req.params;
  db.query("DELETE FROM transactions WHERE id = ?", [id], (err) => {
    if (err) return res.status(500).json({ error: "Database error" });
    res.json({ message: "Transaction deleted" });
  });
});

// Start Server

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
