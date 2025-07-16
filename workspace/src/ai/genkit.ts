import { genkit } from 'genkit';
import { defineFlow, runFlow } from '@genkit-ai/flow';
import { googleAI } from '@genkit-ai/googleai';
// Use googleAI.generate(...) for model inference

// Securely access the server-side environment variable.
// Ensure GOOGLE_API_KEY is set in your .env.local file.
const googleApiKey = process.env.GOOGLE_API_KEY;

if (!googleApiKey) {
  throw new Error('Server configuration error: GOOGLE_API_KEY is not set in the environment.');
}

genkit({
  plugins: [
    googleAI({
      apiKey: googleApiKey,
    }),
  ],
});

// Do NOT export flows from this file. This prevents circular dependency errors.