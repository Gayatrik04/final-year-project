const chatbotWidget = document.getElementById("chatbot-widget");
const chatbotMessages = document.getElementById("chatbot-messages");
const chatbotInput = document.getElementById("chatbot-input");
const chatbotSend = document.getElementById("chatbot-send");

function addMessage(sender, text) {
  const msg = document.createElement("div");
  msg.className = sender;
  msg.textContent = text;
  chatbotMessages.appendChild(msg);
  chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
}

chatbotSend.addEventListener("click", async () => {
  const message = chatbotInput.value.trim();
  if (!message) return;

  addMessage("user", "👤 " + message);
  chatbotInput.value = "";

  const thinkingMessage = "⏳ Thinking...";
  addMessage("bot", thinkingMessage);

  try {
    const res = await fetch("http://localhost:5000/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });

    const data = await res.json();

    if (res.ok) {
      chatbotMessages.lastChild.textContent =
        "🤖 " + (data.reply || "No response");
    } else {
      chatbotMessages.lastChild.textContent = `⚠️ Error: ${
        data.details || "No response from AI"
      }`;
    }
  } catch (error) {
    chatbotMessages.lastChild.textContent = `⚠️ Network Error: ${error.message}`;
  }
});
