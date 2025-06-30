'use server';
/**
 * @fileOverview Generates a background for a video frame.
 *
 * - generateVideoBackground - A function that handles the background generation process.
 * - GenerateVideoBackgroundInput - The input type for the function.
 * - GenerateVideoBackgroundOutput - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { generateVideoBackgroundAction } from '@/app/actions';

const GenerateVideoBackgroundInputSchema = z.object({
  frameDataUri: z
    .string()
    .describe(
      "A single video frame, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type GenerateVideoBackgroundInput = z.infer<typeof GenerateVideoBackgroundInputSchema>;

const GenerateVideoBackgroundOutputSchema = z.object({
  backgroundDataUri: z.string().describe("The generated background image as a data URI."),
});
export type GenerateVideoBackgroundOutput = z.infer<typeof GenerateVideoBackgroundOutputSchema>;

export async function generateVideoBackground(input: GenerateVideoBackgroundInput): Promise<GenerateVideoBackgroundOutput> {
  return generateVideoBackgroundFlow(input);
}

const generateVideoBackgroundFlow = ai.defineFlow(
  {
    name: 'generateVideoBackgroundFlow',
    inputSchema: GenerateVideoBackgroundInputSchema,
    outputSchema: GenerateVideoBackgroundOutputSchema,
  },
  async input => {
    const {media} = await ai.generate({
      model: 'googleai/gemini-2.0-flash-preview-image-generation',
      prompt: [
        {media: {url: input.frameDataUri}},
        {text: 'Extend the top and bottom of this image with a background that seamlessly matches the existing content, creating a complete image with a 9:16 portrait aspect ratio. Do not alter the original image content.'},
      ],
      config: {
        responseModalities: ['TEXT', 'IMAGE'],
      },
    });

    if (!media?.url) {
        throw new Error('Image generation failed to return a valid image.');
    }

    return { backgroundDataUri: media.url };
  }
);
