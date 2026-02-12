import {
  useState,
  useRef,
  useEffect,
  useMemo,
  type FormEvent,
  type ChangeEvent,
} from "react";
import { ChatMessage } from "./ChatMessage";
import type { ChatMessage as ChatMessageType, ImageData } from "../types";
import "./Chat.css";

const GREETINGS = [
  "G'day! Ask me anything.",
  "Woweee, a visitor. What's on your mind?",
  "Don't be a goose — say something.",
  "Only the real ones start a conversation.",
  "Yeah nah, go on then. Ask away.",
  "Alright, I'm here. Make it good.",
  "Duck pancakes aren't gonna order themselves. Chat?",
  "Pull up a chair, mate.",
  "I'd untuck my tshirt but it already is. What do you want?",
  "Apparently it was Anthony Damiano. Anyway, what's up?",
  "Welcome to the cosy corner. Fire away.",
  "Right. Let's hear it.",
];

const ALL_SUGGESTIONS = [
  "What should I get for lunch?",
  "Who broke the build?",
  "Should I tuck my shirt in?",
  "What's Rocket Park like?",
  "Roast my design portfolio",
  "What's your take on AI?",
  "Give me fashion advice",
  "What makes a good UX?",
  "Tell me about your kids",
  "What's living in Hawthorn like?",
  "Rate my outfit idea",
  "Who is Anthony Damiano?",
  "What's the best flat white in Melbourne?",
  "Give me a Midjourney prompt",
  "What do you think of crypto?",
  "How do I deal with spammers?",
  "Describe your perfect weekend",
  "What's wrong with modern design?",
  "Convince me to move to Australia",
];

function pickRandom<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

interface Props {
  messages: ChatMessageType[];
  isStreaming: boolean;
  sendMessage: (content: string, imageData?: ImageData) => void;
  stopStreaming: () => void;
}

export function Chat({
  messages,
  isStreaming,
  sendMessage,
  stopStreaming,
}: Props) {
  const [input, setInput] = useState("");
  const [pendingImage, setPendingImage] = useState<ImageData | null>(null);
  const [pendingImagePreview, setPendingImagePreview] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const greeting = useMemo(
    () => GREETINGS[Math.floor(Math.random() * GREETINGS.length)],
    []
  );
  const suggestions = useMemo(() => pickRandom(ALL_SUGGESTIONS, 4), []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleImageSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Preview URL
    const previewUrl = URL.createObjectURL(file);
    setPendingImagePreview(previewUrl);

    // Read as base64
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip data URL prefix: "data:image/png;base64,..."
      const base64 = result.split(",")[1];
      setPendingImage({ base64, mimeType: file.type });
    };
    reader.readAsDataURL(file);

    // Reset file input so same file can be re-selected
    e.target.value = "";
  };

  const clearPendingImage = () => {
    if (pendingImagePreview) URL.revokeObjectURL(pendingImagePreview);
    setPendingImage(null);
    setPendingImagePreview("");
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if ((!trimmed && !pendingImage) || isStreaming) return;
    setInput("");
    sendMessage(trimmed || "What do you think of this?", pendingImage ?? undefined);
    clearPendingImage();
  };

  const handleSuggestion = (text: string) => {
    if (isStreaming) return;
    sendMessage(text);
  };

  return (
    <div className="chat">
      <div className="chat__messages">
        {messages.length === 0 && (
          <div className="chat__empty">
            <p className="chat__greeting">{greeting}</p>
            <div className="chat__suggestions">
              {suggestions.map((s) => (
                <button
                  key={s}
                  className="chat__suggestion"
                  onClick={() => handleSuggestion(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Image preview */}
      {pendingImagePreview && (
        <div className="chat__image-preview">
          <img
            src={pendingImagePreview}
            alt="Upload preview"
            className="chat__image-preview-img"
          />
          <button
            className="chat__image-preview-remove"
            onClick={clearPendingImage}
            title="Remove image"
          >
            ✕
          </button>
        </div>
      )}

      <form className="chat__input-form" onSubmit={handleSubmit}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/heic,image/heif"
          className="chat__file-input"
          onChange={handleImageSelect}
        />
        <button
          type="button"
          className="chat__upload-button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isStreaming}
          title="Upload image"
        >
          📎
        </button>
        <input
          type="text"
          className="chat__input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            pendingImage ? "Ask Trent about this image..." : "Say something to Trent..."
          }
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
              disabled={!input.trim() && !pendingImage}
          >
            Send
          </button>
        )}
      </form>
    </div>
  );
}
