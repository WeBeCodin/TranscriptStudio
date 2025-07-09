// src/lib/types.ts

import type { GenerateTranscriptOutput as OriginalGenerateTranscriptOutput } from '@/ai/flows/generate-transcript';
import type { SuggestHotspotsOutput as OriginalSuggestHotspotsOutput } from '@/ai/flows/suggest-hotspots';

// --- Re-exported AI Flow Output Types ---
export type GenerateTranscriptOutput = OriginalGenerateTranscriptOutput;
export type SuggestHotspotsOutput = OriginalSuggestHotspotsOutput;

// --- Core Transcript Structure ---
export interface Word {
  text: string;
  start: number; // seconds
  end: number;   // seconds
  confidence?: number;
  speaker?: number; // Speaker ID from diarization
  punctuated_word?: string; // Word with punctuation, if available
}

export interface Transcript {
  words: Word[];
  // You could add overall transcript metadata here if needed, e.g.:
  // confidence?: number;
  // duration?: number; // Total duration of the transcribed audio
  // language_code?: string;
}

// --- Hotspot Structure ---
// Assuming SuggestHotspotsOutput from your Genkit flow is an array of objects directly:
export type Hotspot = OriginalSuggestHotspotsOutput[0]; 

// --- UI and Editor Specific Types ---
export interface BrandOptions {
  logo?: string; // data URL for the logo, or path to a GCS object
  primaryColor: string;
  font: 'Inter' | 'Space Grotesk' | string; // Allow custom font strings
}

export interface Selection {
  start: number; // in seconds
  end: number;   // in seconds
}

// --- Job Management Types ---
export type JobStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface TranscriptionJob {
  id: string; 
  gcsUri: string; // GCS URI of the source video
  status: JobStatus;
  createdAt: any; // Firestore Timestamp
  updatedAt: any; // Firestore Timestamp
  transcript?: Transcript; // The final transcript data
  error?: string; // Error message if the job failed
  workerStartedAt?: any; // Timestamp
  workerCompletedAt?: any; // Timestamp
}

export interface ClippingJob {
  id: string; 
  userId?: string; // Optional: if you associate clips with users
  sourceVideoGcsUri: string; 
  startTime: number; // seconds
  endTime: number;   // seconds
  status: JobStatus; 
  outputFormat?: string; // e.g., 'mp4'
  createdAt: any; // Firestore Timestamp
  updatedAt: any; // Firestore Timestamp
  clippedVideoGcsUri?: string; // GCS URI of the final clip
  error?: string; // Error message if the job failed
  workerStartedAt?: any; // Timestamp
  workerCompletedAt?: any; // Timestamp
}