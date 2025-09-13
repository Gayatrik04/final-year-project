const fromCurrency = document.getElementById("from-currency");
const toCurrency = document.getElementById("to-currency");
const amount = document.getElementById("amount");
const result = document.getElementById("result");
const convertBtn = document.getElementById("convert");


async function loadCurrencies() {
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD");
    const data = await res.json();

    const currencies = Object.keys(data.rates);

    currencies.forEach(code => {
      const option1 = new Option(code, code);
      const option2 = new Option(code, code);
      fromCurrency.add(option1);
      toCurrency.add(option2);
    });

    fromCurrency.value = "USD";
    toCurrency.value = "INR";
  } catch (err) {
    result.textContent = "Failed to load currencies (check internet).";
  }
}


async function convertCurrency() {
  const amt = parseFloat(amount.value);
  if (isNaN(amt) || amt <= 0) {
    result.textContent = "Please enter a valid amount.";
    return;
  }

  const from = fromCurrency.value;
  const to = toCurrency.value;

  try {
    const res = await fetch(`https://open.er-api.com/v6/latest/${from}`);
    const data = await res.json();
    const rate = data.rates[to];

    if (rate) {
      const converted = amt * rate;
      result.textContent = `${amt} ${from} = ${converted.toFixed(2)} ${to}`;
    } else {
      result.textContent = "Conversion not available.";
    }
  } catch (err) {
    result.textContent = "Conversion failed. Try again.";
  }
}

convertBtn.addEventListener("click", convertCurrency);
loadCurrencies();

/*logout*/
document.getElementById("logoutBtn").addEventListener("click", () => {
  localStorage.removeItem("currentUser");
  window.location.href = "login.html";
});

