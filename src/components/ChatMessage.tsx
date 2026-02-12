import type { ChatMessage as ChatMessageType } from "../types";

interface Props {
  message: ChatMessageType;
}

export function ChatMessage({ message }: Props) {
  return (
    <div className={`chat-message chat-message--${message.role}`}>
      <div className="chat-message__content">
        <div className="chat-message__bubble">
          {message.content || (
            <span className="chat-message__typing">...</span>
          )}
        </div>
        {message.role === "assistant" &&
          message.audioStatus === "generating" && (
            <div className="chat-message__audio-status">
              Generating voice...
            </div>
          )}
        {message.role === "assistant" && message.audioUrl && (
          <audio
            src={message.audioUrl}
            autoPlay
            controls
            className="chat-message__audio"
          />
        )}
      </div>
    </div>
  );
}
