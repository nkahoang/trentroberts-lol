import { Hono } from "hono";
import { streamText } from "hono/streaming";
import { GoogleGenAI } from "@google/genai";
import comfyWorkflow from "./comfy-workflow.json";

const app = new Hono<{ Bindings: Env }>();

const SYSTEM_PROMPT = `You are Trent Roberts. You are in your 40s, Australian, retired, a white male, married, with two children, living in Hawthorn, Australia. You are Head of Experience Design at Howatson+Company. You are a bit of a smart ass. Keep responses concise and conversational — a few sentences at most unless asked for detail. You speak casually with Australian slang sprinkled in naturally. You are witty and slightly irreverent but fundamentally kind.`;

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

// ─── Chat endpoint (Gemini streaming) ───

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

  return streamText(c, async (stream) => {
    for await (const chunk of response) {
      const text = chunk.text;
      if (text) {
        await stream.write(text);
      }
    }
  });
});

// ─── TTS endpoint (ComfyUI VibeVoice) ───

app.post("/api/tts", async (c) => {
  const { text } = await c.req.json<{ text: string }>();

  if (!text || text.trim().length === 0) {
    return c.json({ error: "No text provided" }, 400);
  }

  // 1. Clone workflow and set the text prompt on node 44
  const workflow = JSON.parse(JSON.stringify(comfyWorkflow));
  workflow["44"]["inputs"]["text"] = text;

  console.log(comfyHeaders(c.env))
  // 2. Queue the prompt on ComfyUI
  const queueRes = await fetch(comfyUrl(c.env, "/api/prompt"), {
    method: "POST",
    headers: {
      ...comfyHeaders(c.env),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prompt: workflow }),
  });

  if (!queueRes.ok) {
    const errText = await queueRes.text();
    console.error("ComfyUI queue failed:", queueRes.status, errText);
    return c.json({ error: "Failed to queue ComfyUI prompt", status: queueRes.status, detail: errText.slice(0, 200) }, 502);
  }

  const queueText = await queueRes.text();
  let queueJson: { prompt_id: string };
  try {
    queueJson = JSON.parse(queueText);
  } catch {
    console.error("ComfyUI returned non-JSON:", queueText.slice(0, 300));
    return c.json({ error: "ComfyUI returned invalid response (possibly blocked by CF Access)", detail: queueText.slice(0, 200) }, 502);
  }

  const prompt_id = queueJson.prompt_id;

  // 3. Poll for completion (up to 120s)
  const maxPollTime = 120_000;
  const pollInterval = 1_000;
  const startTime = Date.now();
  let outputData: { filename: string; subfolder: string; type: string } | null =
    null;

  while (Date.now() - startTime < maxPollTime) {
    await sleep(pollInterval);

    const historyRes = await fetch(
      comfyUrl(c.env, `/api/history/${prompt_id}`),
      {
        headers: comfyHeaders(c.env),
      }
    );

    if (!historyRes.ok) continue;

    const historyText = await historyRes.text();
    let history: Record<
      string,
      {
        outputs?: Record<
          string,
          { audio?: Array<{ filename: string; subfolder: string; type: string }> }
        >;
      }
    >;
    try {
      history = JSON.parse(historyText);
    } catch {
      continue; // Not JSON yet (CF Access page or other issue), retry
    }

    const entry = history[prompt_id];
    if (entry?.outputs?.["16"]?.audio?.[0]) {
      outputData = entry.outputs["16"].audio[0];
      break;
    }
  }

  if (!outputData) {
    return c.json({ error: "ComfyUI generation timed out" }, 504);
  }

  // 4. Download the audio file
  const params = new URLSearchParams({
    filename: outputData.filename,
    type: outputData.type,
    subfolder: outputData.subfolder || "",
  });

  const audioRes = await fetch(
    comfyUrl(c.env, `/api/view?${params.toString()}`),
    {
      headers: comfyHeaders(c.env),
    }
  );

  if (!audioRes.ok) {
    return c.json({ error: "Failed to download audio from ComfyUI" }, 502);
  }

  // 5. Return the audio binary
  const audioBlob = await audioRes.arrayBuffer();
  const contentType = audioRes.headers.get("Content-Type") || "audio/flac";

  return new Response(audioBlob, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "no-cache",
    },
  });
});

// ─── Health check ───

app.get("/api/health", (c) => c.json({ status: "ok" }));

export default app;
