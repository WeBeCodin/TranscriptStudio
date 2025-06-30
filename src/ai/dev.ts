import { config } from 'dotenv';
config();

import '@/ai/flows/generate-transcript.ts';
import '@/ai/flows/suggest-hotspots.ts';
import '@/ai/flows/generate-video-background.ts';
