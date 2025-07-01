'use server';

/**
 * @fileOverview Generates a time-coded transcript of a video or audio file from Google Cloud Storage.
 *
 * - generateTranscript - A function that handles the transcript generation process.
 * - GenerateTranscriptInput - The input type for the generateTranscript function.
 * - GenerateTranscriptOutput - The return type for the generateTranscript function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateTranscriptInputSchema = z.object({
  gcsUri: z.string().describe('The Google Cloud Storage URI of the video file (e.g., gs://bucket-name/file-name).'),
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

const generateTranscriptFlow = ai.defineFlow(
  {
    name: 'generateTranscriptFlow',
    inputSchema: GenerateTranscriptInputSchema,
    outputSchema: GenerateTranscriptOutputSchema,
  },
  async input => {
    const {output} = await ai.generate({
        // Using a more powerful model better suited for large video files.
        model: 'googleai/gemini-1.5-pro',
        prompt: [
            { text: `You are an expert transcriptionist. Your task is to generate a precise, time-coded transcript from the provided media file.

Analyze the media file and return a structured transcript with an array of word objects. Each object must contain the word's text, and its start and end time in seconds.

The output MUST be a valid JSON object that adheres to the provided schema. Do not include any markdown formatting like \`\`\`json.` },
            { media: { uri: input.gcsUri } }
        ],
        output: {
            format: 'json',
            schema: GenerateTranscriptOutputSchema,
        }
    });
    
    if (!output) {
        throw new Error(
            'The AI model failed to generate a valid transcript. This might be due to an issue with the media file or a temporary model problem. Please try again with a different video.'
        );
    }
    return output;
  }
);
