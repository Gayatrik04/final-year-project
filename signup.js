function validateEmail(email) {
    return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
  }

  function validatePassword(password) {
    return (
      /.{8,}/.test(password) &&
      /[A-Z]/.test(password) &&
      /[a-z]/.test(password) &&
      /[0-9]/.test(password) &&
      /[!@#$%^&*]/.test(password)
    );
  }

  async function handleSignup() {
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value.trim();
    const errorDiv = document.getElementById('signup-error');

    if (!validateEmail(email)) {
      errorDiv.innerText = "Enter a valid email.";
      return;
    }

    if (!validatePassword(password)) {
      errorDiv.innerText = "Password must be 8+ chars with upper, lower, number & symbol.";
      return;
    }

    try {
      const response = await fetch("http://127.0.0.1:5000/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (response.ok) {
        alert(data.message); // "User registered successfully!"
        localStorage.setItem("currentUser", data.userId);
      window.location.href = "dashboard.html"; // redirect to dashboard
    } else {
      errorDiv.innerText = data.message || "Signup failed.";
    }

  } catch (err) {
    errorDiv.innerText = "Error connecting to server.";
    console.error(err);
  }
}
        

  document.addEventListener("DOMContentLoaded", () => {
  const signupPassword = document.getElementById("signup-password");
  const toggleSignupEye = document.getElementById("toggleEye");

  if (signupPassword && toggleSignupEye) {
    toggleSignupEye.addEventListener("click", () => {
      const isPassword = signupPassword.type === "password";
      signupPassword.type = isPassword ? "text" : "password";
      toggleSignupEye.classList.toggle("fa-eye");
      toggleSignupEye.classList.toggle("fa-eye-slash");
    });
  }
});

