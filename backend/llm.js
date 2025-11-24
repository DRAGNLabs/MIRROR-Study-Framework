import OpenAI from 'openai';
const client = new OpenAI();

export async function streamLLM(prompt, onToken) {
  const stream = await client.responses.stream({
    model: "gpt-4.1-nano",
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