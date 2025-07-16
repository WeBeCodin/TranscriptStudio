'use server';

import { defineFlow, runFlow } from '@genkit-ai/flow';
import { generate } from '@genkit-ai/ai';
import { z } from 'zod';

// Input schema
const GenerateVideoBackgroundInputSchema = z.object({
  imageUrl: z.string().url().describe('A data URL of a single frame from the video.'),
});
export type GenerateVideoBackgroundInput = z.infer<typeof GenerateVideoBackgroundInputSchema>;

// Output schema
const GenerateVideoBackgroundOutputSchema = z.object({
  generatedImageUrl: z.string().url().describe('A data URL of the generated background image.'),
});
export type GenerateVideoBackgroundOutput = z.infer<typeof GenerateVideoBackgroundOutputSchema>;

// Flow definition
export const generateVideoBackgroundFlow = defineFlow(
  {
    name: 'generateVideoBackgroundFlow',
    inputSchema: GenerateVideoBackgroundInputSchema,
    outputSchema: GenerateVideoBackgroundOutputSchema,
  },
  async (input: GenerateVideoBackgroundInput): Promise<GenerateVideoBackgroundOutput> => {
    const { output } = await generate({
      model: 'googleai/gemini-1.5-flash',
      prompt: [
        { text: "Analyze this video frame and generate a clean, high-resolution background image. The background should be contextually appropriate but without any people, text, or distracting foreground elements. The goal is to create a simple, aesthetically pleasing background that could be used behind text or other graphics." },
        { media: { dataUrl: input.imageUrl } }
      ],
      output: {
        format: 'json',
        schema: GenerateVideoBackgroundOutputSchema,
      },
    }, {}); // <-- Second argument is required

    if (!output) throw new Error('Failed to generate background image');
    return output;
  }
);

export async function generateVideoBackground(input: GenerateVideoBackgroundInput): Promise<GenerateVideoBackgroundOutput> {
  return runFlow(generateVideoBackgroundFlow, input);
}