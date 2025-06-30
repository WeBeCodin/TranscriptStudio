'use server';

import { generateTranscript, GenerateTranscriptInput } from '@/ai/flows/generate-transcript';
import { suggestHotspots, SuggestHotspotsInput } from '@/ai/flows/suggest-hotspots';

export async function generateTranscriptAction(input: GenerateTranscriptInput) {
  try {
    const transcript = await generateTranscript(input);
    return { success: true, data: transcript };
  } catch (error) {
    console.error('Error generating transcript:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return { 
      success: false, 
      error: errorMessage 
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
