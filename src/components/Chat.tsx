import { useState, useRef, useEffect, type FormEvent } from "react";
import { useChat } from "../hooks/useChat";
import { ChatMessage } from "./ChatMessage";
import "./Chat.css";

export function Chat() {
  const { messages, isStreaming, sendMessage, stopStreaming } = useChat();
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;
    setInput("");
    sendMessage(trimmed);
  };

  return (
    <div className="chat">
      <div className="chat__messages">
        {messages.length === 0 && (
          <div className="chat__empty">
            <p>G'day! Ask me anything.</p>
          </div>
        )}
        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}
        <div ref={messagesEndRef} />
      </div>
      <form className="chat__input-form" onSubmit={handleSubmit}>
        <input
          type="text"
          className="chat__input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          disabled={isStreaming}
          autoFocus
        />
        {isStreaming ? (
          <button
            type="button"
            className="chat__button chat__button--stop"
            onClick={stopStreaming}
          >
            Stop
          </button>
        ) : (
          <button
            type="submit"
            className="chat__button"
            disabled={!input.trim()}
          >
            Send
          </button>
        )}
      </form>
    </div>
  );
}
