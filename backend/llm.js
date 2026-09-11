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

let model = 'default'



export async function callLLM(messages) {

  const response = await client.responses.create({
    model,
    input: messages,
  });

  return response.output_text;
}

export async function streamLLM(prompt, onToken) {

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
export async function updateModel(setModel){
    model = setModel
    console.log(model)
}