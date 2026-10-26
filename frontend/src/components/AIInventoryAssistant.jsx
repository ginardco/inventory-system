
import { useState } from "react";
import "./AIInventoryAssistant.css";

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000";

const suggestions = [
  "Which parts need restocking?",
  "Show me out-of-stock products.",
  "Summarize my inventory.",
  "Analyze my recent sales.",
];

export default function AIInventoryAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      text: "Welcome to MotoAssist! Ask me about your spare parts, stock levels, or recorded sales.",
    },
  ]);
  const [loading, setLoading] = useState(false);

  async function sendQuestion(customQuestion) {
    const text = (customQuestion ?? question).trim();

    if (!text || loading) return;

    setMessages((previous) => [
      ...previous,
      { role: "user", text },
    ]);
    setQuestion("");
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/ai/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ question: text }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to get an AI response.");
      }

      setMessages((previous) => [
        ...previous,
        { role: "assistant", text: data.answer },
      ]);
    } catch (error) {
      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          text: `Sorry, I couldn't answer that. ${error.message}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    sendQuestion();
  }

  return (
    <div className="moto-ai">
      {isOpen && (
        <section
          className="moto-ai-panel"
          aria-label="MotoAssist AI chat"
        >
          <header className="moto-ai-header">
            <div className="moto-ai-brand">
              <div className="moto-ai-logo">M</div>
              <div>
                <strong>MOTOASSIST</strong>
                <span>AI INVENTORY ASSISTANT</span>
              </div>
            </div>

            <button
              type="button"
              className="moto-ai-close"
              onClick={() => setIsOpen(false)}
              aria-label="Close AI assistant"
            >
              ×
            </button>
          </header>

          <div className="moto-ai-messages" aria-live="polite">
            {messages.map((message, index) => (
              <div
                className={`moto-ai-message ${message.role}`}
                key={`${message.role}-${index}`}
              >
                <span className="moto-ai-role">
                  {message.role === "assistant" ? "MOTOASSIST" : "YOU"}
                </span>
                <p>{message.text}</p>
              </div>
            ))}

            {loading && (
              <div className="moto-ai-message assistant">
                <span className="moto-ai-role">MOTOASSIST</span>
                <p className="moto-ai-loading">Analyzing your shop data...</p>
              </div>
            )}
          </div>

          {messages.length === 1 && (
            <div className="moto-ai-suggestions">
              <span>TRY ASKING</span>
              {suggestions.map((suggestion) => (
                <button
                  type="button"
                  key={suggestion}
                  disabled={loading}
                  onClick={() => sendQuestion(suggestion)}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}

          <form className="moto-ai-form" onSubmit={handleSubmit}>
            <input
              type="text"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Ask about your inventory..."
              maxLength={1000}
              aria-label="Ask MotoAssist a question"
              disabled={loading}
            />

            <button
              type="submit"
              disabled={loading || !question.trim()}
              aria-label="Send message"
            >
              {loading ? "..." : "➤"}
            </button>
          </form>

          <div className="moto-ai-disclaimer">
            AI responses may be inaccurate. Verify important decisions.
          </div>
        </section>
      )}

      <button
        type="button"
        className="moto-ai-toggle"
        onClick={() => setIsOpen((previous) => !previous)}
        aria-label={isOpen ? "Close AI assistant" : "Open AI assistant"}
      >
        <span className="moto-ai-toggle-icon">
          {isOpen ? "×" : "✦"}
        </span>
        <span>{isOpen ? "CLOSE ASSISTANT" : "ASK MOTOASSIST"}</span>
      </button>
    </div>
  );
}
