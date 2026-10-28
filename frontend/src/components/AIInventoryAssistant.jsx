
import { useState, useEffect, useRef } from "react";

import "./AIInventoryAssistant.css";

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000";

export default function AIInventoryAssistant() {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      text: "Hi! I'm MotoAssist. Ask me about your inventory or low-stock products.",
    },
  ]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(true);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Automatically scroll to the latest message.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [messages, loading]);

  async function sendMessage(text = message) {
    const question = text.trim();

    if (!question || loading) return;

    setMessages((previous) => [
      ...previous,
      { role: "user", text: question },
    ]);

    setMessage("");
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/ai/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: question }),
      });

      const data = await response.json();

      if (!response.ok || data.success === false) {
        throw new Error(
          data.reply ||
            data.error ||
            "AI request failed."
        );
      }

      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          text:
            data.reply ||
            data.answer ||
            "No response received.",
        },
      ]);
    } catch (error) {
      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          text: `Sorry, ${
            error.message || "Something went wrong."
          } Please check the backend and try again.`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  const suggestions = [
    "Which products need restocking?",
    "Summarize our inventory.",
    "Which products are out of stock?",
  ];

  return (
    <section className="moto-ai">
      {isOpen && (
        <div
          className="moto-ai-panel"
          role="dialog"
          aria-label="MotoAssist AI chat"
        >
          {/* Chat Header */}
          <div className="moto-ai-header">
            <div className="moto-ai-brand">
              <div className="moto-ai-logo">
                M
              </div>

              <div>
                <strong>MotoAssist AI</strong>
                <span>● Online</span>
              </div>
            </div>

            <button
              type="button"
              className="moto-ai-close"
              onClick={() => setIsOpen(false)}
              aria-label="Close chat"
              title="Close chat"
            >
              ×
            </button>
          </div>

          {/* Chat Messages */}
          <div
            className="moto-ai-messages"
            aria-live="polite"
            aria-relevant="additions text"
          >
            {messages.map((item, index) => (
              <div
                key={index}
                className={`moto-ai-message ${item.role}`}
              >
                <strong className="moto-ai-role">
                  {item.role === "user"
                    ? "You"
                    : "MotoAssist"}
                </strong>

                <p>{item.text}</p>
              </div>
            ))}

            {loading && (
              <div
                className="moto-ai-message assistant"
                role="status"
              >
                <strong className="moto-ai-role">
                  MotoAssist
                </strong>

                <p className="moto-ai-loading">
                  MotoAssist is typing...
                </p>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Suggested Questions */}
          <div className="moto-ai-suggestions">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                disabled={loading}
                onClick={() => sendMessage(suggestion)}
              >
                {suggestion}
              </button>
            ))}
          </div>

          {/* Message Input */}
          <form
            className="moto-ai-form"
            onSubmit={(event) => {
              event.preventDefault();
              sendMessage();
            }}
          >
            <input
              ref={inputRef}
              type="text"
              value={message}
              onChange={(event) =>
                setMessage(event.target.value)
              }
              placeholder="Ask about your inventory..."
              aria-label="Ask MotoAssist"
              maxLength={2000}
              disabled={loading}
            />

            <button
              type="submit"
              disabled={loading || !message.trim()}
              aria-label="Send message"
              title="Send message"
            >
              {loading ? "…" : "➤"}
            </button>
          </form>

          {/* Disclaimer */}
          <div className="moto-ai-disclaimer">
            MotoAssist AI · MotorParts Inventory Assistant
          </div>
        </div>
      )}

      {/* Floating Chat Button */}
      {!isOpen && (
        <button
          type="button"
          className="moto-ai-toggle"
          onClick={() => {
            setIsOpen(true);
            setTimeout(() => {
              inputRef.current?.focus();
            }, 0);
          }}
        >
          <span className="moto-ai-toggle-icon">
            💬
          </span>

          MotoAssist AI
        </button>
      )}
    </section>
  );
}
