import { useRef, useEffect, useState, useCallback } from "react";

export const EXPRESSIONS = {
  happy: 0,
  angry: 1,
  sad: 2,
  surprised: 3,
  smile: 4,
  hate: 5,
  fear: 6,
} as const;

export type ExpressionName = keyof typeof EXPRESSIONS;

export function useAvatar() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "avatar-ready") {
        setIsReady(true);
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const setExpression = useCallback(
    (expression: ExpressionName) => {
      const index = EXPRESSIONS[expression];
      if (index === undefined) return;
      iframeRef.current?.contentWindow?.postMessage(
        { type: "expression", index },
        "*"
      );
    },
    []
  );

  return { iframeRef, isReady, setExpression };
}
