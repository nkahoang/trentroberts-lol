import { useState, useRef, useEffect, type FormEvent } from "react";
import { useChat } from "../hooks/useChat";
import { ChatMessage } from "./ChatMessage";
import "./Chat.css";

export function Chat() {
  const { messages, isStreaming, sendMessage, stopStreaming } = useChat();
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // TTS test state
  const [ttsStatus, setTtsStatus] = useState<"idle" | "loading" | "playing" | "error">("idle");
  const [ttsError, setTtsError] = useState<string>("");
  const [ttsAudioUrl, setTtsAudioUrl] = useState<string>("");

  const testTts = async () => {
    setTtsStatus("loading");
    setTtsError("");
    setTtsAudioUrl("");

    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "G'day mate, this is a test of the voice system. How's it going?" }),
      });

      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`${res.status}: ${errBody.slice(0, 300)}`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setTtsAudioUrl(url);
      setTtsStatus("playing");
    } catch (err) {
      setTtsError((err as Error).message);
      setTtsStatus("error");
    }
  };

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
      {/* TTS Test Panel */}
      <div className="chat__tts-test">
        <button
          type="button"
          className="chat__button chat__button--test"
          onClick={testTts}
          disabled={ttsStatus === "loading"}
        >
          {ttsStatus === "loading" ? "⏳ Testing TTS..." : "🔊 Test TTS"}
        </button>
        {ttsStatus === "playing" && ttsAudioUrl && (
          <audio src={ttsAudioUrl} autoPlay controls className="chat__tts-test-audio" />
        )}
        {ttsStatus === "error" && (
          <div className="chat__tts-test-error">{ttsError}</div>
        )}
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
