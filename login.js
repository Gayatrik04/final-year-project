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
      localStorage.setItem("currentUser", data.userId);
      window.location.href = "dashboard.html"; // redirect to dashboard
    } else {
      errorDiv.innerText = data.message || "Login failed.";
    }

  } catch (err) {
    errorDiv.innerText = "Error connecting to server.";
    console.error(err);
  }
}

  document.addEventListener("DOMContentLoaded", () => {
  const loginPassword = document.getElementById("login-password");
  const toggleloginEye = document.getElementById("toggleEye");

  if (loginPassword && toggleloginEye) {
    toggleloginEye.addEventListener("click", () => {
      const isPassword = loginPassword.type === "password";
      loginPassword.type = isPassword ? "text" : "password";
      toggleloginEye.classList.toggle("fa-eye");
      toggleloginEye.classList.toggle("fa-eye-slash");
    });
  }
});
