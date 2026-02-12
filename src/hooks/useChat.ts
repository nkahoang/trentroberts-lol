import { useState, useCallback, useRef } from "react";
import type { ChatMessage, ImageData } from "../types";
import type { ExpressionName } from "./useAvatar";

const LOADING_MESSAGES = [
  "Clearing me throat...",
  "Having a quick flat white first...",
  "Tuning the accent...",
  "Don't be a goose, I'm almost ready...",
  "Only the real ones wait...",
  "Channelling me inner Steve Irwin...",
  "Wrangling the voice box...",
  "Woweee hold on a sec...",
  "Checking if me tshirt's untucked...",
  "Asking Anthony Damiano for help... nah just kidding...",
  "Loading the larynx, no worries...",
  "Grabbing some duck pancakes while you wait...",
];

interface SSEEvent {
  event: string;
  data: string;
}

function parseSSEEvents(raw: string): {
  events: SSEEvent[];
  remainder: string;
} {
  const events: SSEEvent[] = [];
  const parts = raw.split("\n\n");

  // Last part may be incomplete — keep it as remainder
  const remainder = parts.pop() || "";

  for (const part of parts) {
    if (!part.trim()) continue;
    let event = "message";
    let data = "";
    for (const line of part.split("\n")) {
      if (line.startsWith("event:")) {
        event = line.slice(6).trim();
      } else if (line.startsWith("data:")) {
        data = line.slice(5).trimStart();
      }
    }
    events.push({ event, data });
  }

  return { events, remainder };
}

const VALID_EXPRESSIONS: ExpressionName[] = [
  "happy",
  "angry",
  "sad",
  "surprised",
  "smile",
  "hate",
  "fear",
];

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [expression, setExpression] = useState<ExpressionName | undefined>();
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (content: string, imageData?: ImageData) => {
      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content,
        imageData,
      };

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "",
      };

      setMessages((prev) => [...prev, userMessage, assistantMessage]);
      setIsStreaming(true);

      const abortController = new AbortController();
      abortRef.current = abortController;

      let loadingInterval: ReturnType<typeof setInterval> | null = null;

      try {
        const apiMessages = [...messages, userMessage].map((m) => ({
          role: m.role,
          content: m.content,
          ...(m.imageData ? { imageData: m.imageData } : {}),
        }));

        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: apiMessages }),
          signal: abortController.signal,
        });

        if (!response.ok) throw new Error("Chat request failed");
        if (!response.body) throw new Error("No response body");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const { events, remainder } = parseSSEEvents(buffer);
          buffer = remainder;

          for (const evt of events) {
            switch (evt.event) {
              case "text":
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMessage.id
                      ? { ...m, content: m.content + evt.data }
                      : m
                  )
                );
                break;

              case "audio_start": {
                let msgIndex = Math.floor(
                  Math.random() * LOADING_MESSAGES.length
                );
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMessage.id
                      ? {
                          ...m,
                          audioStatus: "generating" as const,
                          loadingMessage: LOADING_MESSAGES[msgIndex],
                        }
                      : m
                  )
                );
                loadingInterval = setInterval(() => {
                  msgIndex = (msgIndex + 1) % LOADING_MESSAGES.length;
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantMessage.id
                        ? { ...m, loadingMessage: LOADING_MESSAGES[msgIndex] }
                        : m
                    )
                  );
                }, 3000);
                break;
              }

              case "audio": {
                if (loadingInterval) {
                  clearInterval(loadingInterval);
                  loadingInterval = null;
                }
                // Decode base64 → Blob → object URL
                const binary = atob(evt.data);
                const bytes = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i++) {
                  bytes[i] = binary.charCodeAt(i);
                }
                const blob = new Blob([bytes], { type: "audio/flac" });
                const audioUrl = URL.createObjectURL(blob);
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMessage.id
                      ? {
                          ...m,
                          audioUrl,
                          audioStatus: "ready" as const,
                          loadingMessage: undefined,
                        }
                      : m
                  )
                );
                break;
              }

              case "audio_error":
                if (loadingInterval) {
                  clearInterval(loadingInterval);
                  loadingInterval = null;
                }
                // Graceful failure — just show text, no error to user
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMessage.id
                      ? {
                          ...m,
                          audioStatus: undefined,
                          loadingMessage: undefined,
                        }
                      : m
                  )
                );
                break;

              case "expression": {
                const expr = evt.data.trim().toLowerCase() as ExpressionName;
                if (VALID_EXPRESSIONS.includes(expr)) {
                  setExpression(expr);
                }
                break;
              }

              case "done":
                break;
            }
          }
        }
      } catch (error) {
        if (loadingInterval) {
          clearInterval(loadingInterval);
          loadingInterval = null;
        }
        if ((error as Error).name !== "AbortError") {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMessage.id
                ? { ...m, content: "Sorry, something went wrong. Try again?" }
                : m
            )
          );
        }
      } finally {
        if (loadingInterval) clearInterval(loadingInterval);
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [messages]
  );

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { messages, isStreaming, expression, sendMessage, stopStreaming };
}
