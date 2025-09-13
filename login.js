async function handleLogin() {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value.trim();
    const errorDiv = document.getElementById('login-error');

    if (!email || !password) {
      errorDiv.innerText = "Please enter both email and password.";
      return;
    }

    try {
      const response = await fetch("http://127.0.0.1:5000/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (response.ok) {
        alert("Login successful!");
        localStorage.setItem("currentUser", data.userId);
        window.location.href = "expensetracker.html"; // ✅ redirect
      } else {
        errorDiv.innerText = data.message || "Invalid email or password.";
      }
    } catch (err) {
      console.error("Error:", err);
      errorDiv.innerText = "Server error. Please try again later.";
    }
  }