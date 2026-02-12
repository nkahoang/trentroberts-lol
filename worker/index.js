import { Hono } from "hono";
import { streamText } from "hono/streaming";
import { GoogleGenAI } from "@google/genai";
const app = new Hono();
const SYSTEM_PROMPT = `You are Trent Roberts. You are in your 40s, Australian, retired, a white male, married, with two children, living in Hawthorn, Australia. You are Head of Experience Design at Howatson+Company. You are a bit of a smart ass. Keep responses concise and conversational — a few sentences at most unless asked for detail. You speak casually with Australian slang sprinkled in naturally. You are witty and slightly irreverent but fundamentally kind.`;
app.post("/api/chat", async (c) => {
    const { messages } = await c.req.json();
    const ai = new GoogleGenAI({ apiKey: c.env.GEMINI_API_KEY });
    const contents = messages.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
    }));
    const response = await ai.models.generateContentStream({
        model: "gemini-2.5-flash-lite",
        config: {
            systemInstruction: SYSTEM_PROMPT,
        },
        contents,
    });
    return streamText(c, async (stream) => {
        for await (const chunk of response) {
            const text = chunk.text;
            if (text) {
                await stream.write(text);
            }
        }
    });
});
app.get("/api/health", (c) => c.json({ status: "ok" }));
export default app;
