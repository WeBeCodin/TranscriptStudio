import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

// This loads the GOOGLE_API_KEY from your .env.local file.
// Make sure it's set there.
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY; 

if (!GOOGLE_API_KEY || GOOGLE_API_KEY === "AIzaSyAYTtmqjVYRy8SpVirvjUQYraVjOL_aW2E") {
    console.warn("Using placeholder or missing Google API Key. Please set GOOGLE_API_KEY in your .env.local file for the AI features to work.");
}

export const ai = genkit({
  plugins: [googleAI({ apiKey: GOOGLE_API_KEY })],
  model: 'googleai/gemini-2.0-flash',
});
