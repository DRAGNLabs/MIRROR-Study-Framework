import OpenAI from "openai";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
dotenv.config();

// --- Temporary token-usage logging for pricing estimation ---
// Set LOG_TOKEN_USAGE=true in .env to append every LLM call's token usage to
// a CSV. Leave it unset/false for normal runs; this is meant to be removed
// (or just left off) once pricing numbers are collected.
const TOKEN_LOG_ENABLED = (process.env.LOG_TOKEN_USAGE || "").trim() === "true";
const TOKEN_LOG_PATH = path.join(process.cwd(), process.env.TOKEN_LOG_FILE || "token-usage.csv");
const TOKEN_LOG_HEADER = "timestamp,roomCode,round,callType,model,inputTokens,outputTokens,totalTokens,rawUsage\n";

function logTokenUsage({ roomCode, round, callType, model, usage }) {
  if (!TOKEN_LOG_ENABLED) return;
  try {
    if (!fs.existsSync(TOKEN_LOG_PATH)) {
      fs.writeFileSync(TOKEN_LOG_PATH, TOKEN_LOG_HEADER);
    }
    // OpenRouter/OpenAI have used a couple different field names across API
    // shapes (Responses API vs. Chat Completions), so check both and fall
    // back to the raw object (quoted JSON) if neither matches.
    const inputTokens = usage?.input_tokens ?? usage?.prompt_tokens ?? "";
    const outputTokens = usage?.output_tokens ?? usage?.completion_tokens ?? "";
    const totalTokens = usage?.total_tokens ?? "";
    const rawUsage = usage ? JSON.stringify(usage).replaceAll('"', '""') : "";
    const row = [
      new Date().toISOString(),
      roomCode ?? "",
      round ?? "",
      callType ?? "",
      model ?? "",
      inputTokens,
      outputTokens,
      totalTokens,
      `"${rawUsage}"`,
    ].join(",") + "\n";
    fs.appendFileSync(TOKEN_LOG_PATH, row);
  } catch (err) {
    console.error("Failed to log token usage:", err);
  }
}

const client = new OpenAI({
  apiKey: process.env.OPEN_ROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
});

const openrouterClient = new OpenAI({
  apiKey: process.env.OPEN_ROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
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

export async function callLLM(messages, modelOverride, meta = {}) {
  const model = resolveModel(modelOverride);
  const extractionModel =
    (process.env.OPENAI_EXTRACTION_MODEL || "").trim() || model;

  const response = await client.responses.create({
    model: extractionModel,
    input: messages,
  });
  logTokenUsage({ ...meta, model: extractionModel, usage: response.usage });
  return response.output_text;
}

export async function streamLLM(prompt, onToken, modelOverride, meta = {}) {
  const model = resolveModel(modelOverride);

  const stream = await client.responses.stream({
    model,
    input: prompt,
  });

  let usage = null;
  for await (const event of stream) {
    if (event.type === "response.output_text.delta") {
      const token = event.delta;
      if (token && onToken) {
        onToken(token);
      }
    }
    // The final event of a Responses API stream (response.completed) carries
    // the full response, including usage; earlier events won't have it.
    if (event.response?.usage) {
      usage = event.response.usage;
    }
  }
  logTokenUsage({ ...meta, model, usage });
}

let model = 'default'



// export async function callLLM(messages) {

//   const response = await openrouterClient.responses.create({
//     model,
//     input: messages,
//   });

//   return response.output_text;
// }

// export async function streamLLM(prompt, onToken) {

//   const stream = await openrouterClient.responses.stream({
//     model,
//     input: prompt,
//   });

//   for await (const event of stream) {
//     if (event.type === "response.output_text.delta") {
//       const token = event.delta;
//       if (token && onToken) onToken(token);
//     }
//   }
// }

export async function getModelIds() {
    const openrouterModels = await openrouterClient.models.list();

    const filteredModelIds = openrouterModels.data
        .filter(model =>
            model.id.toLowerCase().startsWith("openai/") ||
            model.id.toLowerCase().startsWith("google/")
        )
        .map(model => model.id);

    return filteredModelIds;
}

export async function updateModel(setModel) {
    model = setModel
    console.log(model)
}