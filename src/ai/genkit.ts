// This is a comment to ensure the file is changed.
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';

const googleApiKey = process.env.GOOGLE_API_KEY;

if (!googleApiKey) {
  throw new Error('Server configuration error: GOOGLE_API_KEY is not set in the environment.');
}

genkit.configure({
  plugins: [
    googleAI({
      apiKey: googleApiKey,
    }),
  ],
  logLevel: 'debug',
  enableTracingAndMetrics: true,
});

export * from './flows/generate-transcript';
export * from './flows/suggest-hotspots';
export * from './flows/generate-video-background';
