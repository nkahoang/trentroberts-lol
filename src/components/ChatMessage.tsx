import { useRef, useEffect, useMemo } from "react";
import type { ChatMessage as ChatMessageType } from "../types";

interface Props {
  message: ChatMessageType;
}

export function ChatMessage({ message }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);

  // Create a data URL for user-uploaded images
  const imageUrl = useMemo(() => {
    if (message.imageData) {
      return `data:${message.imageData.mimeType};base64,${message.imageData.base64}`;
    }
    return null;
  }, [message.imageData]);

  // Auto-play when audio arrives
  useEffect(() => {
    if (message.audioUrl && audioRef.current) {
      audioRef.current.play().catch(() => {
        // Browser may block autoplay — that's fine, replay button is there
      });
    }
  }, [message.audioUrl]);

  return (
    <div className={`chat-message chat-message--${message.role}`}>
      <div className="chat-message__content">
        {imageUrl && (
          <img
            src={imageUrl}
            alt="Uploaded"
            className="chat-message__image"
          />
        )}
        <div className="chat-message__bubble">
          {message.content || (
            <span className="chat-message__typing">...</span>
          )}
        </div>
        {message.role === "assistant" &&
          message.audioStatus === "generating" && (
            <div className="chat-message__audio-status">
              <span className="chat-message__audio-status-icon">🎙</span>
              <span>
                {message.loadingMessage || "Warming up the vocal cords..."}
              </span>
            </div>
          )}
        {message.role === "assistant" && message.audioUrl && (
          <div className="chat-message__audio-player">
            <button
              className="chat-message__replay-button"
              onClick={() => audioRef.current?.play()}
              title="Play voice"
            >
              🔊
            </button>
            <audio ref={audioRef} src={message.audioUrl} />
          </div>
        )}
      </div>
    </div>
  );
}
