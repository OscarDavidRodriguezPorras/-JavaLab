let conversationHistory = [];

(async function main() {
  await initPage("tutor");
  document.getElementById("chat-send-btn").addEventListener("click", sendMessage);
  document.getElementById("chat-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
})();

async function sendMessage() {
  const input = document.getElementById("chat-input");
  const question = input.value.trim();
  if (!question) return;

  appendMessage("student", question);
  input.value = "";
  conversationHistory.push({ role: "user", content: question });

  const typingId = appendMessage("tutor", "Escribiendo…");

  try {
    const result = await api.ai.tutor({ question, conversationHistory: conversationHistory.slice(0, -1) });
    updateMessage(typingId, result.answer);
    conversationHistory.push({ role: "assistant", content: result.answer });
  } catch (err) {
    updateMessage(typingId, `⚠️ ${err.message}`);
  }
}

function appendMessage(role, text) {
  const container = document.getElementById("chat-messages");
  const id = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const div = document.createElement("div");
  div.className = `chat-msg ${role}`;
  div.id = id;
  div.textContent = text;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return id;
}

function updateMessage(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
  const container = document.getElementById("chat-messages");
  container.scrollTop = container.scrollHeight;
}
