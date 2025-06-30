import type { GenerateTranscriptOutput } from '@/ai/flows/generate-transcript';
import type { SuggestHotspotsOutput } from '@/ai/flows/suggest-hotspots';

export type Word = GenerateTranscriptOutput['segments'][0]['words'][0];
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
