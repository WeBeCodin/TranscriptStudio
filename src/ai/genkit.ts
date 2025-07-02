
import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

// Correctly and securely access the server-side environment variable.
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

// Add a server-side check to ensure the key is present.
if (!GOOGLE_API_KEY) {
  // This error will appear in the server logs, not the browser console.
  throw new Error('Server configuration error: GOOGLE_API_KEY is not set in the environment.');
}

export const ai = genkit({
  plugins: [googleAI({ apiKey: GOOGLE_API_KEY })],
  model: 'googleai/gemini-2.0-flash',
});
