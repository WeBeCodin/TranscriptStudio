
import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

// IMPORTANT: Replace this placeholder with your actual Google AI API key.
// This is a temporary workaround because the .env file is not being loaded.
const GOOGLE_API_KEY = "AIzaSyAYTtmqjVYRy8SpVirvjUQYraVjOL_aW2E"; 

if (GOOGLE_API_KEY === "AIzaSyAYTtmqjVYRy8SpVirvjUQYraVjOL_aW2E") {
    console.warn("Using placeholder Google API Key in src/ai/genkit.ts. Please replace it with your actual key for the AI features to work.");
}

export const ai = genkit({
  plugins: [googleAI({ apiKey: GOOGLE_API_KEY })],
  model: 'googleai/gemini-2.0-flash',
});
