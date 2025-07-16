import { z } from 'zod';

// Schema for generating a transcript
export const GenerateTranscriptInputSchema = z.object({
  gcsUri: z.string().describe('The Google Cloud Storage URI of the video file (e.g., gs://bucket-name/file-name).'),
});
export type GenerateTranscriptInput = z.infer<typeof GenerateTranscriptInputSchema>;

const WordSchema = z.object({
  text: z.string().describe('The transcribed word.'),
  start: z.number().describe('Start time of the word in seconds.'),
  end: z.number().describe('End time of the word in seconds.'),
  speaker: z.number().optional().describe('Speaker ID (e.g., 0, 1).'),
});

export const GenerateTranscriptOutputSchema = z.object({
  words: z.array(WordSchema).describe('An array of word objects with timestamps.'),
});
export type GenerateTranscriptOutput = z.infer<typeof GenerateTranscriptOutputSchema>;


// Schema for suggesting hotspots
export const SuggestHotspotsInputSchema = z.object({
  transcript: z.string().describe('The full transcript text of the video.'),
});
export type SuggestHotspotsInput = z.infer<typeof SuggestHotspotsInputSchema>;

const HotspotSchema = z.object({
  start_time: z.number().describe('The start time of the suggested clip in seconds.'),
  end_time: z.number().describe('The end time of the suggested clip in seconds.'),
  title: z.string().describe('A catchy, short title for the clip.'),
  reason: z.string().describe('A brief explanation of why this segment is a good clip.'),
});

export const SuggestHotspotsOutputSchema = z.array(HotspotSchema);
export type SuggestHotspotsOutput = z.infer<typeof SuggestHotspotsOutputSchema>;


// General application types
export type Word = z.infer<typeof WordSchema>;
export type Transcript = GenerateTranscriptOutput;
export type Hotspot = z.infer<typeof HotspotSchema>;

export interface BrandOptions {
  logo?: string; // data URL for the logo
  primaryColor: string;
  font: 'Inter' | 'Space Grotesk';
}

export interface Selection {
  start: number;
  end: number;
}

export type JobStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface TranscriptionJob {
  id: string;
  gcsUri: string;
  status: JobStatus;
  createdAt: any; 
  updatedAt: any; 
  transcript?: Transcript;
  error?: string;
}