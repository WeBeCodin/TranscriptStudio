import type { GenerateTranscriptOutput } from './generate-transcript';

export type Word = GenerateTranscriptOutput['words'][0];
export type Transcript = GenerateTranscriptOutput;

// Defines the possible states of a transcription job
export type JobStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

// Represents the structure of a transcription job document in Firestore
export interface TranscriptionJob {
  id: string; // Job ID, typically same as Firestore document ID
  gcsUri: string;
  status: JobStatus;
  createdAt: any; // Firestore Timestamp
  updatedAt: any; // Firestore Timestamp
  transcript?: Transcript;
  error?: string;
}
