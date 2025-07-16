'use server';

import { defineFlow, runFlow } from '@genkit-ai/flow';
import { generate } from '@genkit-ai/ai';
import { z } from 'zod';

// Input schema
const GenerateTranscriptInputSchema = z.object({
  gcsUri: z.string().describe('The Google Cloud Storage URI of the video file (e.g., gs://bucket-name/file-name).'),
});
export type GenerateTranscriptInput = z.infer<typeof GenerateTranscriptInputSchema>;

// Output schema
const WordSchema = z.object({
  text: z.string(),
  start: z.number(),
  end: z.number(),
  speaker: z.number().optional(),
});
const GenerateTranscriptOutputSchema = z.object({
  words: z.array(WordSchema),
});
export type GenerateTranscriptOutput = z.infer<typeof GenerateTranscriptOutputSchema>;

// Flow definition
export const generateTranscriptFlow = defineFlow(
  {
    name: 'generateTranscriptFlow',
    inputSchema: GenerateTranscriptInputSchema,
    outputSchema: GenerateTranscriptOutputSchema,
  },
  async (input: GenerateTranscriptInput): Promise<GenerateTranscriptOutput> => {
    const { output } = await generate({
      model: 'googleai/gemini-1.5-flash',
      prompt: [
        { text: `You are an expert transcriptionist. Your task is to generate a precise, time-coded transcript from the provided media file.

- Identify different speakers and assign a unique speaker ID to each one (e.g., 0, 1, 2).
- Analyze the media file and return a structured transcript with an array of word objects.
- Each object must contain the word's text, its start and end time in seconds, and the corresponding speaker ID.

The output MUST be a valid JSON object that adheres to the provided schema. Do not include any markdown formatting like \`\`\`json.` },
        { media: { uri: input.gcsUri } }
      ],
      output: {
        format: 'json',
        schema: GenerateTranscriptOutputSchema,
      }
    }, {}); // <-- Genkit v1.14.x+ requires two arguments

    if (!output) throw new Error('Failed to generate transcript');
    return output;
  }
);

export async function generateTranscript(input: GenerateTranscriptInput): Promise<GenerateTranscriptOutput> {
  return runFlow(generateTranscriptFlow, input);
}