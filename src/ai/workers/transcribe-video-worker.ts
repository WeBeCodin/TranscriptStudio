import { Request, Response } from 'express'; // Assuming a GCF HTTP trigger uses express-like types
import { db } from '@/lib/firebase'; // Adjust path if necessary, GCF might need its own firebase admin init
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { generateTranscript, GenerateTranscriptInput } from '@/ai/flows/generate-transcript';
import type { Transcript } from '@/lib/types';

// If deploying as a GCF, Firebase Admin SDK might be initialized differently:
// import * as admin from 'firebase-admin';
// if (admin.apps.length === 0) {
//   admin.initializeApp();
// }
// const db = admin.firestore();

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

  const jobRef = doc(db, "transcriptionJobs", jobId);

  try {
    // 1. Update job status to PROCESSING
    await updateDoc(jobRef, {
      status: 'PROCESSING',
      updatedAt: serverTimestamp(),
    });

    // 2. Perform transcription
    // Ensure generateTranscript is self-contained or has dependencies correctly resolved in GCF environment
    const transcriptData: Transcript = await generateTranscript({ gcsUri });

    if (!transcriptData || !transcriptData.words) {
        throw new Error('AI model returned invalid transcript data.');
    }

    // 3. Update job with COMPLETED status and transcript
    await updateDoc(jobRef, {
      status: 'COMPLETED',
      transcript: transcriptData,
      updatedAt: serverTimestamp(),
    });

    console.log(`Job ${jobId} completed successfully.`);
    res.status(200).send({ success: true, message: `Job ${jobId} processed.` });

  } catch (error: any) {
    console.error(`Error processing job ${jobId}:`, error);
    
    // 4. Update job with FAILED status and error message
    await updateDoc(jobRef, {
      status: 'FAILED',
      error: error.message || 'An unknown error occurred during transcription.',
      updatedAt: serverTimestamp(),
    }).catch(updateError => {
        // Log if updating Firestore itself fails
        console.error(`Failed to update job ${jobId} to FAILED status:`, updateError);
    });

    res.status(500).send({ success: false, error: `Failed to process job ${jobId}: ${error.message}` });
  }
}