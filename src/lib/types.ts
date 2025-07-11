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
}

// --- Hotspot Structure ---
export type Hotspot = OriginalSuggestHotspotsOutput[0]; 

// --- UI and Editor Specific Types ---
export interface BrandOptions {
  logo?: string; 
  primaryColor: string;
  font: 'Inter' | 'Space Grotesk' | string; 
}

export interface Selection {
  start: number; // in seconds
  end: number;   // in seconds
}

// --- Job Management Types ---
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