require("dotenv").config();
const fetch = require("node-fetch"); // if using Node 18+, native fetch works

app.use(express.json());

/*console.log("Google Client ID:", process.env.GOOGLE_CLIENT_ID);
console.log("Google Client Secret:", process.env.GOOGLE_CLIENT_SECRET);
console.log("GitHub Client ID:", process.env.GITHUB_CLIENT_ID);
console.log("GitHub Client Secret:", process.env.GITHUB_CLIENT_SECRET);*/

const express = require("express");
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
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "..")));

//session & passport
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
  })
);
app.use(passport.initialize());
app.use(passport.session());

// Connect to MySQL
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "1234", // your MySQL password
  database: "auth_dbb",
});

db.connect((err) => {
  if (err) {
    console.error("MySQL Error:", err);
    return;
  }
  console.log("MySQL Connected...");
});

// Helper function for OAuth user creation
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
      findOrCreateUser(profile.emails[0].value, done);
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
      findOrCreateUser(profile.emails[0].value, done);
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

//OAuth Routes
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
app.get("/auth/github", passport.authenticate("github"));
app.get(
  "/auth/github/callback",
  passport.authenticate("github", { failureRedirect: "/signup" }),
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
        if (err.code === "ER_DUP_ENTRY") {
          return res.status(400).json({ message: "Email already registered!" });
        }
        return res.status(500).send("Database error");
      }

      // Return userId as well
      res.json({
        message: "User registered successfully!",
        userId: result.insertId,
      });
    }
  );
});

// Login Route
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

      res.redirect("/expensetracker");
    }
  );
});

//chatbot AI
async function someChatbotFunction(message) {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // ✅ faster & cheaper than gpt-3.5-turbo
      messages: [{ role: "user", content: message }],
    });

    if (
      response &&
      response.choices &&
      response.choices.length > 0 &&
      response.choices[0].message &&
      response.choices[0].message.content
    ) {
      return response.choices[0].message.content;
    } else {
      throw new Error("No response from AI model");
    }
  } catch (err) {
    console.error("OpenAI API Error:", err.message);
    return "Sorry, I couldn't process your request right now. Please try again later.";
  }
}

// Chat Route
app.post("/chat", async (req, res) => {
  const { message } = req.body;

  console.log("Step 1: Route hit");
  console.log("Request body:", req.body);

  if (!message) {
    return res.status(400).json({ reply: "Message is required." });
  }

  try {
    console.log("Step 2: Calling chatbot API...");

    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "HTTP-Referer": "http://localhost:5000", // optional
          "X-Title": "Expense Tracker Bot",
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
    console.log("Step 3: Got response:", data);

    // Safely extract the AI reply
    const aiMessage =
      data?.choices?.[0]?.message?.content ||
      "Sorry, I couldn't process your request right now.";

    // Return the AI reply to the frontend
    res.json({ reply: aiMessage });
  } catch (err) {
    console.error("Chat fetch error:", err);
    res.status(500).json({
      reply:
        "Sorry, I couldn't process your request right now. Please try again later.",
    });
  }
});
////

app.get("/expensetracker", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "expensetracker.html"));
});

// add a transaction
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

// fetch all transactions for a user
app.get("/transactions/:userId", (req, res) => {
  const { userId } = req.params;
  db.query(
    "SELECT id, user_id, DATE_FORMAT(date, '%Y-%m-%d') AS date, amount, category,description FROM transactions WHERE user_id = ? ORDER BY date DESC",
    [userId],
    (err, result) => {
      if (err) return res.status(500).json({ error: "Database error" });
      res.json(result);
    }
  );
});

//delete transaction
app.delete("/transactions/:id", (req, res) => {
  const { id } = req.params;
  db.query("DELETE FROM transactions WHERE id = ?", [id], (err) => {
    if (err) return res.status(500).json({ error: "Database error" });
    res.json({ message: "Transaction deleted" });
  });
});

//update transactions
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

app.listen(5000, () => {
  console.log("Server running on http://localhost:5000");
});
