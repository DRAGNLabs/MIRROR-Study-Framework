import OpenAI from 'openai';
import dotenv from "dotenv";
dotenv.config();

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

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