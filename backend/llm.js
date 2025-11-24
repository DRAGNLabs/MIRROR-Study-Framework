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




// import { openai } from '@ai-sdk/openai';
// import { streamText } from 'ai';
// import 'dotenv/config';


// export async function respondToUser(userPrompts) {
//   // Construct the LLM prompt
//   const prompt = ``;

//   // Send prompt to LLM
//   const result = await streamText({
//     model: openai('gpt-4.1-nano'),
//     prompt: prompt.trim()
//   });

//   // Collect the streamed output
//   let fullResponse = '';
//   for await (const delta of result.textStream) {
//     fullResponse += delta;
//   }
//   return fullResponse;

// }

//idk what form to make this return


