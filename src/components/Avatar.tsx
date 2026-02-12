import { useEffect } from "react";
import {
  useAvatar,
  EXPRESSIONS,
  type ExpressionName,
} from "../hooks/useAvatar";
import "./Avatar.css";

interface Props {
  expression?: ExpressionName;
  onAvatarReady?: () => void;
  showTestControls?: boolean;
}

export function Avatar({ expression, onAvatarReady, showTestControls }: Props) {
  const { iframeRef, isReady, setExpression } = useAvatar();

  // Apply expression from parent (chat-driven)
  useEffect(() => {
    if (isReady && expression) {
      setExpression(expression);
    }
  }, [isReady, expression, setExpression]);

  // Notify parent when ready
  useEffect(() => {
    if (isReady && onAvatarReady) {
      onAvatarReady();
    }
  }, [isReady, onAvatarReady]);

  return (
    <div className="avatar-container">
      <iframe
        ref={iframeRef}
        src="/mpavatar/index.html"
        title="Trent's Avatar"
        className="avatar-iframe"
        allow="autoplay"
        sandbox="allow-scripts allow-same-origin"
      />
      {showTestControls && isReady && (
        <div className="avatar-test-controls">
          {(Object.keys(EXPRESSIONS) as ExpressionName[]).map((name) => (
            <button
              key={name}
              className="avatar-test-btn"
              onClick={() => setExpression(name)}
            >
              {name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
