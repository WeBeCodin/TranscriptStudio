'use server';

import { defineFlow, runFlow } from '@genkit-ai/flow';
import { generate } from '@genkit-ai/ai';
import { z } from 'zod';

// Input schema
const SuggestHotspotsInputSchema = z.object({
  transcript: z.string().describe('The full transcript text of the video.'),
});
export type SuggestHotspotsInput = z.infer<typeof SuggestHotspotsInputSchema>;

// Output schema
const HotspotSchema = z.object({
  start_time: z.number(),
  end_time: z.number(),
  title: z.string(),
  reason: z.string(),
});
const SuggestHotspotsOutputSchema = z.array(HotspotSchema);
export type SuggestHotspotsOutput = z.infer<typeof SuggestHotspotsOutputSchema>;

// Flow definition
export const suggestHotspotsFlow = defineFlow(
  {
    name: 'suggestHotspotsFlow',
    inputSchema: SuggestHotspotsInputSchema,
    outputSchema: SuggestHotspotsOutputSchema,
  },
  async (input: SuggestHotspotsInput): Promise<SuggestHotspotsOutput> => {
    const { output } = await generate({
      model: 'googleai/gemini-1.5-flash',
      prompt: [
        { text:
          `You are an expert social media video editor. Analyze the following transcript and identify 3-5 "hotspots" or compelling segments that would make great short-form video clips. For each hotspot, provide a start time, end time, a catchy title, and a brief reason.

Transcript:
${input.transcript}` }
      ],
      output: {
        format: 'json',
        schema: SuggestHotspotsOutputSchema,
      }
    }, {}); // <-- Second argument is required

    return output || [];
  }
);

export async function suggestHotspots(input: SuggestHotspotsInput): Promise<SuggestHotspotsOutput> {
  return runFlow(suggestHotspotsFlow, input);
}