// Implemented Genkit flow for automatic transcript generation with word-level timestamps, enabling efficient video content repurposing.

'use server';

/**
 * @fileOverview Generates a time-coded transcript of a video or audio file.
 *
 * - generateTranscript - A function that handles the transcript generation process.
 * - GenerateTranscriptInput - The input type for the generateTranscript function.
 * - GenerateTranscriptOutput - The return type for the generateTranscript function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateTranscriptInputSchema = z.object({
  mediaDataUri: z
    .string()
    .describe(
      "A video or audio file, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});

export type GenerateTranscriptInput = z.infer<typeof GenerateTranscriptInputSchema>;

const WordSchema = z.object({
  text: z.string().describe('The transcribed word.'),
  start: z.number().describe('Start time of the word in seconds.'),
  end: z.number().describe('End time of the word in seconds.'),
  speaker: z.number().optional().describe('Speaker ID (e.g., 0, 1).'),
});

const GenerateTranscriptOutputSchema = z.object({
  words: z.array(WordSchema).describe('An array of word objects with timestamps.'),
});

export type GenerateTranscriptOutput = z.infer<typeof GenerateTranscriptOutputSchema>;

export async function generateTranscript(input: GenerateTranscriptInput): Promise<GenerateTranscriptOutput> {
  return generateTranscriptFlow(input);
}

const generateTranscriptPrompt = ai.definePrompt({
  name: 'generateTranscriptPrompt',
  model: 'googleai/gemini-1.5-flash',
  input: {schema: GenerateTranscriptInputSchema},
  output: {schema: GenerateTranscriptOutputSchema},
  prompt: `You are an expert transcriptionist specializing in generating transcripts from media files.

You will use this information to generate a time-coded transcript of the media file. The transcript should include word-level timestamps (start and end times in seconds) for each word. Your output MUST be a JSON object that conforms to the provided schema.

Use the following as the primary source of information about the media.

Media: {{media url=mediaDataUri}}`,
});

const generateTranscriptFlow = ai.defineFlow(
  {
    name: 'generateTranscriptFlow',
    inputSchema: GenerateTranscriptInputSchema,
    outputSchema: GenerateTranscriptOutputSchema,
  },
  async input => {
    const {output} = await generateTranscriptPrompt(input);
    return output!;
  }
);
