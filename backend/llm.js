import OpenAI from "openai";
import dotenv from "dotenv";
dotenv.config();

const openaiClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const openrouterClient = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
});

function resolveRequestedModel(modelOverride) {
  const trimmed = typeof modelOverride === "string" ? modelOverride.trim() : "";

  if (trimmed && trimmed !== "default") return trimmed;

  const fallback = (process.env.OPENAI_MODEL || "").trim();
  if (fallback) return fallback;

  throw new Error("No model configured.");
}

function normalizeModel(modelOverride) {
  const raw = resolveRequestedModel(modelOverride);

  // keep old admin value working
  if (raw === "gemini") {
    return "google/gemini-2.5-flash";
  }

  return raw;
}

function getClientAndModel(modelOverride) {
  const model = normalizeModel(modelOverride);

  if (model.startsWith("google/")) {
    return { client: openrouterClient, model };
  }

  return { client: openaiClient, model };
}

export async function callLLM(messages, modelOverride) {
  const { client, model } = getClientAndModel(modelOverride);

  const response = await client.responses.create({
    model,
    input: messages,
  });

  return response.output_text;
}

export async function streamLLM(prompt, onToken, modelOverride) {
  const { client, model } = getClientAndModel(modelOverride);

  const stream = await client.responses.stream({
    model,
    input: prompt,
  });

  for await (const event of stream) {
    if (event.type === "response.output_text.delta") {
      const token = event.delta;
      if (token && onToken) onToken(token);
    }
  }
}