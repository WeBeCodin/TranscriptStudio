console.log('[GCF_CLIPPER_LOG] START: Loading clipping-worker/index.ts (v6 - Signed URL Fix)');

import type { Request, Response } from 'express';
import * as admin from 'firebase-admin';
import { Bucket, GetSignedUrlConfig } from '@google-cloud/storage';

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import { tmpdir } from 'os';

console.log('[GCF_CLIPPER_LOG] STEP 1: Basic imports successful.');

export type JobStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

let db: admin.firestore.Firestore;
let defaultStorageBucket: Bucket;
const TARGET_BUCKET_NAME = 'transcript-studio-4drhv.appspot.com'; 

try {
  if (admin.apps.length === 0) {
    console.log(`[GCF_CLIPPER_LOG] STEP 2: Initializing Firebase Admin SDK with explicit bucket for upload destination: ${TARGET_BUCKET_NAME}...`);
    admin.initializeApp({
      storageBucket: TARGET_BUCKET_NAME,
    });
    console.log('[GCF_CLIPPER_LOG] STEP 3: Firebase Admin SDK initialized successfully.');
  } else {
    console.log('[GCF_CLIPPER_LOG] STEP 2-ALT: Firebase Admin SDK already initialized.');
  }

  db = admin.firestore();
  console.log('[GCF_CLIPPER_LOG] STEP 4: Firestore instance obtained.');

  defaultStorageBucket = admin.storage().bucket(TARGET_BUCKET_NAME);
  console.log(`[GCF_CLIPPER_LOG] STEP 5: Default upload storage bucket instance obtained for '${defaultStorageBucket.name}'.`);

} catch (e: any) {
  console.error('[GCF_CLIPPER_LOG] !!! CRITICAL ERROR during initial setup:', e.message, e.stack);
  process.exit(1); 
}

const execPromise = promisify(exec);
console.log('[GCF_CLIPPER_LOG] STEP 6: execPromise created.');

interface ClippingWorkerInput {
  jobId: string;
  gcsUri: string;
  startTime: number;
  endTime: number;
  outputFormat?: string;
}

export const videoClipperWorker = async (req: Request, res: Response): Promise<void> => {
  const receivedJobId = req.body?.jobId || 'unknown_job_at_invocation';
  console.log(`[GCF_CLIPPER_LOG][${receivedJobId}] videoClipperWorker invoked with body:`, JSON.stringify(req.body));

  if (!db || !defaultStorageBucket) {
      console.error(`[GCF_CLIPPER_LOG][${receivedJobId}] CRITICAL: Firestore DB or Storage Bucket not initialized!`);
      res.status(500).send({ success: false, error: 'Internal Server Error: Critical services not initialized.' });
      return;
  }

  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  const { 
    jobId, 
    gcsUri, 
    startTime, 
    endTime, 
    outputFormat = 'mp4' 
  } = req.body as ClippingWorkerInput;

  if (!jobId || !gcsUri || typeof startTime !== 'number' || typeof endTime !== 'number') {
    console.error(`[${jobId}] Missing or invalid parameters:`, req.body);
    res.status(400).send('Missing or invalid parameters in request body.');
    return;
  }
   if (startTime >= endTime) {
    console.error(`[${jobId}] Invalid time range: startTime ${startTime} >= endTime ${endTime}`);
    res.status(400).send('Start time must be before end time.');
    return;
  }
  if (startTime < 0) { 
    console.error(`[${jobId}] Invalid time range: startTime ${startTime} < 0`);
    res.status(400).send('Start time must be non-negative.');
    return;
  }

  const jobRef = db.collection("clippingJobs").doc(jobId);
  const uniqueTempDirName = `clipper_${jobId}_${Date.now()}`;
  const tempLocalDir = path.join(tmpdir(), uniqueTempDirName);
  let localOutputPath = '';

  try {
    await jobRef.update({
      status: 'PROCESSING' as JobStatus,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      workerStartedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log(`[${jobId}] Status set to PROCESSING.`);

    await fs.mkdir(tempLocalDir, { recursive: true });
    console.log(`[${jobId}] Created temp directory: ${tempLocalDir}`);

    const gcsUriMatch = gcsUri.match(/^gs:\/\/([^\/]+)\/(.+)$/);
    if (!gcsUriMatch) {
      throw new Error(`Invalid GCS URI format: ${gcsUri}. Expected gs://BUCKET_NAME/FILE_PATH`);
    }
    const sourceBucketName = gcsUriMatch[1];
    const gcsFilePath = gcsUriMatch[2];
    
    // Create a client for the specific bucket from the URI to generate the signed URL
    const sourceBucket = admin.storage().bucket(sourceBucketName);
    const fileInBucket = sourceBucket.file(gcsFilePath);

    const signedUrlConfig: GetSignedUrlConfig = {
      action: 'read',
      expires: Date.now() + 15 * 60 * 1000, // 15 minutes
    };
    const [signedUrl] = await fileInBucket.getSignedUrl(signedUrlConfig);
    console.log(`[${jobId}] Generated signed URL for FFmpeg input.`);
    
    const outputClipFileName = `clip_${path.basename(gcsFilePath)}`;
    localOutputPath = path.join(tempLocalDir, outputClipFileName);
    
    const duration = endTime - startTime;
    if (duration <= 0) {
        throw new Error(`Invalid duration calculated: ${duration}. endTime (${endTime}) must be greater than startTime (${startTime}).`);
    }
    // FFmpeg now uses the public signed URL as input
    const ffmpegCommand = `ffmpeg -y -hide_banner -i "${signedUrl}" -ss ${startTime} -t ${duration} "${localOutputPath}"`;
    
    console.log(`[${jobId}] Executing FFmpeg: ${ffmpegCommand}`);
    
    const execTimeout = 480000; 
    const { stdout, stderr } = await Promise.race([
        execPromise(ffmpegCommand, { timeout: execTimeout - 30000 }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('FFmpeg execution timed out')), execTimeout - 30000))
    ]) as { stdout: string; stderr: string };

    console.log(`[${jobId}] FFmpeg stdout:`, stdout || '(empty)');
    console.log(`[${jobId}] FFmpeg stderr:`, stderr || '(empty)');

    try {
      const stats = await fs.stat(localOutputPath);
      if (stats.size === 0) {
        console.error(`[${jobId}] FFmpeg produced an empty output file. Stderr for FFmpeg: ${stderr}`);
        throw new Error('FFmpeg produced an empty output file. Check stderr for details: ' + stderr);
      }
    } catch (e: any) {
      console.error(`[${jobId}] FFmpeg output file validation failed (fs.stat error or empty file). Error: ${e.message}. Stderr for FFmpeg: ${stderr}`);
      throw new Error(`FFmpeg output file validation failed: ${e.message} (Stderr for FFmpeg: ${stderr})`);
    }
    console.log(`[${jobId}] FFmpeg processed ${outputClipFileName} successfully.`);

    const destinationGcsPath = `clips/${jobId}/${outputClipFileName}`;
    console.log(`[${jobId}] Uploading ${localOutputPath} to gs://${defaultStorageBucket.name}/${destinationGcsPath}...`);
    await defaultStorageBucket.upload(localOutputPath, {
      destination: destinationGcsPath,
      metadata: { contentType: `video/${outputFormat}` }, 
    });
    const clippedVideoGcsUri = `gs://${defaultStorageBucket.name}/${destinationGcsPath}`;
    console.log(`[${jobId}] Uploaded ${outputClipFileName} to ${clippedVideoGcsUri} successfully.`);

    await jobRef.update({
      status: 'COMPLETED' as JobStatus,
      clippedVideoGcsUri: clippedVideoGcsUri,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      workerCompletedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`[${jobId}] Job completed successfully.`);
    res.status(200).send({ success: true, message: `Job ${jobId} processed.` });

  } catch (error: any) {
    console.error(`[${jobId}] Error processing job:`, error, error.stack);
    const errorMessage = error.message || 'An unknown error occurred during video clipping.';
    try {
      await jobRef.update({
        status: 'FAILED' as JobStatus,
        error: errorMessage,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        workerCompletedAt: admin.firestore.FieldValue.serverTimestamp(), 
      });
    } catch (dbError) {
        console.error(`[${jobId}] CRITICAL: Failed to update job status to FAILED in Firestore after primary error:`, dbError);
    }
    res.status(500).send({ success: false, error: `Failed to process job ${jobId}: ${errorMessage}` });
  } finally {
    if (tempLocalDir && tempLocalDir !== path.join(tmpdir())) { 
      console.log(`[${jobId}] Cleaning up temporary directory: ${tempLocalDir}`);
      await fs.rm(tempLocalDir, { recursive: true, force: true }).catch(err => console.error(`[${jobId}] Error cleaning up temp directory ${tempLocalDir}:`, err));
    }
  }
};
console.log('[GCF_CLIPPER_LOG] END: videoClipperWorker function defined and exported. Script load complete. (v6 - Signed URL Fix)');