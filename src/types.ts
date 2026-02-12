export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  audioUrl?: string;
  audioStatus?: "generating" | "ready" | "error";
}
