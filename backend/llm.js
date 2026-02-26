import OpenAI from 'openai';
import dotenv from "dotenv";
dotenv.config();

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function callLLM(messages) {
  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL,
    input: messages,
  });
  return response.output_text;
}

export async function streamLLM(prompt, onToken) {
  const stream = await client.responses.stream({
    model: process.env.OPENAI_MODEL,
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