import { genkit } from 'genkit';
import { defineFlow, runFlow } from '@genkit-ai/flow';
import { googleAI } from '@genkit-ai/googleai';
// Use googleAI.generate(...) for model inference

// This is a temporary workaround because the.env file is not being loaded.
// In a production environment, this key should be stored securely in an environment variable.
const googleApiKey = process.env.GOOGLE_API_KEY;

if (!googleApiKey) {
  throw new Error('Server configuration error: GOOGLE_API_KEY is not set in the environment.');
}

// Configure Genkit with the Google AI plugin. This is the central configuration.
genkit({
  plugins: [
    googleAI({
      apiKey: googleApiKey,
    }),
  ],
});