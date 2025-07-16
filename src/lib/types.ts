// src/lib/types.ts

// --- AI Flow Output Types (based on Gemini functions) ---

// Output of generateTranscript
export type GenerateTranscriptOutput = {
  transcript: Transcript;
  // You can add additional fields if your Gemini output includes them
};

// Output of suggestHotspots
export type Hotspot = {
  start_time: number;   // seconds, or string if that's the Gemini format
  end_time: number;     // seconds, or string if that's the Gemini format
  title: string;
  reason: string;
};
export type SuggestHotspotsOutput = Hotspot[];

// Output of generateVideoBackground
export type GenerateVideoBackgroundOutput = {
  backgroundDataUri: string; // e.g., "data:image/png;base64,..."
};

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
  workerStartedAt?: any; 
  workerCompletedAt?: any; 
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
  workerStartedAt?: any; 
  workerCompletedAt?: any; 
}