'use server';

import { generateTranscript, GenerateTranscriptInput } from '@/ai/flows/generate-transcript';
import { suggestHotspots, SuggestHotspotsInput } from '@/ai/flows/suggest-hotspots';
import { generateVideoBackground, GenerateVideoBackgroundInput } from '@/ai/flows/generate-video-background';

export async function generateTranscriptFromGcsAction(input: GenerateTranscriptInput) {
  if (!process.env.GOOGLE_API_KEY) {
    const errorMessage = "The GOOGLE_API_KEY is missing from your .env file. Please get a key from Google AI Studio and add it to your server environment, then restart the development server.";
    console.error(errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }

  try {
    const transcript = await generateTranscript(input);
    return { success: true, data: transcript };
  } catch (error) {
    console.error('Error generating transcript from GCS:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return { 
      success: false, 
      error: `AI transcript generation failed. This could be due to an invalid API key or an issue with the video file. Original error: ${errorMessage}`
    };
  }
}

export async function suggestHotspotsAction(input: SuggestHotspotsInput) {
  try {
    const hotspots = await suggestHotspots(input);
    return { success: true, data: hotspots };
  } catch (error) {
    console.error('Error suggesting hotspots:', error);
    // It's better to return an empty array than mock data if hotspots fail.
    // The UI can gracefully handle no hotspots.
    return { success: true, data: [] };
  }
}

export async function generateVideoBackgroundAction(input: GenerateVideoBackgroundInput) {
    try {
      const result = await generateVideoBackground(input);
      return { success: true, data: result };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
      return { 
        success: false, 
        error: errorMessage 
      };
    }
}
