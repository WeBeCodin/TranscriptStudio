// This file is being replaced by a consolidated index.js for the Google Cloud Function.
const admin = require('firebase-admin');
const { genkit, z } = require('genkit');
const { googleAI } = require('@genkit-ai/googleai');

// -- Start genkit.js logic --
const ai = genkit({
  plugins: [googleAI()],
  model: 'googleai/gemini-2.0-flash',
});
// -- End genkit.js logic --

// -- Start generate-transcript.js logic --
const GenerateTranscriptInputSchema = z.object({
  gcsUri: z.string().describe('The Google Cloud Storage URI of the video file (e.g., gs://bucket-name/file-name).'),
});

const WordSchema = z.object({
  text: z.string().describe('The transcribed word.'),
  start: z.number().describe('Start time of the word in seconds.'),
  end: z.number().describe('End time of the word in seconds.'),
  speaker: z.number().optional().describe('Speaker ID (e.g., 0, 1).'),
});

const GenerateTranscriptOutputSchema = z.object({
  words: z.array(WordSchema).describe('An array of word objects with timestamps.'),
});

const generateTranscriptFlow = ai.defineFlow(
  {
    name: 'generateTranscriptFlow',
    inputSchema: GenerateTranscriptInputSchema,
    outputSchema: GenerateTranscriptOutputSchema,
  },
  async (input) => {
    const { output } = await ai.generate({
        model: 'googleai/gemini-1.5-flash',
        prompt: [
            { text: `You are an expert transcriptionist. Your task is to generate a precise, time-coded transcript from the provided media file.

- Identify different speakers and assign a unique speaker ID to each one (e.g., 0, 1, 2).
- Analyze the media file and return a structured transcript with an array of word objects. 
- Each object must contain the word's text, its start and end time in seconds, and the corresponding speaker ID.

The output MUST be a valid JSON object that adheres to the provided schema. Do not include any markdown formatting like \`\`\`json.` },
            { media: { uri: input.gcsUri } }
        ],
        output: {
            format: 'json',
            schema: GenerateTranscriptOutputSchema,
        }
    });
    
    if (!output) {
        throw new Error(
            'The AI model failed to generate a valid transcript. This might be due to an issue with the media file or a temporary model problem. Please try again with a different video.'
        );
    }
    return output;
  }
);
// -- End generate-transcript.js logic --

// -- Start index.js (worker) logic --
// Initialize Firebase Admin SDK if not already initialized
if (admin.apps.length === 0) {
  admin.initializeApp();
}
const db = admin.firestore();

/**
 * Google Cloud Function (HTTP Triggered) to process video transcription.
 * This is the entry point.
 */
exports.transcribeVideoWorker = async (req, res) => {
  // Set CORS headers to allow requests from your web app
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    // Handle preflight requests
    res.status(204).send('');
    return;
  }
  
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  const { jobId, gcsUri } = req.body;

  if (!jobId || !gcsUri) {
    res.status(400).send('Missing jobId or gcsUri in request body.');
    return;
  }

  const jobRef = db.collection("transcriptionJobs").doc(jobId);

  try {
    await jobRef.update({
      status: 'PROCESSING',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const transcriptData = await generateTranscriptFlow({ gcsUri });

    if (!transcriptData || !transcriptData.words) {
        throw new Error('AI model returned invalid transcript data.');
    }

    await jobRef.update({
      status: 'COMPLETED',
      transcript: transcriptData,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`Job ${jobId} completed successfully.`);
    res.status(200).send({ success: true, message: `Job ${jobId} processed.` });

  } catch (error) {
    console.error(`Error processing job ${jobId}:`, error);
    
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred during transcription.';

    await jobRef.update({
      status: 'FAILED',
      error: errorMessage,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }).catch(updateError => {
        console.error(`Failed to update job ${jobId} to FAILED status:`, updateError);
    });

    res.status(500).send({ success: false, error: `Failed to process job ${jobId}: ${errorMessage}` });
  }
};
// -- End index.js (worker) logic --
