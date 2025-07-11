console.log('[DEEPGRAM_WORKER_LOG] V8 Corrected START: Loading deepgram-worker/index.ts');

import type { Request, Response } from 'express';
import * as admin from 'firebase-admin';
// Correct imports for Deepgram SDK v3.x - using createClient
import { createClient, DeepgramClient, PrerecordedSchema } from '@deepgram/sdk'; 
import { GetSignedUrlConfig, Bucket } from '@google-cloud/storage'; 

export type JobStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

// Local Word and Transcript types
export interface Word {
  text: string;
  start: number; 
  end: number;   
  confidence?: number;
  speaker?: number; 
  punctuated_word?: string;
}
export interface Transcript {
  words: Word[];
}

let db: admin.firestore.Firestore;
let storageBucket: Bucket; 
let deepgram: DeepgramClient; 

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;
const TARGET_BUCKET_NAME = 'transcript-studio-4drhv.appspot.com'; 

try {
  console.log('[DEEPGRAM_WORKER_LOG] STEP_INIT_FIREBASE: Initializing Firebase Admin SDK...');
  if (admin.apps.length === 0) {
    admin.initializeApp({
      storageBucket: TARGET_BUCKET_NAME, 
    });
  }
  db = admin.firestore();
  storageBucket = admin.storage().bucket(TARGET_BUCKET_NAME); 
  console.log(`[DEEPGRAM_WORKER_LOG] STEP_INIT_FIREBASE_SUCCESS: Firebase Admin SDK initialized (DB and Storage for bucket '${storageBucket.name}').`);

  if (!DEEPGRAM_API_KEY) {
    console.error('[DEEPGRAM_WORKER_LOG] !!! CRITICAL_ERROR_NO_DEEPGRAM_KEY: DEEPGRAM_API_KEY environment variable not set.');
    throw new Error('DEEPGRAM_API_KEY environment variable not set.');
  }

  deepgram = createClient(DEEPGRAM_API_KEY); 
  
  console.log('[DEEPGRAM_WORKER_LOG] STEP_INIT_DEEPGRAM_SUCCESS: Deepgram client initialized.');

} catch (e: any) {
  console.error('[DEEPGRAM_WORKER_LOG] !!! CRITICAL_ERROR_INITIAL_SETUP:', e.message, e.stack);
  process.exit(1); 
}

interface TranscriptionWorkerInput {
  jobId: string;
  gcsUri: string; 
}

export const deepgramTranscriptionWorker = async (req: Request, res: Response): Promise<void> => {
  const receivedJobId = req.body?.jobId || 'unknown_job_at_invocation';
  console.log(`[DEEPGRAM_WORKER_LOG][${receivedJobId}] INVOKED: deepgramTranscriptionWorker with body:`, JSON.stringify(req.body));

  if (!db || !storageBucket || !deepgram) {
    console.error(`[DEEPGRAM_WORKER_LOG][${receivedJobId}] ERROR_SERVICES_NOT_INIT: Firebase/Deepgram services not initialized!`);
    res.status(500).send({ success: false, error: 'Internal Server Error: Critical services not initialized.' });
    return;
  }

  if (req.method !== 'POST') {
    console.warn(`[DEEPGRAM_WORKER_LOG][${receivedJobId}] WARN_INVALID_METHOD: Method ${req.method} not allowed.`);
    res.status(405).send('Method Not Allowed');
    return;
  }

  const { jobId, gcsUri } = req.body as TranscriptionWorkerInput;

  if (!jobId || !gcsUri) {
    console.error(`[DEEPGRAM_WORKER_LOG][${jobId || 'MISSING_JOB_ID'}] ERROR_MISSING_PARAMS: Missing jobId or gcsUri. Body:`, req.body);
    res.status(400).send({ success: false, error: 'Missing jobId or gcsUri in request body.' });
    return;
  }

  const jobRef = db.collection("transcriptionJobs").doc(jobId);

  try {
    console.log(`[DEEPGRAM_WORKER_LOG][${jobId}] STEP_JOB_PROCESSING: Updating job status to PROCESSING.`);
    await jobRef.update({
      status: 'PROCESSING' as JobStatus,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      workerStartedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const gcsUriMatch = gcsUri.match(/^gs:\/\/([^\/]+)\/(.+)$/);
    if (!gcsUriMatch) {
      throw new Error(`Invalid GCS URI format: ${gcsUri}. Expected gs://BUCKET_NAME/FILE_PATH`);
    }
    const bucketNameFromUri = gcsUriMatch[1];
    const filePath = gcsUriMatch[2];

    if (bucketNameFromUri !== TARGET_BUCKET_NAME) {
        console.warn(`[DEEPGRAM_WORKER_LOG][${jobId}] WARN_BUCKET_MISMATCH: GCS URI bucket '${bucketNameFromUri}' differs from target bucket '${TARGET_BUCKET_NAME}'. Using URI's bucket for signed URL.`);
    }
    
    const fileInBucket = admin.storage().bucket(bucketNameFromUri).file(filePath);

    const signedUrlConfig: GetSignedUrlConfig = {
      action: 'read',
      expires: Date.now() + 15 * 60 * 1000, // 15 minutes
    };
    const [signedUrl] = await fileInBucket.getSignedUrl(signedUrlConfig);
    console.log(`[DEEPGRAM_WORKER_LOG][${jobId}] STEP_SIGNED_URL_GENERATED: Generated signed URL for GCS file.`);

    const options: PrerecordedSchema = { 
      model: 'nova-2', 
      smart_format: true,
      punctuate: true,
      diarize: true, 
      utterances: true, 
      numerals: true,
    };

    console.log(`[DEEPGRAM_WORKER_LOG][${jobId}] STEP_DEEPGRAM_REQUEST: Sending audio to Deepgram. Options:`, JSON.stringify(options));
    
    const { result, error: dgError } = await deepgram.listen.prerecorded.transcribeUrl(
        { url: signedUrl }, 
        options
    );

    if (dgError) {
      console.error(`[DEEPGRAM_WORKER_LOG][${jobId}] ERROR_DEEPGRAM_API: Deepgram API error:`, JSON.stringify(dgError));
      throw new Error(`Deepgram API Error: ${dgError.message || JSON.stringify(dgError)}`);
    }

    if (!result) {
      console.error(`[DEEPGRAM_WORKER_LOG][${jobId}] ERROR_DEEPGRAM_NO_RESULT: Deepgram transcription result is empty.`);
      throw new Error('Deepgram transcription result is empty or undefined.');
    }
    
    const words: Word[] = [];
    const dgResult: any = result; 
    if (dgResult.results?.utterances && dgResult.results.utterances.length > 0) {
        dgResult.results.utterances.forEach((utterance: any) => { 
            utterance.words?.forEach((dgWord: any) => { 
                words.push({
                    text: dgWord.word,
                    start: dgWord.start,
                    end: dgWord.end,
                    confidence: dgWord.confidence,
                    speaker: utterance.speaker,
                    punctuated_word: dgWord.punctuated_word || dgWord.word,
                });
            });
        });
    } else if (dgResult.results?.channels && dgResult.results.channels[0]?.alternatives && dgResult.results.channels[0].alternatives[0]?.words) {
        dgResult.results.channels[0].alternatives[0].words.forEach((dgWord: any) => {
             words.push({
                text: dgWord.word,
                start: dgWord.start,
                end: dgWord.end,
                confidence: dgWord.confidence,
                speaker: dgWord.speaker, 
                punctuated_word: dgWord.punctuated_word || dgWord.word,
            });
        });
    }

    if (words.length === 0) {
        console.warn(`[DEEPGRAM_WORKER_LOG][${jobId}] WARN_NO_WORDS_TRANSCRIBED: No words extracted. Deepgram raw result (summary):`, JSON.stringify(result, null, 2).substring(0, 1000) + "...");
    }
    
    const finalTranscript: Transcript = { words };

    console.log(`[DEEPGRAM_WORKER_LOG][${jobId}] STEP_TRANSCRIPTION_SUCCESS: Word count: ${words.length}. Updating Firestore.`);
    await jobRef.update({
      status: 'COMPLETED' as JobStatus,
      transcript: finalTranscript,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      workerCompletedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`[DEEPGRAM_WORKER_LOG][${jobId}] SUCCESS_JOB_COMPLETED: Job completed and Firestore updated.`);
    res.status(200).send({ success: true, message: `Job ${jobId} processed successfully.` });

  } catch (error: any) {
    console.error(`[DEEPGRAM_WORKER_LOG][${jobId}] ERROR_PROCESSING_JOB:`, error.message, error.stack);
    const errorMessage = error.message || 'An unknown error occurred during transcription.';
    try {
      await jobRef.update({
        status: 'FAILED' as JobStatus,
        error: errorMessage,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        workerCompletedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log(`[DEEPGRAM_WORKER_LOG][${jobId}] SUCCESS_JOB_FAILED_STATUS_UPDATED: Firestore updated with FAILED status.`);
    } catch (dbError: any) {
      console.error(`[DEEPGRAM_WORKER_LOG][${jobId}] !!! CRITICAL_ERROR_DB_UPDATE_FAILED: Failed to update job status to FAILED. DB Error:`, dbError.message, dbError.stack);
    }
    res.status(500).send({ success: false, error: `Failed to process job ${jobId}: ${errorMessage}` });
  }
};

console.log('[DEEPGRAM_WORKER_LOG] V8 Corrected END: deepgramTranscriptionWorker function defined and exported. Script load complete.');
