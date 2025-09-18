require('dotenv').config();

/*console.log("Google Client ID:", process.env.GOOGLE_CLIENT_ID);
console.log("Google Client Secret:", process.env.GOOGLE_CLIENT_SECRET);
console.log("GitHub Client ID:", process.env.GITHUB_CLIENT_ID);
console.log("GitHub Client Secret:", process.env.GITHUB_CLIENT_SECRET);*/

const express = require("express");
const mysql = require("mysql2");
const bcrypt = require("bcryptjs");
const bodyParser = require("body-parser");
const cors = require("cors");
const passport = require('passport');
const session = require('express-session');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;

const app = express();
app.use(cors());
app.use(bodyParser.json());

//session & passport
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true
}));
app.use(passport.initialize());
app.use(passport.session());

// Connect to MySQL
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "gayatri@MYSQL", // your MySQL password
  database: "auth_dbb"
});

db.connect(err => {
  if (err) throw err;
  console.log("MySQL Connected...");
});

// Helper function for OAuth user creation
const findOrCreateUser = (email, done) => {
  db.query("SELECT * FROM users WHERE email = ?", [email], (err, results) => {
    if (err) return done(err);
    if (results.length > 0) return done(null, results[0]);
    
    db.query("INSERT INTO users (email, password) VALUES (?, ?)", [email, ''], (err, result) => {
      if (err) return done(err);
      db.query("SELECT * FROM users WHERE id = ?", [result.insertId], (err, newUser) => {
        if (err) return done(err);
        done(null, newUser[0]);
      });
    });
  });
};

// Passport Strategies
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: "http://localhost:5000/auth/google/callback"
}, (accessToken, refreshToken, profile, done) => {
  findOrCreateUser(profile.emails[0].value, done);
}));

passport.use(new GitHubStrategy({
  clientID: process.env.GITHUB_CLIENT_ID,
  clientSecret: process.env.GITHUB_CLIENT_SECRET,
  callbackURL: "http://localhost:5000/auth/github/callback"
}, (accessToken, refreshToken, profile, done) => {
  findOrCreateUser(profile.emails[0].value, done);
}));

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser((id, done) => {
  db.query("SELECT * FROM users WHERE id = ?", [id], (err, results) => {
    if (err) return done(err);
    done(null, results[0]);
  });
});



        
//OAuth Routes
// Google
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
app.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/signup' }), (req, res) => res.redirect('/dashboard'));

// GitHub
app.get('/auth/github', passport.authenticate('github'));
app.get('/auth/github/callback', passport.authenticate('github', { failureRedirect: '/signup' }), (req, res) => res.redirect('/dashboard'));

// Signup Route
app.post("/signup", async (req, res) => {
  const {email, password } = req.body;

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 10);

  db.query(
    "INSERT INTO users (email, password) VALUES (?, ?)",
    [email, hashedPassword],
    (err, result) => {
     if (err) {
        if (err.code === 'ER_DUP_ENTRY') {
          return res.status(400).json({ message: "Email already registered!" });
        }
        return res.status(500).json({ error: err });
      }

      // Return userId as well
      res.json({ message: "User registered successfully!", userId: result.insertId });
    }
  );
});

// Login Route
app.post("/login", (req, res) => {
  const { email, password } = req.body;

  db.query("SELECT * FROM users WHERE email = ?", [email], async (err, results) => {
    if (err) return res.status(500).json({ error: err });
    if (results.length === 0) return res.status(400).json({ message: "User not found!" });

    const user = results[0];
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) return res.status(400).json({ message: "Invalid password!" });

    res.json({ message: "Login successful!",userId: user.id });
  });
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

//Create group
app.post("/groups", (req, res) => {
  const { group_name, created_by } = req.body;

  db.query(
    "INSERT INTO groups (group_name, created_by) VALUES (?, ?)",
    [group_name, created_by],
    (err, result) => {
      if (err) return res.status(500).json({ error: "Database error" });

      const groupId = result.insertId;

       // add creator as member
      db.query(
        "INSERT INTO group_members (group_id, user_id) VALUES (?, ?)",
        [groupId, created_by],
        (err2) => {
          if (err2) return res.status(500).json({ error: "Database error" });
          res.json({ id: groupId, message: "Group created successfully!" });
        }
      );
    }
  );
});

// Add member
app.post("/groups/:groupId/members", (req, res) => {
  const { groupId } = req.params;
  const { user_id } = req.body;

  db.query(
    "INSERT INTO group_members (group_id, user_id) VALUES (?, ?)",
    [groupId, user_id],
    (err) => {
      if (err) return res.status(500).json({ error: "Database error" });
      res.json({ message: "Member added to group!" });
    }
  );
});

// Add expense
app.post("/groups/:groupId/expenses", (req, res) => {
  const { groupId } = req.params;
  const { paid_by, description, amount } = req.body;

  db.query(
    "INSERT INTO group_expenses (group_id, paid_by, description, amount) VALUES (?, ?, ?, ?)",
    [groupId, paid_by, description, amount],
    (err, result) => {
      if (err) return res.status(500).json({ error: "Database error" });
      res.json({ id: result.insertId, message: "Expense added!" });
    }
  );
});

// Fetch group details
app.get("/groups/:groupId", (req, res) => {
  const { groupId } = req.params;

  const groupQuery = "SELECT * FROM groups WHERE id = ?";
  const membersQuery = `
    SELECT u.id, u.email 
    FROM group_members gm 
    JOIN users u ON gm.user_id = u.id 
    WHERE gm.group_id = ?`;
  const expensesQuery = "SELECT * FROM group_expenses WHERE group_id = ? ORDER BY id DESC";

  db.query(groupQuery, [groupId], (err, groupResult) => {
    if (err) return res.status(500).json({ error: "Database error" });
    if (groupResult.length === 0) return res.status(404).json({ message: "Group not found" });

    db.query(membersQuery, [groupId], (err2, membersResult) => {
      if (err2) return res.status(500).json({ error: "Database error" });

      db.query(expensesQuery, [groupId], (err3, expensesResult) => {
        if (err3) return res.status(500).json({ error: "Database error" });

        res.json({
          group: groupResult[0],
          members: membersResult,
          expenses: expensesResult
        });
      });
    });
  });
});

app.listen(5000, () => {
  console.log("Server running on http://localhost:5000");
});

