'use server';

/**
 * @fileOverview Suggests potential 'hotspots' in a video transcript for repurposing.
 *
 * - suggestHotspots - A function that takes a transcript and returns suggested sections.
 * - SuggestHotspotsInput - The input type for the suggestHotspots function.
 * - SuggestHotspotsOutput - The return type for the suggestHotspots function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestHotspotsInputSchema = z.object({
  transcript: z
    .string()
    .describe('The transcript of the video to analyze.'),
});
export type SuggestHotspotsInput = z.infer<typeof SuggestHotspotsInputSchema>;

const SuggestHotspotsOutputSchema = z.array(z.object({
  startIndex: z.number().describe('The start index of the suggested section in the transcript.'),
  endIndex: z.number().describe('The end index of the suggested section in the transcript.'),
  reason: z.string().describe('The reason why this section is suggested as a hotspot.'),
}));
export type SuggestHotspotsOutput = z.infer<typeof SuggestHotspotsOutputSchema>;

export async function suggestHotspots(input: SuggestHotspotsInput): Promise<SuggestHotspotsOutput> {
  return suggestHotspotsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestHotspotsPrompt',
  input: {schema: SuggestHotspotsInputSchema},
  output: {schema: SuggestHotspotsOutputSchema},
  prompt: `You are an AI assistant helping content creators find interesting sections in their video transcripts.

  Given the following transcript, identify sections that are likely to be engaging or important for repurposing into short-form content.

  Return an array of objects, where each object contains the start and end index of the suggested section in the transcript, and a brief reason for the suggestion.

  Transcript:
  {{transcript}}`,
});

const suggestHotspotsFlow = ai.defineFlow(
  {
    name: 'suggestHotspotsFlow',
    inputSchema: SuggestHotspotsInputSchema,
    outputSchema: SuggestHotspotsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
