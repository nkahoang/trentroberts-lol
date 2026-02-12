export interface ImageData {
  base64: string;
  mimeType: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  imageData?: ImageData;
  audioUrl?: string;
  audioStatus?: "generating" | "ready" | "error";
  loadingMessage?: string;
}
