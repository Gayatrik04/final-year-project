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
        window.location.href = "login.html";
      } else {
        errorDiv.innerText = data.message || "signup failed.";
      }
    } catch (err) {
      errorDiv.innerText = "Error connecting to server.";
      console.error(err);
    }
  }