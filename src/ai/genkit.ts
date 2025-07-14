import { configure, gemini } from '@genkit-ai/googleai';

const googleApiKey = process.env.GOOGLE_API_KEY;

if (!googleApiKey) {
  throw new Error('Server configuration error: GOOGLE_API_KEY is not set in the environment.');
}

configure({
  plugins: [
    gemini({
      apiKey: googleApiKey,
    }),
  ],
  logLevel: 'debug',
  enableTracingAndMetrics: true,
});

export _ from './flows/generate-transcript';
export _ from './flows/suggest-hotspots';
export _ from './flows/generate-video-background';
