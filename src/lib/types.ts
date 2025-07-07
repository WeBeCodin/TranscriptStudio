// It's unusual to have 'use server' in a types file, but harmless.
// 'use server'; 

import type { GenerateTranscriptOutput } from '@/ai/flows/generate-transcript';
// Import SuggestHotspotsOutput and alias it to make the re-export clear
import type { SuggestHotspotsOutput as OriginalSuggestHotspotsOutput } from '@/ai/flows/suggest-hotspots';

// Explicitly re-export SuggestHotspotsOutput so it can be imported from this module
export type SuggestHotspotsOutput = OriginalSuggestHotspotsOutput;

export type Word = GenerateTranscriptOutput['words'][0];
export type Transcript = GenerateTranscriptOutput;
// Hotspot type is derived from the re-exported SuggestHotspotsOutput
export type Hotspot = OriginalSuggestHotspotsOutput[0];


export interface BrandOptions {
  logo?: string; // data URL for the logo
  primaryColor: string;
  font: 'Inter' | 'Space Grotesk';
}

export interface Selection {
  start: number;
  end: number;
}

// Defines the possible states of a job (can be reused for transcription, clipping, etc.)
export type JobStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

// Represents the structure of a transcription job document in Firestore
export interface TranscriptionJob {
  id: string; 
  gcsUri: string;
  status: JobStatus;
  createdAt: any; // Firestore Timestamp, consider a more specific type if using a converter
  updatedAt: any; // Firestore Timestamp, consider a more specific type if using a converter
  transcript?: Transcript; 
  error?: string; 
}

// Represents the structure of a video clipping job document in Firestore
export interface ClippingJob {
  id: string; 
  userId?: string; 
  sourceVideoGcsUri: string; 
  startTime: number; 
  endTime: number; 
  status: JobStatus; 
  outputFormat?: string; 
  createdAt: any; 
  updatedAt: any; 
  clippedVideoGcsUri?: string; 
  error?: string; 
}