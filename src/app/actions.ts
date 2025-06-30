'use server';

import { generateTranscript } from '@/ai/flows/generate-transcript';
import { suggestHotspots, SuggestHotspotsInput } from '@/ai/flows/suggest-hotspots';
import { generateVideoBackground, GenerateVideoBackgroundInput } from '@/ai/flows/generate-video-background';

export async function generateTranscriptAction(formData: FormData) {
  const file = formData.get('videoFile') as File;
  if (!file) {
    return { success: false, error: 'No file uploaded.' };
  }

  try {
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const transcript = await generateTranscript({
      media: {
        bytes: fileBuffer,
        mimeType: file.type,
      },
    });
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
