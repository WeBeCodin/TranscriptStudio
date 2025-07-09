'use server';

import { generateTranscript, GenerateTranscriptInput, GenerateTranscriptOutput } from '@/ai/flows/generate-transcript';
import { suggestHotspots, SuggestHotspotsInput, SuggestHotspotsOutput } from '@/ai/flows/suggest-hotspots';
import { generateVideoBackground, GenerateVideoBackgroundInput } from '@/ai/flows/generate-video-background';

import { db } from '@/lib/firebase';
import { collection, doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import type { TranscriptionJob, ClippingJob, JobStatus, Transcript } from '@/lib/types'; 
import { v4 as uuidv4 } from 'uuid';

export type ActionResult<TData = null> = {
  success: boolean;
  data?: TData;
  jobId?: string;
  error?: string; 
  debugMessage?: string;
};

export async function generateTranscriptFromGcsAction(input: GenerateTranscriptInput): Promise<ActionResult<GenerateTranscriptOutput>> {
  console.log('[ACTIONS.TS] generateTranscriptFromGcsAction called (likely deprecated). Input:', input);
  try {
    const transcript = await generateTranscript(input);
    return { success: true, data: transcript, debugMessage: "[ACTIONS.TS] generateTranscriptFromGcsAction: Success" };
  } catch (error: any) {
    console.error('[ACTIONS.TS] Critical error in generateTranscriptFromGcsAction. Full error:', error);
    return { 
      success: false, 
      error: `AI transcript generation failed: ${error.message || 'Unknown error'}`,
      debugMessage: `[ACTIONS.TS] generateTranscriptFromGcsAction: FAILED - ${error.message}`
    };
  }
}

interface RequestTranscriptionInput {
  gcsUri: string;
  jobId: string;
}

export async function requestTranscriptionAction(input: RequestTranscriptionInput): Promise<ActionResult> {
  const { gcsUri, jobId } = input;
  console.log(`[ACTIONS.TS][${jobId}] requestTranscriptionAction called. gcsUri: ${gcsUri}`);

  if (!gcsUri || !jobId) {
    const errorMsg = "[ACTIONS.TS] ERROR: Missing GCS URI or Job ID in requestTranscriptionAction.";
    console.error(errorMsg, input);
    return { 
      success: false, 
      error: "Missing GCS URI or Job ID.",
      debugMessage: errorMsg
    };
  }
  
  const gcfTriggerUrl = process.env.GCF_DEEPGRAM_TRANSCRIPTION_TRIGGER_URL; 
  console.log(`[ACTIONS.TS][${jobId}] Using GCF Trigger URL for Deepgram: ${gcfTriggerUrl || 'NOT SET!'}`);

  if (!gcfTriggerUrl) {
    const errorMsg = "[ACTIONS.TS] ERROR: GCF_DEEPGRAM_TRANSCRIPTION_TRIGGER_URL environment variable is not set.";
    console.error(errorMsg);
    return { 
      success: false, 
      error: 'The transcription service (Deepgram worker) is not configured correctly. Please contact support.',
      debugMessage: errorMsg
    };
  }

  try {
    const jobRef = doc(db, "transcriptionJobs", jobId);
    const newJobData: Omit<TranscriptionJob, 'id' | 'transcript' | 'error'> & { createdAt: any; updatedAt: any } = {
      gcsUri,
      status: 'PENDING' as JobStatus,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(jobRef, newJobData);
    console.log(`[ACTIONS.TS][${jobId}] Firestore doc for transcription job created/updated to PENDING.`);

    fetch(gcfTriggerUrl, {
      method: 'POST',
      body: JSON.stringify({ jobId, gcsUri }),
      headers: { 'Content-Type': 'application/json' },
    })
    .then(response => {
      if (!response.ok) {
        response.text().then(text => {
          console.error(`[ACTIONS.TS][${jobId}] ERROR triggering Deepgram GCF. Status: ${response.status}. Body: ${text}`);
        }).catch(textErr => {
          console.error(`[ACTIONS.TS][${jobId}] ERROR triggering Deepgram GCF and failed to parse error body. Status: ${response.status}. Parse Error: ${textErr}`);
        });
      } else {
        console.log(`[ACTIONS.TS][${jobId}] Successfully triggered Deepgram GCF (HTTP call sent).`);
      }
    })
    .catch(triggerError => {
      console.error(`[ACTIONS.TS][${jobId}] NETWORK_ERROR or other issue triggering Deepgram GCF:`, triggerError);
    });

    return { 
      success: true, 
      jobId,
      debugMessage: `[ACTIONS.TS][${jobId}] requestTranscriptionAction: Successfully initiated job and sent trigger to Deepgram GCF.`
    };
  } catch (error: any) {
    console.error(`[ACTIONS.TS][${jobId}] CATCH_ERROR in requestTranscriptionAction (likely Firestore setDoc):`, error.message, error.stack);
    return { 
      success: false, 
      error: error.message || 'Failed to create transcription job in Firestore.',
      debugMessage: `[ACTIONS.TS][${jobId}] requestTranscriptionAction: Firestore setDoc error - ${error.message}`
    };
  }
}

export async function getTranscriptionJobAction(jobId: string): Promise<ActionResult<TranscriptionJob | null>> {
  if (!jobId) {
     return { success: false, error: "Job ID is required.", debugMessage: "[ACTIONS.TS] getTranscriptionJobAction: No Job ID" };
  }
  try {
    const jobRef = doc(db, "transcriptionJobs", jobId);
    const jobSnap = await getDoc(jobRef);
    if (!jobSnap.exists()) {
      return { success: true, data: null, debugMessage: `[ACTIONS.TS] getTranscriptionJobAction: Job ${jobId} not found.` }; 
    }
    const jobDataFromDb = jobSnap.data();
    const typedJob: TranscriptionJob = {
      id: jobSnap.id,
      gcsUri: jobDataFromDb.gcsUri,
      status: jobDataFromDb.status as JobStatus,
      transcript: jobDataFromDb.transcript as Transcript | undefined, 
      error: jobDataFromDb.error as string | undefined, 
      createdAt: jobDataFromDb.createdAt,
      updatedAt: jobDataFromDb.updatedAt,
      workerStartedAt: jobDataFromDb.workerStartedAt,
      workerCompletedAt: jobDataFromDb.workerCompletedAt,
    };
    return { success: true, data: typedJob, debugMessage: `[ACTIONS.TS] getTranscriptionJobAction: Job ${jobId} fetched.` };
  } catch (error: any) {
    console.error(`[ACTIONS.TS] Error fetching transcription job ${jobId}:`, error.message, error.stack);
    return { 
      success: false, 
      error: error.message || `Failed to fetch job ${jobId}.`,
      debugMessage: `[ACTIONS.TS] getTranscriptionJobAction: Error fetching job ${jobId} - ${error.message}`
    };
  }
}

export async function suggestHotspotsAction(input: SuggestHotspotsInput): Promise<ActionResult<SuggestHotspotsOutput>> { 
  console.log('[ACTIONS.TS] suggestHotspotsAction called. Input transcript length:', input.transcript?.length);
  try {
    const hotspotsData = await suggestHotspots(input); 
    if (!hotspotsData) {
        return { success: false, error: 'AI failed to suggest hotspots.', data: [] as SuggestHotspotsOutput, debugMessage: "[ACTIONS.TS] suggestHotspotsAction: Flow returned no data." };
    }
    return { success: true, data: hotspotsData, debugMessage: "[ACTIONS.TS] suggestHotspotsAction: Success" }; 
  } catch (error: any) {
    console.error('[ACTIONS.TS] Error suggesting hotspots:', error.message, error.stack);
    return { 
      success: false, 
      error: error.message || 'Failed to suggest hotspots.',
      data: [] as SuggestHotspotsOutput, 
      debugMessage: `[ACTIONS.TS] suggestHotspotsAction: FAILED - ${error.message}`
    };
  }
}

export async function generateVideoBackgroundAction(input: GenerateVideoBackgroundInput): Promise<ActionResult<{ backgroundDataUri: string }>> { 
    console.log('[ACTIONS.TS] generateVideoBackgroundAction called.');
    let flowResultPayload;
    try {
      flowResultPayload = await generateVideoBackground(input); 
      if (flowResultPayload && typeof flowResultPayload.backgroundDataUri === 'string' && flowResultPayload.backgroundDataUri.startsWith('data:image/')) {
        return { 
          success: true, 
          data: flowResultPayload, 
          debugMessage: "[ACTIONS.TS] generateVideoBackgroundAction: Flow success, valid data URI."
        };
      } else {
        console.error('[ACTIONS.TS] generateVideoBackgroundAction: Flow returned invalid data:', flowResultPayload);
        return {
          success: false,
          error: 'AI flow did not return a valid background image URI.',
          debugMessage: `[ACTIONS.TS] generateVideoBackgroundAction: Flow returned unexpected data: ${JSON.stringify(flowResultPayload)}`
        };
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Unknown error in generateVideoBackground flow.';
      console.error('[ACTIONS.TS] generateVideoBackgroundAction: FAILED in flow call.', error.message, error.stack);
      return { 
        success: false, 
        error: errorMessage,
        debugMessage: `[ACTIONS.TS] generateVideoBackgroundAction: FAILED in flow call. Error: ${errorMessage}. FlowResult (if any): ${JSON.stringify(flowResultPayload)}` 
      };
    }
}

interface RequestVideoClipInput {
  gcsUri: string;
  startTime: number;
  endTime: number;
  outputFormat?: string;
}

export async function requestVideoClipAction(
  input: RequestVideoClipInput
): Promise<ActionResult> { 
  const { gcsUri, startTime, endTime, outputFormat = 'mp4' } = input;
  const jobId = uuidv4(); 
  console.log(`[ACTIONS.TS][${jobId}] requestVideoClipAction called. gcsUri: ${gcsUri}, startTime: ${startTime}, endTime: ${endTime}`);

  if (!gcsUri || typeof startTime !== 'number' || typeof endTime !== 'number') {
    return { success: false, error: "Missing GCS URI, startTime, or endTime." };
  }
  if (startTime >= endTime) {
    return { success: false, error: "Start time must be before end time." };
  }
  if (startTime < 0 || endTime < 0) {
    return { success: false, error: "Start and end times must be non-negative." };
  }

  const gcfClipperTriggerUrl = process.env.GCF_CLIPPER_TRIGGER_URL;
  console.log(`[ACTIONS.TS][${jobId}] Using GCF_CLIPPER_TRIGGER_URL: ${gcfClipperTriggerUrl || 'NOT SET!'}`);

  if (!gcfClipperTriggerUrl) {
    console.error('[ACTIONS.TS] Server configuration error: GCF_CLIPPER_TRIGGER_URL is not set.');
    return {
      success: false,
      error: 'The video clipping service is not configured correctly. Please contact support.',
    };
  }

  try {
    const jobRef = doc(db, "clippingJobs", jobId);
    const newClipJobData: Omit<ClippingJob, 'id' | 'clippedVideoGcsUri' | 'error' | 'userId'> & { createdAt: any; updatedAt: any } = {
      sourceVideoGcsUri: gcsUri,
      startTime,
      endTime,
      outputFormat,
      status: 'PENDING' as JobStatus,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(jobRef, newClipJobData);
    console.log(`[ACTIONS.TS][${jobId}] Firestore doc for clipping job created/updated to PENDING.`);

    fetch(gcfClipperTriggerUrl, {
      method: 'POST',
      body: JSON.stringify({ jobId, gcsUri, startTime, endTime, outputFormat }),
      headers: { 'Content-Type': 'application/json' },
    })
    .then(response => {
      if (!response.ok) {
        response.text().then(text => {
          console.error(`[ACTIONS.TS][${jobId}] Error triggering GCF Clipper. Status: ${response.status}. Body: ${text}`);
        });
      } else {
        console.log(`[ACTIONS.TS][${jobId}] Successfully triggered GCF Clipper.`);
      }
    })
    .catch(triggerError => {
      console.error(`[ACTIONS.TS][${jobId}] Network or other error triggering GCF Clipper:`, triggerError);
    });

    return { 
        success: true, 
        jobId,
        debugMessage: `[ACTIONS.TS][${jobId}] requestVideoClipAction: Successfully initiated job and sent trigger to GCF Clipper.` 
    };
  } catch (error: any) {
    console.error(`[ACTIONS.TS][${jobId}] CATCH_ERROR in requestVideoClipAction (likely Firestore setDoc):`, error.message, error.stack);
    return {
      success: false,
      error: error.message || 'Failed to create video clip job in Firestore.',
      debugMessage: `[ACTIONS.TS][${jobId}] requestVideoClipAction: Firestore setDoc error - ${error.message}`
    };
  }
}