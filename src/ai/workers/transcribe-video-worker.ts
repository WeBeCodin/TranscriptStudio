import type { Request, Response } from 'express';
import * as admin from 'firebase-admin';
import { generateTranscript, GenerateTranscriptInput } from '@/ai/flows/generate-transcript';
import type { Transcript } from '@/lib/types';

// Initialize Firebase Admin SDK if not already initialized
if (admin.apps.length === 0) {
  admin.initializeApp();
}
const db = admin.firestore();

interface TranscribeWorkerInput {
  jobId: string;
  gcsUri: string;
}

/**
 * Google Cloud Function (HTTP Triggered) to process video transcription.
 * Expects a POST request with JSON body: { jobId: string, gcsUri: string }
 */
export async function transcribeVideoWorker(req: Request, res: Response): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  const { jobId, gcsUri } = req.body as TranscribeWorkerInput;

  if (!jobId || !gcsUri) {
    res.status(400).send('Missing jobId or gcsUri in request body.');
    return;
  }

  const jobRef = db.collection("transcriptionJobs").doc(jobId);

  try {
    // 1. Update job status to PROCESSING
    await jobRef.update({
      status: 'PROCESSING',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 2. Perform transcription
    // This now relies on the GCF's environment having ADC (Application Default Credentials)
    // correctly set up with access to the Google AI services.
    const transcriptData: Transcript = await generateTranscript({ gcsUri });

    if (!transcriptData || !transcriptData.words) {
        throw new Error('AI model returned invalid transcript data.');
    }

    // 3. Update job with COMPLETED status and transcript
    await jobRef.update({
      status: 'COMPLETED',
      transcript: transcriptData,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`Job ${jobId} completed successfully.`);
    res.status(200).send({ success: true, message: `Job ${jobId} processed.` });

  } catch (error: any) {
    console.error(`Error processing job ${jobId}:`, error);
    
    // 4. Update job with FAILED status and error message
    await jobRef.update({
      status: 'FAILED',
      error: error.message || 'An unknown error occurred during transcription.',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }).catch(updateError => {
        // Log if updating Firestore itself fails
        console.error(`Failed to update job ${jobId} to FAILED status:`, updateError);
    });

    res.status(500).send({ success: false, error: `Failed to process job ${jobId}: ${error.message}` });
  }
}
