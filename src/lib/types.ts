import type { GenerateTranscriptOutput } from '@/ai/flows/generate-transcript';
import type { SuggestHotspotsOutput } from '@/ai/flows/suggest-hotspots';

export type Word = GenerateTranscriptOutput['words'][0];
export type Transcript = GenerateTranscriptOutput;
export type Hotspot = SuggestHotspotsOutput[0];

export interface BrandOptions {
  logo?: string; // data URL for the logo
  primaryColor: string;
  font: 'Inter' | 'Space Grotesk';
}

export interface Selection {
  start: number;
  end: number;
}

// Defines the possible states of a transcription job
export type JobStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

// Represents the structure of a transcription job document in Firestore
export interface TranscriptionJob {
  id: string; // Job ID, typically same as Firestore document ID
  gcsUri: string;
  status: JobStatus;
  createdAt: any; // Firestore Timestamp, consider a more specific type if using a converter
  updatedAt: any; // Firestore Timestamp, consider a more specific type if using a converter
  transcript?: Transcript; // The final transcript data, using existing Transcript type
  error?: string; // Error message if the job failed
}