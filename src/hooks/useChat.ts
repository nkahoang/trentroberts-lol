import { useState, useCallback, useRef } from "react";
import type { ChatMessage } from "../types";

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const generateAudio = useCallback(
    async (messageId: string, text: string) => {
      // Mark as generating
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId ? { ...m, audioStatus: "generating" as const } : m
        )
      );

      try {
        const response = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });

        if (!response.ok) throw new Error("TTS request failed");

        const blob = await response.blob();
        const audioUrl = URL.createObjectURL(blob);

        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? { ...m, audioUrl, audioStatus: "ready" as const }
              : m
          )
        );
      } catch {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? { ...m, audioStatus: "error" as const }
              : m
          )
        );
      }
    },
    []
  );

  const sendMessage = useCallback(
    async (content: string) => {
      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content,
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

      let fullText = "";
      let wasAborted = false;

      try {
        const apiMessages = [...messages, userMessage].map((m) => ({
          role: m.role,
          content: m.content,
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

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const text = decoder.decode(value, { stream: true });
          fullText += text;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMessage.id
                ? { ...m, content: m.content + text }
                : m
            )
          );
        }
      } catch (error) {
        if ((error as Error).name === "AbortError") {
          wasAborted = true;
        } else {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMessage.id
                ? { ...m, content: "Sorry, something went wrong. Try again?" }
                : m
            )
          );
        }
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }

      // Generate audio only for complete (non-aborted) responses
      if (fullText.trim() && !wasAborted) {
        generateAudio(assistantMessage.id, fullText);
      }
    },
    [messages, generateAudio]
  );

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { messages, isStreaming, sendMessage, stopStreaming };
}
