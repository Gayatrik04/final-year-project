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

// ================= AI Suggestions Logic ==================
/* AI Widget — robust version
   Put this at the end of expensetracker.js (after HTML is loaded), or keep it in a script tag before </body>.
*/
document.addEventListener("DOMContentLoaded", () => {
  // DOM elements (IDs must match your HTML)
  const suggestionsList = document.getElementById("ai-suggestions-list");
  const generateBtn = document.getElementById("ai-generate-btn");
  const toggleBtn = document.getElementById("ai-widget-toggle");
  const widgetContainer = document.getElementById("ai-widget-container");
  const refreshBtn = document.getElementById("ai-refresh-btn"); // optional

  // Check elements exist
  if (!suggestionsList || !generateBtn || !toggleBtn || !widgetContainer) {
    console.error("AI Widget: Missing required element(s). Found:", {
      suggestionsList: !!suggestionsList,
      generateBtn: !!generateBtn,
      toggleBtn: !!toggleBtn,
      widgetContainer: !!widgetContainer,
    });
    return; // stop: fix HTML IDs or move script below HTML
  }

  // Ensure widget initially hidden (you can change default)
  if (!widgetContainer.style.display) widgetContainer.style.display = "none";

  // Helper: obtain user data automatically.
  // It will:
  //  - call getUserDataFromApp() if that function exists (supports async or sync)
  //  - else fall back to global window.userData or window.userDataLocal or static `userData` variable
  async function fetchUserDataAuto() {
    try {
      if (typeof getUserDataFromApp === "function") {
        const maybePromise = getUserDataFromApp();
        const resolved =
          maybePromise instanceof Promise ? await maybePromise : maybePromise;
        return resolved || { income: 0, savings: 0, expenses: [] };
      }
      // Fallbacks if you keep a global variable:
      if (window.userData) return window.userData;
      if (window.userDataLocal) return window.userDataLocal;
      if (typeof userData !== "undefined") return userData; // your previous example var
      // Last resort, try localStorage "expenses"/"income"
      try {
        const expRaw = localStorage.getItem("expenses");
        const incRaw = localStorage.getItem("income");
        const expenses = expRaw ? JSON.parse(expRaw) : [];
        const income = incRaw ? parseFloat(incRaw) || 0 : 0;
        const totalExpenses = Array.isArray(expenses)
          ? expenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0)
          : 0;
        const savings = income > 0 ? income - totalExpenses : 0;
        return {
          income,
          savings,
          expenses: Array.isArray(expenses) ? expenses : [],
        };
      } catch (e) {
        return { income: 0, savings: 0, expenses: [] };
      }
    } catch (err) {
      console.error("AI Widget: fetchUserDataAuto error", err);
      return { income: 0, savings: 0, expenses: [] };
    }
  }

  // Generate suggestions from user object (synchronous)
  function generateSuggestions(user) {
    const suggestions = [];
    if (!user || !Array.isArray(user.expenses) || user.expenses.length === 0) {
      suggestions.push(
        "⚠️ No expenses found. Please add your expenses to get AI suggestions."
      );
      return suggestions;
    }

    const totalExpenses = user.expenses.reduce(
      (acc, e) => acc + (parseFloat(e.amount) || 0),
      0
    );
    const savingsRate =
      user.income > 0 ? ((user.savings / user.income) * 100).toFixed(1) : 0;

    // savings insights
    if (savingsRate < 20) {
      suggestions.push(
        `💸 Your savings rate is ${savingsRate}%. Aim for 20-30% of income.`
      );
      suggestions.push(
        "💡 Tip: Automate savings (standing instruction) to prioritize saving."
      );
    } else {
      suggestions.push(`✅ Great! You save ${savingsRate}% of your income.`);
    }

    // high expense warnings
    user.expenses.forEach((exp) => {
      if (exp.amount > (user.income || 1) * 0.3) {
        suggestions.push(
          `🚨 You spend a lot on ${exp.category}. Try reducing this to save more.`
        );
      }
    });

    if (user.income > 0 && totalExpenses / user.income > 0.7) {
      suggestions.push(
        "⚠️ Your expenses > 70% of income. Consider strict budgeting."
      );
    }

    // Investment & policy suggestions
    suggestions.push(
      "🏦 Fixed Deposits (FD): SBI ~6.6%, HDFC ~6.5%, ICICI ~6.7% — 1–3 years recommended."
    );
    suggestions.push(
      "🏛 PPF: ~7.1% (tax-free), 15-year tenure — long-term wealth & tax saving (80C)."
    );
    suggestions.push("📄 NSC: ~6.8%, 5-year lock-in, eligible for 80C.");
    suggestions.push(
      "🏦 RBI Floating Rate Bonds: Govt-backed, suitable for conservative investors."
    );
    suggestions.push(
      "📈 SIP / Mutual Funds: Start small via SIPs for long-term growth."
    );
    suggestions.push(
      "🛡 Ensure health and term insurance to protect financial goals."
    );

    return suggestions;
  }

  // Render suggestions in widget
  async function displayAISuggestions() {
    suggestionsList.innerHTML = "<em>Loading suggestions...</em>";
    try {
      const user = await fetchUserDataAuto();
      console.log("AI Widget: user data ->", user);
      const suggestions = generateSuggestions(user);
      suggestionsList.innerHTML = suggestions
        .map((s) => `<div style="margin-bottom:6px;">${s}</div>`)
        .join("");
    } catch (err) {
      console.error("AI Widget: displayAISuggestions error", err);
      suggestionsList.innerHTML = "<em>Failed to load suggestions.</em>";
    }
  }

  // Hook up buttons
  generateBtn.addEventListener("click", () => {
    console.log("AI Widget: Generate clicked");
    displayAISuggestions();
  });

  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => {
      suggestionsList.innerHTML = "<em>Refreshing suggestions...</em>";
      setTimeout(displayAISuggestions, 400);
    });
  }

  toggleBtn.addEventListener("click", () => {
    widgetContainer.style.display =
      widgetContainer.style.display === "block" ? "none" : "block";
  });

  // OPTIONAL: auto-refresh whenever your app updates transactions.
  // If your app emits a custom event when data changes, you can listen to it:
  // document.addEventListener("expensesUpdated", displayAISuggestions);
});
