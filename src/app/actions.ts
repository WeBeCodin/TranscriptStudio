'use server';

import { generateTranscript, GenerateTranscriptInput, GenerateTranscriptOutput } from '@/ai/flows/generate-transcript';
import { suggestHotspots, SuggestHotspotsInput, SuggestHotspotsOutput } from '@/ai/flows/suggest-hotspots';
import { generateVideoBackground, GenerateVideoBackgroundInput } from '@/ai/flows/generate-video-background';

import { db } from '@/lib/firebase';
import { collection, doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import type { TranscriptionJob, ClippingJob, JobStatus, Transcript } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';

// Consistent return type for all actions
export type ActionResult<TData = null> = {
  success: boolean;
  data?: TData;
  jobId?: string;
  error?: string;
  debugMessage?: string;
};

// This original GCS-based transcription action might be deprecated or used as a fallback.
export async function generateTranscriptFromGcsAction(input: GenerateTranscriptInput): Promise<ActionResult<GenerateTranscriptOutput>> {
  console.log('[ACTIONS.TS] generateTranscriptFromGcsAction (Genkit Flow) called. Input:', input);
  try {
    const transcriptOutput = await generateTranscript(input);
    return {
      success: true,
      data: transcriptOutput,
      debugMessage: "[ACTIONS.TS] generateTranscriptFromGcsAction: Success via Genkit flow."
    };
  } catch (error: any) {
    console.error('[ACTIONS.TS] Critical error in generateTranscriptFromGcsAction (Genkit Flow). Full error:', error);
    return {
      success: false,
      error: `AI transcript generation via Genkit flow failed: ${error.message || 'Unknown error'}`,
      debugMessage: `[ACTIONS.TS] generateTranscriptFromGcsAction (Genkit Flow): FAILED - ${error.message}`
    };
  }
}

interface RequestTranscriptionInput {
  jobId: string;
}

export async function requestTranscriptionAction(input: RequestTranscriptionInput): Promise<{ success: boolean; jobId?: string; error?: string }> {
  const gcfTriggerUrl = process.env.GCF_TRANSCRIPTION_TRIGGER_URL;

  if (!gcfTriggerUrl) {
    console.error('Server configuration error: GCF_TRANSCRIPTION_TRIGGER_URL is not set.');
    return {
      success: false,
      error: 'The transcription service is not configured correctly. Please contact support.',
    };
  }

  // ...rest of the function logic using gcfTriggerUrl
  // Example:
  // fetch(gcfTriggerUrl, {... });

  return { success: true, jobId: input.jobId }; // Example success response
}


export async function getTranscriptionJobAction(jobId: string): Promise<ActionResult<TranscriptionJob | null>> {
  console.log(`[ACTIONS.TS][${jobId}] getTranscriptionJobAction called.`);
  if (!jobId) {
     return { success: false, error: "Job ID is required.", debugMessage: "[ACTIONS.TS] getTranscriptionJobAction: No Job ID provided." };
  }
  try {
    const jobRef = doc(db, "transcriptionJobs", jobId);
    const jobSnap = await getDoc(jobRef);
    if (!jobSnap.exists()) {
      return { success: true, data: null, debugMessage: `[ACTIONS.TS] getTranscriptionJobAction: Job ${jobId} not found in Firestore.` };
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
    return { success: true, data: typedJob, debugMessage: `[ACTIONS.TS] getTranscriptionJobAction: Job ${jobId} successfully fetched.` };
  } catch (error: any) {
    console.error(`[ACTIONS.TS][${jobId}] Error fetching transcription job from Firestore:`, error.message, error.stack);
    return {
      success: false,
      error: error.message || `Failed to fetch job ${jobId} from Firestore.`,
      debugMessage: `[ACTIONS.TS] getTranscriptionJobAction: Error fetching job ${jobId} - ${error.message}`
    };
  }
}

export async function suggestHotspotsAction(input: SuggestHotspotsInput): Promise<ActionResult<SuggestHotspotsOutput>> {
  console.log('[ACTIONS.TS] suggestHotspotsAction called. Input transcript length:', input.transcript?.length);
  try {
    const hotspotsData = await suggestHotspots(input);
    if (!hotspotsData || hotspotsData.length === 0) {
        return {
          success: true,
          data: [] as SuggestHotspotsOutput,
          debugMessage: "[ACTIONS.TS] suggestHotspotsAction: Flow returned no hotspots or empty data."
        };
    }
    return { success: true, data: hotspotsData, debugMessage: "[ACTIONS.TS] suggestHotspotsAction: Success, hotspots found." };
  } catch (error: any) {
    console.error('[ACTIONS.TS] Error in suggestHotspotsAction Genkit flow:', error.message, error.stack);
    return {
      success: false,
      error: error.message || 'Failed to suggest hotspots due to an AI flow error.',
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
        console.error('[ACTIONS.TS] generateVideoBackgroundAction: Flow returned invalid or missing data URI:', flowResultPayload);
        return {
          success: false,
          error: 'AI background generation flow did not return a valid image data URI.',
          debugMessage: `[ACTIONS.TS] generateVideoBackgroundAction: Flow returned unexpected data: ${JSON.stringify(flowResultPayload)}`
        };
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Unknown error in generateVideoBackground Genkit flow.';
      console.error('[ACTIONS.TS] generateVideoBackgroundAction: FAILED in Genkit flow call.', error.message, error.stack);
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
    const errorMsg = "[ACTIONS.TS] ERROR: Missing GCS URI, startTime, or endTime in requestVideoClipAction.";
    console.error(errorMsg, input);
    return { success: false, error: "Missing GCS URI, startTime, or endTime.", debugMessage: errorMsg };
  }
  if (startTime >= endTime) {
    const errorMsg = `[ACTIONS.TS] ERROR: Start time (${startTime}) must be before end time (${endTime}) in requestVideoClipAction.`;
    console.error(errorMsg, input);
    return { success: false, error: "Start time must be before end time.", debugMessage: errorMsg };
  }
  if (startTime < 0 || endTime < 0) {
    const errorMsg = `[ACTIONS.TS] ERROR: Start and end times must be non-negative in requestVideoClipAction. Got start: ${startTime}, end: ${endTime}`;
    console.error(errorMsg, input);
    return { success: false, error: "Start and end times must be non-negative.", debugMessage: errorMsg };
  }

  const gcfClipperTriggerUrl = process.env.GCF_CLIPPER_TRIGGER_URL;
  console.log(`[ACTIONS.TS][${jobId}] Using GCF_CLIPPER_TRIGGER_URL: ${gcfClipperTriggerUrl || 'NOT SET!'}`);

  if (!gcfClipperTriggerUrl) {
    const errorMsg = "[ACTIONS.TS] ERROR: GCF_CLIPPER_TRIGGER_URL environment variable is not set.";
    console.error(errorMsg);
    return {
      success: false,
      error: 'The video clipping service GCF trigger URL is not configured correctly on the server. Please contact support.',
      debugMessage: errorMsg,
    };
  }

  try {
    const jobRef = doc(db, "clippingJobs", jobId);
    const newClipJobData: Omit<ClippingJob, 'id' | 'clippedVideoGcsUri' | 'error' | 'userId' | 'workerStartedAt' | 'workerCompletedAt'> & { createdAt: any; updatedAt: any } = {
      sourceVideoGcsUri: gcsUri,
      startTime,
      endTime,
      outputFormat,
      status: 'PENDING' as JobStatus,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(jobRef, newClipJobData);
    console.log(`[ACTIONS.TS][${jobId}] Firestore doc for clipping job (ID: ${jobId}) created/updated to PENDING.`);

    fetch(gcfClipperTriggerUrl, {
      method: 'POST',
      body: JSON.stringify({ jobId, gcsUri, startTime, endTime, outputFormat }),
      headers: { 'Content-Type': 'application/json' },
    })
    .then(response => {
      if (!response.ok) {
        response.text().then(text => {
          console.error(`[ACTIONS.TS][${jobId}] ERROR triggering GCF Clipper. Status: ${response.status}. Body: ${text}`);
        });
      } else {
        console.log(`[ACTIONS.TS][${jobId}] Successfully sent trigger to GCF Clipper (HTTP call successful).`);
      }
    })
    .catch(triggerError => {
      console.error(`[ACTIONS.TS][${jobId}] NETWORK_ERROR or other issue triggering GCF Clipper:`, triggerError);
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
      error: error.message || 'Failed to create video clip job document in Firestore.',
      debugMessage: `[ACTIONS.TS][${jobId}] requestVideoClipAction: Firestore setDoc error - ${error.message}`
    };
  }
}
