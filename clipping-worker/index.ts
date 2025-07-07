import type { Request, Response } from 'express';
import * as admin from 'firebase-admin';
import { exec } from 'child_process'; // For running FFmpeg
import { promisify } from 'util';
import * as fs from 'fs/promises'; // For file system operations
import * as path from 'path';
import { tmpdir } from 'os'; // To get temporary directory

// Initialize Firebase Admin SDK if not already initialized
if (admin.apps.length === 0) {
  admin.initializeApp();
}
const db = admin.firestore();
const storage = admin.storage().bucket(); // Default bucket

const execPromise = promisify(exec);

interface ClippingWorkerInput {
  jobId: string;
  gcsUri: string;
  startTime: number;
  endTime: number;
  outputFormat?: string; // e.g., 'mp4'
}

// This function would be exported and configured as GCF entry point
// e.g., export const videoClipper = functions.https.onRequest(async (req, res) => { ... });
// For simplicity here, it's a standalone async function.
export async function videoClipperWorker(req: Request, res: Response): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  const { jobId, gcsUri, startTime, endTime, outputFormat = 'mp4' } = req.body as ClippingWorkerInput;

  if (!jobId || !gcsUri || typeof startTime !== 'number' || typeof endTime !== 'number') {
    res.status(400).send('Missing or invalid parameters in request body.');
    return;
  }
   if (startTime >= endTime) {
    res.status(400).send('Start time must be before end time.');
    return;
  }
  if (startTime < 0 || endTime < 0) {
    res.status(400).send('Start and end times must be positive values.');
    return;
  }

  const jobRef = db.collection("clippingJobs").doc(jobId);
  const tempLocalDir = path.join(tmpdir(), `clipper_${jobId}`); // Unique temp directory
  let localInputPath = '';
  let localOutputPath = '';

  try {
    await jobRef.update({
      status: 'PROCESSING',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      processingStartedAt: admin.firestore.FieldValue.serverTimestamp(), // Optional: more detailed timing
    });

    // 1. Create temporary local directory
    await fs.mkdir(tempLocalDir, { recursive: true });

    // 2. Download video from GCS
    const [bucketName, ...filePathParts] = gcsUri.replace('gs://', '').split('/');
    const gcsFilePath = filePathParts.join('/');
    const inputFileName = path.basename(gcsFilePath);
    localInputPath = path.join(tempLocalDir, inputFileName);

    console.log(`[${jobId}] Downloading ${gcsUri} to ${localInputPath}...`);
    await storage.file(gcsFilePath).download({ destination: localInputPath });
    console.log(`[${jobId}] Downloaded ${inputFileName} successfully.`);

    // 3. Execute FFmpeg
    const outputClipFileName = `clip_${path.parse(inputFileName).name}.${outputFormat}`; // Use original name base
    localOutputPath = path.join(tempLocalDir, outputClipFileName);

    // Using -to endTime (absolute timestamp in the video)
    // If endTime is a duration, then -t (endTime - startTime) should be used.
    // Assuming endTime is absolute for now.
    const ffmpegCommand = `ffmpeg -hide_banner -i "${localInputPath}" -ss ${startTime} -to ${endTime} -c copy "${localOutputPath}" -y`;

    console.log(`[${jobId}] Executing FFmpeg: ${ffmpegCommand}`);
    const { stdout, stderr } = await execPromise(ffmpegCommand); // This requires FFmpeg in PATH

    // Basic check for FFmpeg success (output file exists and is non-empty)
    // FFmpeg often writes informational output to stderr.
    // A more robust check involves verifying ffmpeg's exit code or parsing its output.
    try {
        const stats = await fs.stat(localOutputPath);
        if (stats.size === 0) {
            console.error(`[${jobId}] FFmpeg produced an empty output file. Stdout: ${stdout}, Stderr: ${stderr}`);
            throw new Error('FFmpeg produced an empty output file.');
        }
        console.log(`[${jobId}] FFmpeg stdout: ${stdout || 'No stdout'}`);
        console.log(`[${jobId}] FFmpeg stderr: ${stderr || 'No stderr'}`);
    } catch (e: any) {
        console.error(`[${jobId}] FFmpeg execution failed. Error: ${e.message}. Stdout: ${stdout}, Stderr: ${stderr}`);
        throw new Error(`FFmpeg execution failed: ${e.message} (Stderr: ${stderr})`);
    }
    console.log(`[${jobId}] FFmpeg processed ${outputClipFileName} successfully.`);

    // 4. Upload processed clip to GCS
    const destinationGcsPath = `clips/${jobId}/${outputClipFileName}`;
    console.log(`[${jobId}] Uploading ${localOutputPath} to gs://${storage.name}/${destinationGcsPath}...`);
    await storage.upload(localOutputPath, {
      destination: destinationGcsPath,
      metadata: { contentType: `video/${outputFormat}` },
    });
    const clippedVideoGcsUri = `gs://${storage.name}/${destinationGcsPath}`;
    console.log(`[${jobId}] Uploaded ${outputClipFileName} to ${clippedVideoGcsUri} successfully.`);

    // 5. Update Firestore job status to COMPLETED
    await jobRef.update({
      status: 'COMPLETED',
      clippedVideoGcsUri: clippedVideoGcsUri,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      processingEndedAt: admin.firestore.FieldValue.serverTimestamp(), // Optional
    });

    console.log(`[${jobId}] Job completed successfully.`);
    res.status(200).send({ success: true, message: `Job ${jobId} processed.` });

  } catch (error: any) {
    console.error(`[${jobId}] Error processing job:`, error);
    const errorMessage = error.message || 'An unknown error occurred during video clipping.';
    await jobRef.update({
      status: 'FAILED',
      error: errorMessage,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      processingEndedAt: admin.firestore.FieldValue.serverTimestamp(), // Optional
    }).catch(updateError => {
      console.error(`[${jobId}] Failed to update job to FAILED status:`, updateError);
    });
    res.status(500).send({ success: false, error: `Failed to process job ${jobId}: ${errorMessage}` });
  } finally {
    // 6. Cleanup local temporary files
    if (localInputPath) { // Check if path was set
      console.log(`[${jobId}] Cleaning up temporary directory: ${tempLocalDir}`);
      await fs.rm(tempLocalDir, { recursive: true, force: true }).catch(err => console.error(`[${jobId}] Error cleaning up temp directory ${tempLocalDir}:`, err));
    }
  }
}

// Example of how you might export for Firebase Cloud Functions (if not using Cloud Run with Express)
// import * as functions from 'firebase-functions';
// export const videoClipper = functions
//    .runWith({ timeoutSeconds: 540, memory: '2GB' }) // Example: Configure resources
//    .https.onRequest(videoClipperWorker);
// Make sure to adjust region, resources, and trigger type as needed.
// For Cloud Run, you'd typically set up an Express server that uses this worker function.
// For this environment, we are just defining the function. The actual deployment determines how it's triggered.
