import OpenAI from "openai";
import dotenv from "dotenv";
dotenv.config();

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

export async function callLLM(messages, modelOverride) {
  const model = resolveModel(modelOverride);
  const extractionModel =
    (process.env.OPENAI_EXTRACTION_MODEL || "").trim() || model;

  const response = await client.responses.create({
    model: extractionModel,
    input: messages,
  });
  return response.output_text;
}

// Same as callLLM, but uses structured outputs so the reply is JSON that matches
// `schema` (no stray text or malformed JSON from the model)
export async function callLLMJson(messages, modelOverride, schemaName, schema) {
  const model = resolveModel(modelOverride);
  const extractionModel =
    (process.env.OPENAI_EXTRACTION_MODEL || "").trim() || model;

  const response = await client.responses.create({
    model: extractionModel,
    input: messages,
    text: {
      format: { type: "json_schema", name: schemaName, schema, strict: true },
    },
  });
  return response.output_text;
}

// Streams the reply text through onToken, then returns the model's reasoning:
//   output          - every output item (reasoning + message), as returned. Sent back
//                     unchanged in later rounds when the room passes reasoning back.
//   reasoningText   - readable reasoning (summary or raw text, depending on the model)
//   reasoningTokens - reasoning token count from usage
//   hasEncrypted    - whether encrypted reasoning (encrypted_content / signature) came back
// Formats differ by model: OpenAI returns a summary + encrypted_content, Claude returns
// thinking text + a signature, Gemini returns summary text + a separate encrypted item,
// and Kimi K3 returns its raw reasoning text. Models without reasoning return no reasoning items.
export async function streamLLM(prompt, onToken, modelOverride) {
  const model = resolveModel(modelOverride);

  const stream = client.responses.stream({
    model,
    input: prompt,
    reasoning: { effort: "medium", summary: "auto"},
    include: ["reasoning.encrypted_content"],
  });

  for await (const event of stream) {
    if (event.type === "response.output_text.delta") {
      const token = event.delta;
      if (token && onToken) {
        onToken(token);
      }
    }
  }

  const response = await stream.finalResponse();
  const output = response.output ?? [];
  const reasoningItems = output.filter((item) => item.type === "reasoning");
  const reasoningText = reasoningItems
    .flatMap((item) => [...(item.summary ?? []), ...(item.content ?? [])])
    .map((part) => part?.text ?? "")
    .filter(Boolean)
    .join("\n\n");

  return {
    output,
    reasoningText,
    reasoningTokens: response.usage?.output_tokens_details?.reasoning_tokens ?? 0,
    hasEncrypted: reasoningItems.some((item) => item.encrypted_content || item.signature),
  };
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