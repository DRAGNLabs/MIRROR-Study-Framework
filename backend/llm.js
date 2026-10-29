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