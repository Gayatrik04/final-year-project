const express = require("express");
const mysql = require("mysql2");
const bcrypt = require("bcryptjs");
const bodyParser = require("body-parser");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Connect to MySQL
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "1234", // your MySQL password
  database: "auth_dbb",
});

db.connect((err) => {
  if (err) throw err;
  // Example inside POST /transactions
  if (err) {
    console.error("🔴 MySQL Error:", err); // <-- add this line
    return res.status(500).json({ error: err.sqlMessage }); // <-- show actual MySQL error
  }
  console.log("MySQL Connected...");
});

// Signup Route
app.post("/signup", async (req, res) => {
  const { email, password } = req.body;

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 10);

  db.query(
    "INSERT INTO users (email, password) VALUES (?, ?)",
    [email, hashedPassword],
    (err, result) => {
      if (err) return res.status(500).json({ error: err });
      res.json({ message: "User registered successfully!" });
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
      if (err) return res.status(500).json({ error: err });
      if (results.length === 0)
        return res.status(400).json({ message: "User not found!" });

      const user = results[0];
      const isPasswordValid = await bcrypt.compare(password, user.password);

      if (!isPasswordValid)
        return res.status(400).json({ message: "Invalid password!" });

      res.json({ message: "Login successful!", userId: user.id });
    }
  );
});

app.listen(5000, () => {
  console.log("Server running on http://localhost:5000");
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

//
app.post("/groups", async (req, res) => {
  const { name, createdBy } = req.body;
  try {
    const [result] = await db.query(
      "INSERT INTO groups (name, created_by) VALUES (?, ?)",
      [name, createdBy]
    );
    // Add creator as member too
    await db.query(
      "INSERT INTO group_members (group_id, user_id) VALUES (?, ?)",
      [result.insertId, createdBy]
    );
    res.json({ id: result.insertId, name });
  } catch (err) {
    res.status(500).json({ error: "Failed to create group" });
  }
});

app.get("/groups/:userId", async (req, res) => {
  const userId = req.params.userId;
  try {
    const [rows] = await db.query(
      `SELECT g.id, g.name 
       FROM groups g
       JOIN group_members gm ON g.id = gm.group_id
       WHERE gm.user_id = ?`,
      [userId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch groups" });
  }
});

app.get("/groups/:groupId/transactions", async (req, res) => {
  const groupId = req.params.groupId;
  try {
    const [rows] = await db.query(
      "SELECT * FROM transactions WHERE group_id = ?",
      [groupId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch group transactions" });
  }
});
