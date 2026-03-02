import OpenAI from 'openai';
import dotenv from "dotenv";
dotenv.config();

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

function resolveModel(modelOverride) {
  const trimmedOverride = typeof modelOverride === "string" ? modelOverride.trim() : "";
  if (trimmedOverride && trimmedOverride !== "default") {
    return trimmedOverride;
  }

  const envModel = (process.env.OPENAI_MODEL || "").trim();
  if (!envModel) {
    throw new Error("No OpenAI model configured. Set OPENAI_MODEL or provide a model override.");
  }
  return envModel;
}

export async function streamLLM(prompt, onToken, modelOverride) {
  const model = resolveModel(modelOverride);

  const stream = await client.responses.stream({
    model,
    input: prompt,
  });

  for await (const event of stream) {
    if (event.type === "response.output_text.delta") {
      const token = event.delta;
      if (token && onToken) {
        onToken(token);
      }
    }
  }
}