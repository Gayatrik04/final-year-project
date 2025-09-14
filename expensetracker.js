let editIndex = -1;
let currentUser = localStorage.getItem("currentUser");

if (!currentUser) {
  alert("Please login first!");
  window.location.href = "login.html";
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

const savedLimit = localStorage.getItem(currentUser + "_limit");
if (savedLimit) limitInput.value = savedLimit;
//
const targetDateInput = document.getElementById("targetDate");
const aiSuggestionDiv = document.getElementById("ai-suggestion");

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

// ---------- Monthly spending prediction helpers ----------

let monthlyPredictionChart = null;

function parsePossibleDate(d) {
  const dt = new Date(d);
  if (!isNaN(dt)) return dt;

  const parts = String(d).split(/[-\/]/);
  if (parts.length === 3) {
    if (parts[2].length === 4)
      return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
    if (parts[0].length === 4)
      return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  }
  return null;
}

function getDaysInMonth(year, monthZeroBased) {
  return new Date(year, monthZeroBased + 1, 0).getDate();
}

function computeAndRenderMonthlyPrediction(transactionsArray) {
  try {
    if (!Array.isArray(transactionsArray)) {
      console.error("Invalid transactionsArray:", transactionsArray);
      document.getElementById("prediction-text").innerText =
        "Could not compute monthly prediction.";
      return;
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const todayDate = now.getDate();
    const daysInMonth = getDaysInMonth(year, month);

    const dailyTotals = new Array(daysInMonth).fill(0);

    transactionsArray.forEach((tx) => {
      const dateObj = parsePossibleDate(
        tx.date || tx.transactionDate || tx.timestamp || tx.createdAt
      );
      if (!dateObj) return;

      if (dateObj.getFullYear() === year && dateObj.getMonth() === month) {
        const d = dateObj.getDate();
        if (d >= 1 && d <= daysInMonth) {
          const amt = parseFloat(tx.amount ?? tx.value ?? 0);
          if (!isNaN(amt)) dailyTotals[d - 1] += amt;
        }
      }
    });

    const cumulativeActual = [];
    let running = 0;
    for (let i = 0; i < daysInMonth; i++) {
      running += dailyTotals[i];
      cumulativeActual.push(Math.round((running + Number.EPSILON) * 100) / 100);
    }

    const spentSoFar = cumulativeActual[todayDate - 1] || 0;
    const avgDailySoFar = todayDate > 0 ? spentSoFar / todayDate : 0;
    const predictedTotal = Math.round(avgDailySoFar * daysInMonth * 100) / 100;

    const labels = Array.from({ length: daysInMonth }, (_, i) =>
      (i + 1).toString()
    );

    const actualData = new Array(daysInMonth).fill(null);
    for (let i = 0; i < todayDate; i++) actualData[i] = cumulativeActual[i];

    const predictedData = new Array(daysInMonth).fill(null);
    for (let i = todayDate - 1; i < daysInMonth; i++) {
      predictedData[i] =
        i + 1 <= todayDate
          ? cumulativeActual[i]
          : Math.round(
              (spentSoFar +
                avgDailySoFar * (i + 1 - todayDate) * 1 +
                Number.EPSILON) *
                100
            ) / 100;
    }

    const pText = document.getElementById("prediction-text");
    if (pText) {
      if (transactionsArray.length === 0 || spentSoFar === 0) {
        pText.innerText = `Not enough data yet to predict this month.`;
      } else {
        pText.innerText = `You’re likely to spend ₹${predictedTotal.toLocaleString(
          undefined,
          { minimumFractionDigits: 0, maximumFractionDigits: 2 }
        )} this month based on your current trend.`;
      }
    }

    const canvas = document.getElementById("monthlyPredictionChart");
    if (!canvas) {
      console.error("Canvas element #monthlyPredictionChart not found");
      return;
    }
    const ctx = canvas.getContext("2d");

    const config = {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Actual (cumulative)",
            data: actualData,
            tension: 0.3,
            borderWidth: 2,
            pointRadius: 3,
            fill: false,
          },
          {
            label: "Predicted (projection)",
            data: predictedData,
            tension: 0.3,
            borderWidth: 2,
            borderDash: [6, 6],
            pointRadius: 2,
            fill: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: { legend: { display: true, position: "top" } },
        scales: {
          x: { title: { display: true, text: "Day of month" } },
          y: {
            title: { display: true, text: "Cumulative spend (₹)" },
            beginAtZero: true,
          },
        },
      },
    };

    if (monthlyPredictionChart) {
      monthlyPredictionChart.data = config.data;
      monthlyPredictionChart.options = config.options;
      monthlyPredictionChart.update();
    } else {
      monthlyPredictionChart = new Chart(ctx, config);
    }
  } catch (err) {
    console.error("Monthly prediction error", err);
    const pText = document.getElementById("prediction-text");
    if (pText) pText.innerText = "Could not compute monthly prediction.";
  }
}

///////
document.addEventListener("DOMContentLoaded", () => {
  const aiBtn = document.getElementById("ai-suggestions-btn");
  const aiPopup = document.getElementById("ai-suggestions-popup");
  const aiClose = document.getElementById("ai-close-btn");
  const aiList = document.getElementById("ai-suggestions-list");

  aiBtn.addEventListener("click", () => {
    aiPopup.classList.toggle("show");
    fetchAISuggestions();
  });

  aiClose.addEventListener("click", () => {
    aiPopup.classList.remove("show");
  });

  async function fetchAISuggestions() {
    try {
      // Fetch data from your MySQL backend API
      const userId = localStorage.getItem("currentUserId");
      const res = await fetch(`/api/transactions/${transactionId}`);
      const data = await res.json();

      // Send data to backend AI API
      const aiRes = await fetch("/api/ai-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactions: data }),
      });

      const { suggestions } = await aiRes.json();

      aiList.innerHTML = suggestions.map((s) => `<p>• ${s}</p>`).join("");
    } catch (error) {
      aiList.innerHTML = `<p style="color:red;">Error fetching AI suggestions</p>`;
    }
  }
});
