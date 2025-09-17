let allTransactions = [];
let chartInstance = null;

const currentUser = localStorage.getItem("currentUser");
if (!currentUser) {
  alert("Please login first!");
  window.location.href = "login.html";
}

// On Page Load
document.addEventListener("DOMContentLoaded", () => {
  fetchTransactions();

  // Chart selector event
  document.getElementById("chartSelector").addEventListener("change", (e) => {
    renderChart(e.target.value);
  });

  // Export buttons (you can expand later)
  document
    .getElementById("exportRecentCSV")
    .addEventListener("click", exportRecentCSV);
  document
    .getElementById("exportRecentPDF")
    .addEventListener("click", () => alert("PDF export not yet implemented"));
  document
    .getElementById("exportFullPDF")
    .addEventListener("click", () =>
      alert("Full PDF export not yet implemented")
    );
});

// ========== Fetch Data from Backend ==========
async function fetchTransactions() {
  try {
    const res = await fetch(
      `http://localhost:5000/transactions/${currentUser}`
    );
    allTransactions = await res.json();

    updateSummary(allTransactions);
    renderChart("weekly"); // default chart
    populateTables(allTransactions);
  } catch (err) {
    console.error("Error fetching transactions:", err);
  }
}

// ========== Summary Cards ==========
function updateSummary(transactions) {
  let totalIncome = 0,
    totalExpense = 0;
  const categoryTotals = {};
  const categoryCounts = {};

  transactions.forEach((tx) => {
    const amt = Number(tx.amount);
    if (tx.category === "Income") {
      totalIncome += amt;
    } else {
      totalExpense += amt;
      categoryTotals[tx.category] = (categoryTotals[tx.category] || 0) + amt;
    }
    categoryCounts[tx.category] = (categoryCounts[tx.category] || 0) + 1;
  });

  // Balance
  const balance = totalIncome - totalExpense;

  // Highest Spending Category
  let highestCategory = "-";
  if (Object.keys(categoryTotals).length > 0) {
    highestCategory = Object.entries(categoryTotals).sort(
      (a, b) => b[1] - a[1]
    )[0][0];
  }

  // Most Frequent Category
  let mostFreqCategory = "-";
  if (Object.keys(categoryCounts).length > 0) {
    mostFreqCategory = Object.entries(categoryCounts).sort(
      (a, b) => b[1] - a[1]
    )[0][0];
  }

  // Avg Monthly Spending
  const months = new Set(transactions.map((tx) => tx.date.slice(0, 7))); // YYYY-MM
  const avgMonthlySpending = months.size > 0 ? totalExpense / months.size : 0;

  // Update UI
  document.getElementById("totalIncome").textContent = `₹${totalIncome.toFixed(
    2
  )}`;
  document.getElementById(
    "totalExpense"
  ).textContent = `₹${totalExpense.toFixed(2)}`;
  document.getElementById("balance").textContent = `₹${balance.toFixed(2)}`;
  document.getElementById("highestCategory").textContent = highestCategory;
  document.getElementById("mostFreqCategory").textContent = mostFreqCategory;
  document.getElementById(
    "avgMonthlySpending"
  ).textContent = `₹${avgMonthlySpending.toFixed(2)}`;
}

// ========== Charts ==========
function renderChart(type) {
  const ctx = document.getElementById("dynamicChart").getContext("2d");
  if (chartInstance) chartInstance.destroy();

  let labels = [];
  let data = [];

  if (type === "weekly") {
    const last7Days = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      last7Days[key] = 0;
    }

    allTransactions.forEach((tx) => {
      if (tx.category !== "Income" && last7Days.hasOwnProperty(tx.date)) {
        last7Days[tx.date] += Number(tx.amount);
      }
    });

    labels = Object.keys(last7Days);
    data = Object.values(last7Days);
  } else if (type === "monthly") {
    const monthlyTotals = {};
    allTransactions.forEach((tx) => {
      if (tx.category !== "Income") {
        const month = tx.date.slice(0, 7); // YYYY-MM
        monthlyTotals[month] = (monthlyTotals[month] || 0) + Number(tx.amount);
      }
    });
    labels = Object.keys(monthlyTotals);
    data = Object.values(monthlyTotals);
  } else if (type === "yearly") {
    const yearlyTotals = {};
    allTransactions.forEach((tx) => {
      if (tx.category !== "Income") {
        const year = tx.date.slice(0, 4);
        yearlyTotals[year] = (yearlyTotals[year] || 0) + Number(tx.amount);
      }
    });
    labels = Object.keys(yearlyTotals);
    data = Object.values(yearlyTotals);
  } else if (type === "category") {
    const categoryTotals = {};
    allTransactions.forEach((tx) => {
      if (tx.category !== "Income") {
        categoryTotals[tx.category] =
          (categoryTotals[tx.category] || 0) + Number(tx.amount);
      }
    });
    labels = Object.keys(categoryTotals);
    data = Object.values(categoryTotals);
  }

  chartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Expenses",
          data: data,
          backgroundColor: "#bb86fc",
        },
      ],
    },
    options: {
      plugins: {
        legend: { labels: { color: "#ffffff" } },
      },
      scales: {
        x: { ticks: { color: "#ffffff" } },
        y: { ticks: { color: "#ffffff" } },
      },
    },
  });
}

// ========== Tables ==========
function populateTables(transactions) {
  // Recent Transactions
  const recentTable = document.querySelector("#recentTransactionsTable tbody");
  recentTable.innerHTML = "";
  transactions.slice(0, 5).forEach((tx) => {
    recentTable.innerHTML += `
      <tr>
        <td>${tx.date}</td>
        <td>${tx.category}</td>
        <td>${tx.description}</td>
        <td>${tx.category === "Income" ? "+" : "-"}₹${Number(tx.amount).toFixed(
      2
    )}</td>
      </tr>`;
  });

  // Top 5 Expenses
  const expenses = transactions
    .filter((tx) => tx.category !== "Income")
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);
  const expenseTable = document.querySelector("#topExpensesTable tbody");
  expenseTable.innerHTML = "";
  expenses.forEach((tx) => {
    expenseTable.innerHTML += `<tr><td>${tx.category}</td><td>₹${tx.amount}</td></tr>`;
  });

  // Top 5 Incomes
  const incomes = transactions
    .filter((tx) => tx.category === "Income")
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);
  const incomeTable = document.querySelector("#topIncomesTable tbody");
  incomeTable.innerHTML = "";
  incomes.forEach((tx) => {
    incomeTable.innerHTML += `<tr><td>${tx.category}</td><td>₹${tx.amount}</td></tr>`;
  });
}

// ========== Export Recent CSV ==========
function exportRecentCSV() {
  let csv = "Date,Category,Description,Amount\n";
  allTransactions.slice(0, 5).forEach((tx) => {
    csv += `${tx.date},${tx.category},${tx.description},${tx.amount}\n`;
  });

  const blob = new Blob([csv], { type: "text/csv" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "recent_transactions.csv";
  link.click();
}

/*logout*/
document.getElementById("logoutBtn").addEventListener("click", () => {
  localStorage.removeItem("currentUser");
  window.location.href = "login.html";
});
