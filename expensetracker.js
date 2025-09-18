let editIndex = -1;

// Get userId (OAuth login)
const urlParams = new URLSearchParams(window.location.search);
const oauthUserId = urlParams.get("userId");

// Check localStorage first, then OAuth query param
let currentUser = localStorage.getItem("currentUser") || oauthUserId;

if (!currentUser) {
  alert("Please login first!");
  window.location.href = "login.html";
} else {
  // store for later use if logged in via OAuth
  localStorage.setItem("currentUser", currentUser);
}


let transactions = [];

const incomeDisplay = document.getElementById("total-income");
const expenseDisplay = document.getElementById("total-expense");
const balanceDisplay = document.getElementById("balance");
const tableBody = document.getElementById("expense-table");
const actionButton = document.querySelector("button");
const sortSelect = document.getElementById("sortBy");
const limitInput = document.getElementById("limit");
const limitWarning = document.getElementById("limit-warning");
const targetDateInput = document.getElementById("targetDate");
const aiSuggestionDiv = document.getElementById("ai-suggestion");

const savedLimit = localStorage.getItem(currentUser + "_limit");
if (savedLimit) limitInput.value = savedLimit;



// --- Add this near the top of expensetracker.js ---
function computeAndRenderMonthlyPrediction(transactions) {
  if (!Array.isArray(transactions)) {
    console.warn(
      "computeAndRenderMonthlyPrediction called with invalid data:",
      transactions
    );
    return;
  }

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  let monthlyTotal = 0;
  transactions.forEach((tx) => {
    const txDate = new Date(tx.date);
    if (
      txDate.getMonth() === currentMonth &&
      txDate.getFullYear() === currentYear &&
      tx.category !== "Income"
    ) {
      monthlyTotal += parseFloat(tx.amount) || 0;
    }
  });

  console.log(`Predicted spending for this month: ₹${monthlyTotal.toFixed(2)}`);
}

function updateTotals() {
  let totalIncome = 0,
    totalExpense = 0;

  transactions.forEach((tx) => {
    const amt = Number(tx.amount);
    if (tx.category === "Income") {
      totalIncome += amt;
    } else {
      totalExpense += amt;
    }
    //updateTotals()
    computeAndRenderMonthlyPrediction(transactions); //
  });

  incomeDisplay.textContent = totalIncome.toFixed(2);
  expenseDisplay.textContent = totalExpense.toFixed(2);
  balanceDisplay.textContent = (totalIncome - totalExpense).toFixed(2);

  const limitValue = Number(limitInput.value);
  if (limitValue && totalExpense > limitValue) {
    limitWarning.classList.remove("hidden");
  } else {
    limitWarning.classList.add("hidden");
  }

  updateAISuggestion(limitValue, totalExpense);
}

const savingGoalDateInput = document.getElementById("savingGoalDate");

function updateAISuggestion(limitValue, totalExpense) {
  const savingGoalDate = savingGoalDateInput.value;
  if (!limitValue || !savingGoalDate) {
    aiSuggestionDiv.classList.add("hidden");
    return;
  }

  const today = new Date();
  const target = new Date(savingGoalDate);
  const diffInDays = Math.ceil((target - today) / (1000 * 60 * 60 * 24));

  if (diffInDays <= 0) {
    aiSuggestionDiv.textContent = "⚠️ Saving goal date must be in the future!";
    aiSuggestionDiv.classList.remove("hidden");
    return;
  }

  const remainingBudget = limitValue - totalExpense;
  const dailySpend = remainingBudget / diffInDays;

  if (dailySpend < 0) {
    aiSuggestionDiv.textContent = "🚨 You have already overspent your limit!";
  } else {
    aiSuggestionDiv.textContent = `💡 To reach your goal, spend only ₹${dailySpend.toFixed(
      2
    )} per day for the next ${diffInDays} days.`;
  }

  aiSuggestionDiv.classList.remove("hidden");
}

limitInput.addEventListener("input", () => updateTotals());
savingGoalDateInput.addEventListener("change", () => updateTotals());

//
function clearForm() {
  document.getElementById("date").value = "";
  document.getElementById("amount").value = "";
  document.getElementById("category").value = "Income";
  document.getElementById("description").value = "";
  editIndex = -1;
  actionButton.textContent = "Add Expense";
}

function renderTable() {
  tableBody.innerHTML = "";
  transactions.forEach((tx, index) => {
    const row = tableBody.insertRow();
    row.innerHTML = `
      <td>${tx.date}</td>
      <td>₹${Number(tx.amount).toFixed(2)}</td>
      <td>${tx.category}</td>
      <td>${tx.description}</td>
      <td>
        <span class="icon-btn edit-btn" onclick="editTransaction(${index})" title="Edit">✏️</span> 
        <span class="icon-btn delete-btn" onclick="deleteTransaction(${index})" title="Delete">🗑️</span>
      </td>
    `;
    //those are unicode emoji  built into the os/browser
  });

  updateTotals();
}

async function addExpense() {
  const date = document.getElementById("date").value;
  const amount = parseFloat(document.getElementById("amount").value);
  const category = document.getElementById("category").value;
  const description = document.getElementById("description").value;

  if (!date || isNaN(amount) || !description) {
    alert("Please fill all fields correctly");
    return;
  }

  const transaction = {
    date,
    amount,
    category,
    description,
    userId: currentUser,
  };

  if (editIndex === -1) {
    await fetch("http://localhost:5000/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(transaction),
    });
  } else {
    // Update existing → PUT
    const id = transactions[editIndex].id;
    await fetch(`http://localhost:5000/transactions/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(transaction),
    });
    fetchTransactions();
  }

  clearForm();
  fetchTransactions(); // refresh list from backend
}

function editTransaction(index) {
  const tx = transactions[index];
  document.getElementById("date").value = tx.date;
  document.getElementById("amount").value = tx.amount;
  document.getElementById("category").value = tx.category;
  document.getElementById("description").value = tx.description;
  editIndex = index;
  actionButton.textContent = "Update Expense";
}

async function deleteTransaction(index) {
  const id = transactions[index].id; // id comes from DB
  if (confirm("Are you sure you want to delete this transaction?")) {
    await fetch(`http://localhost:5000/transactions/${id}`, {
      method: "DELETE",
    });
    fetchTransactions(); // reload fresh data
  }
}

function applySort() {
  const sortBy = sortSelect.value;

  if (sortBy === "date") {
    // Sort by date (newest first)
    transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
  } else if (sortBy === "category") {
    // Sort alphabetically by category
    transactions.sort((a, b) => a.category.localeCompare(b.category));
  }

  renderTable();
}

async function fetchTransactions() {
  const response = await fetch(
    `http://localhost:5000/transactions/${currentUser}`
  );
  transactions = await response.json();
  applySort(); // keeps sorting
}

fetchTransactions();

//logout
document.getElementById("logoutBtn").addEventListener("click", () => {
  localStorage.removeItem("currentUser");
  window.location.href = "login.html";
});
