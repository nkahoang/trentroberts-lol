import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { GoogleGenAI } from "@google/genai";
import comfyWorkflow from "./comfy-workflow.json";

const app = new Hono<{ Bindings: Env }>();

const SYSTEM_PROMPT = `You are Trent Roberts. You are in your 40s, Australian, a white male, married, with two children, living in Hawthorn, Australia. You are Head of Experience Design at Howatson+Company.

## Communication Style
You speak in short, direct sentences. You are never overly formal or flowery. Keep responses to a few sentences at most unless asked for detail. If something is funny, you might react with a dry "Hahahah" or a sarcastic comment. You are sarcastic and self-deprecating. You enjoy a bit of dark humour. You have strong opinions on small things and aren't afraid to voice them. You are critical — if something is ugly or stupid, say so efficiently.

## Language & Quirks
- Australian slang: "goose", "woweee", "don't be a goose", "cosy"
- Always use Australian spelling (e.g. "cosy" not "cozy", "colour" not "color", "humour" not "humor")
- Use emojis for emphasis: 👏👏👏👏 between words or as a standalone line instead of shouting
- Use 🎣 when you're baiting someone or being deliberately provocative
- Sometimes respond with a single word or name as a correction or question. e.g. "Brad." or "Calvary?"
- Gatekeeping: use "Only the real ones know" to dismiss people who aren't in on the joke
- "In-crowd" mentality — you value shared context and inside knowledge. If someone doesn't get it, you're not going to explain it

## Memories & Lore
- The "Tuck" Rule: You firmly believe one should never tuck a t-shirt in. Non-negotiable fashion stance.
- Food: Your ultimate food recommendation is "Duck pancakes. Lots of them."
- Parenting: You're a dad who regularly takes the kids to "Rocket Park."
- The Anthony Incident: You know that Anthony Damiano was the one responsible for that thing. Context is irrelevant, the fact is it was Anthony.
- You enjoy messing around with AI image generators like Midjourney
- Zero tolerance for spammers

## Example Tone
- Asked what to eat → "Duck pancakes. Lots of them."
- Asked who broke something → "Apparently it was Anthony Damiano."
- Told to stop messing around → "don't be a goose."
- Asked about a design → "its cosy"
- Someone doesn't get a reference → "Only the real ones know."
- Making a strong point → "👏👏👏👏"
- Baiting someone → "🎣"
- Told to dress up → "I would never tuck a tshirt in."
`;

// ─── ComfyUI helpers ───

function comfyHeaders(env: Env): Record<string, string> {
  return {
    "CF-Access-Client-Id": env.CF_ACCESS_CLIENT_ID,
    "CF-Access-Client-Secret": env.CF_ACCESS_CLIENT_SECRET,
  };
}

function comfyUrl(env: Env, path: string): string {
  const base = env.COMFYUI_URL.replace(/\/+$/, "");
  return `${base}${path}`;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// ─── Expression classification ───

const VALID_EXPRESSIONS = [
  "happy",
  "angry",
  "sad",
  "surprised",
  "smile",
  "hate",
  "fear",
] as const;

type Expression = (typeof VALID_EXPRESSIONS)[number];

async function classifyExpression(
  text: string,
  ai: InstanceType<typeof GoogleGenAI>
): Promise<Expression> {
  try {
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash-lite",
      config: {
        systemInstruction: `You are an emotion classifier. Given a message, respond with ONLY one of these exact words: happy, angry, sad, surprised, smile, hate, fear.

Pick the emotion that best matches the tone:
- "smile" = default/neutral/friendly/casual/sarcastic
- "happy" = genuinely excited or enthusiastic
- "angry" = annoyed, frustrated, or ranting
- "sad" = melancholic or sympathetic
- "surprised" = shocked or taken aback
- "hate" = strong disgust or contempt
- "fear" = worried or anxious

Respond with ONLY the single word, nothing else.`,
      },
      contents: [
        {
          role: "user",
          parts: [
            { text: `Classify the emotion:\n\n${text.slice(0, 500)}` },
          ],
        },
      ],
    });

    const raw = (result.text ?? "").trim().toLowerCase();
    const match = VALID_EXPRESSIONS.find((e) => raw.includes(e));
    return match ?? "smile";
  } catch (err) {
    console.error("Expression classification failed:", err);
    return "smile";
  }
}

// ─── TTS helpers ───

const EXPRESSION_SPEED: Record<Expression, number> = {
  happy: 1.15,
  smile: 1.1,
  surprised: 1.05,
  angry: 0.95,
  sad: 0.85,
  hate: 0.9,
  fear: 0.95,
};

function sanitiseTextForTts(text: string): string {
  return (
    text
      // Strip emoji (Unicode emoji ranges)
      .replace(
        /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu,
        ""
      )
      // Strip remaining special chars (keep letters, numbers, basic punctuation, spaces)
      .replace(/[^\w\s.,!?;:'"()\-–—]/g, "")
      // Collapse multiple spaces
      .replace(/\s{2,}/g, " ")
      .trim()
  );
}

// ─── Internal TTS generation (no public endpoint) ───

async function generateTtsAudio(
  text: string,
  env: Env,
  expression: Expression = "smile"
): Promise<ArrayBuffer | null> {
  try {
    const cleanText = sanitiseTextForTts(text);
    if (!cleanText || cleanText.length === 0) return null;

    // 1. Clone workflow, set text, randomise seed, adjust speed by expression
    const workflow = JSON.parse(JSON.stringify(comfyWorkflow));
    workflow["44"]["inputs"]["text"] = cleanText;
    // workflow["44"]["inputs"]["seed"] = Math.floor(Math.random() * 2147483647);
    workflow["44"]["inputs"]["voice_speed_factor"] =
      EXPRESSION_SPEED[expression] ?? 1.05;

    // 2. Queue the prompt on ComfyUI
    const queueRes = await fetch(comfyUrl(env, "/api/prompt"), {
      method: "POST",
      headers: {
        ...comfyHeaders(env),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt: workflow }),
    });

    if (!queueRes.ok) {
      console.error("ComfyUI queue failed:", queueRes.status);
      return null;
    }

    const queueText = await queueRes.text();
    let queueJson: { prompt_id: string };
    try {
      queueJson = JSON.parse(queueText);
    } catch {
      console.error("ComfyUI returned non-JSON:", queueText.slice(0, 300));
      return null;
    }

    const prompt_id = queueJson.prompt_id;

    // 3. Poll for completion (up to 120s)
    const maxPollTime = 120_000;
    const pollInterval = 1_000;
    const startTime = Date.now();
    let outputData: {
      filename: string;
      subfolder: string;
      type: string;
    } | null = null;

    while (Date.now() - startTime < maxPollTime) {
      await sleep(pollInterval);

      const historyRes = await fetch(
        comfyUrl(env, `/api/history/${prompt_id}`),
        { headers: comfyHeaders(env) }
      );

      if (!historyRes.ok) continue;

      const historyText = await historyRes.text();
      let history: Record<
        string,
        {
          outputs?: Record<
            string,
            {
              audio?: Array<{
                filename: string;
                subfolder: string;
                type: string;
              }>;
            }
          >;
        }
      >;
      try {
        history = JSON.parse(historyText);
      } catch {
        continue;
      }

      const entry = history[prompt_id];
      if (entry?.outputs?.["16"]?.audio?.[0]) {
        outputData = entry.outputs["16"].audio[0];
        break;
      }
    }

    if (!outputData) return null;

    // 4. Download the audio file
    const params = new URLSearchParams({
      filename: outputData.filename,
      type: outputData.type,
      subfolder: outputData.subfolder || "",
    });

    const audioRes = await fetch(
      comfyUrl(env, `/api/view?${params.toString()}`),
      { headers: comfyHeaders(env) }
    );

    if (!audioRes.ok) return null;

    return await audioRes.arrayBuffer();
  } catch (err) {
    console.error("TTS generation failed:", err);
    return null;
  }
}

// ─── Chat endpoint (Gemini streaming + inline TTS) ───

app.post("/api/chat", async (c) => {
  const { messages } = await c.req.json<{
    messages: Array<{ role: string; content: string }>;
  }>();

  const ai = new GoogleGenAI({ apiKey: c.env.GOOGLE_API_KEY });

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

  return streamSSE(c, async (stream) => {
    // Phase 1: Stream text from Gemini
    let fullText = "";
    for await (const chunk of response) {
      const text = chunk.text;
      if (text) {
        fullText += text;
        await stream.writeSSE({ event: "text", data: text });
      }
    }

    // Phase 2: Classify expression, then generate TTS audio with expression-based speed
    if (fullText.trim()) {
      // Classify expression first (fast call) — needed for TTS speed
      const expression = await classifyExpression(fullText, ai);
      await stream.writeSSE({ event: "expression", data: expression });

      await stream.writeSSE({ event: "audio_start", data: "" });

      try {
        const audioBuffer = await generateTtsAudio(
          fullText,
          c.env,
          expression
        );
        if (audioBuffer) {
          const base64 = arrayBufferToBase64(audioBuffer);
          await stream.writeSSE({ event: "audio", data: base64 });
        } else {
          await stream.writeSSE({ event: "audio_error", data: "" });
        }
      } catch {
        await stream.writeSSE({ event: "audio_error", data: "" });
      }
    }

    await stream.writeSSE({ event: "done", data: "" });
  });
});

// ─── Health check ───

app.get("/api/health", (c) => c.json({ status: "ok" }));

export default app;
