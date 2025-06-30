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
  output: {
    schema: GenerateTranscriptOutputSchema,
    format: 'json',
  },
  prompt: `You are an expert transcriptionist. Your task is to generate a precise, time-coded transcript from the provided media file.

Analyze the media file and return a structured transcript with an array of word objects. Each object must contain the word's text, and its start and end time in seconds.

Media for transcription: {{media url=mediaDataUri}}`,
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
