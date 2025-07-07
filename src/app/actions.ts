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
  try {
    const transcript = await generateTranscript(input);
    return { success: true, data: transcript, debugMessage: "[ACTIONS.TS] generateTranscriptFromGcsAction: Success" };
  } catch (error: any) {
    console.error('A critical error occurred in generateTranscriptFromGcsAction. Full error:', error);
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

  if (!gcsUri || !jobId) {
    return { success: false, error: "Missing GCS URI or Job ID." };
  }
  
  const gcfTriggerUrl = process.env.GCF_TRANSCRIPTION_TRIGGER_URL;

  if (!gcfTriggerUrl) {
    console.error('Server configuration error: GCF_TRANSCRIPTION_TRIGGER_URL is not set.');
    return { 
      success: false, 
      error: 'The transcription service is not configured correctly. Please contact support.' 
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

    fetch(gcfTriggerUrl, {
      method: 'POST',
      body: JSON.stringify({ jobId, gcsUri }),
      headers: { 'Content-Type': 'application/json' },
    })
    .then(response => {
      if (!response.ok) {
        response.text().then(text => {
          console.error(`Error triggering GCF for job ${jobId}. Status: ${response.status}. Body: ${text}`);
        });
      } else {
        console.log(`Successfully triggered GCF for job ${jobId}`);
      }
    })
    .catch(triggerError => {
      console.error(`Network or other error triggering GCF for job ${jobId}:`, triggerError);
    });

    return { success: true, jobId };
  } catch (error: any) {
    console.error('Error requesting transcription job:', error);
    const clientErrorMessage = error instanceof Error ? error.message : 'Failed to create transcription job in Firestore.';
    return { 
      success: false, 
      error: clientErrorMessage
    };
  }
}

export async function getTranscriptionJobAction(jobId: string): Promise<ActionResult<TranscriptionJob | null>> {
  if (!jobId) {
     return { success: false, error: "Job ID is required." };
  }
  try {
    const jobRef = doc(db, "transcriptionJobs", jobId);
    const jobSnap = await getDoc(jobRef);
    if (!jobSnap.exists()) {
      return { success: true, data: null, debugMessage: `[ACTIONS.TS] getTranscriptionJobAction: Job ${jobId} not found.` }; 
    }
    const jobDataFromDb = jobSnap.data() as Omit<TranscriptionJob, 'id' | 'createdAt' | 'updatedAt' | 'transcript' | 'error'> & { 
        gcsUri: string; status: JobStatus; createdAt: any; updatedAt: any; transcript?: Transcript; error?: string; 
    };
    
    const typedJob: TranscriptionJob = {
      id: jobSnap.id,
      gcsUri: jobDataFromDb.gcsUri,
      status: jobDataFromDb.status,
      transcript: jobDataFromDb.transcript, 
      error: jobDataFromDb.error, 
      createdAt: jobDataFromDb.createdAt?.toDate ? jobDataFromDb.createdAt.toDate() : jobDataFromDb.createdAt,
      updatedAt: jobDataFromDb.updatedAt?.toDate ? jobDataFromDb.updatedAt.toDate() : jobDataFromDb.updatedAt,
    };
    return { success: true, data: typedJob, debugMessage: `[ACTIONS.TS] getTranscriptionJobAction: Job ${jobId} fetched.` };
  } catch (error: any) {
    return { 
      success: false, 
      error: error.message || `Failed to fetch job ${jobId}.`,
      debugMessage: `[ACTIONS.TS] getTranscriptionJobAction: Error fetching job ${jobId} - ${error.message}`
    };
  }
}

export async function suggestHotspotsAction(input: SuggestHotspotsInput): Promise<ActionResult<SuggestHotspotsOutput>> { 
  try {
    const hotspotsData = await suggestHotspots(input); 
    if (!hotspotsData) {
        return { success: false, error: 'AI failed to suggest hotspots.', data: [] as SuggestHotspotsOutput };
    }
    return { success: true, data: hotspotsData, debugMessage: "[ACTIONS.TS] suggestHotspotsAction: Success" }; 
  } catch (error: any) {
    console.error('Error suggesting hotspots:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to suggest hotspots.',
      data: [] as SuggestHotspotsOutput, 
      debugMessage: `[ACTIONS.TS] suggestHotspotsAction: FAILED - ${error.message}`
    };
  }
}

export async function generateVideoBackgroundAction(input: GenerateVideoBackgroundInput): Promise<ActionResult<{ backgroundDataUri: string }>> { 
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
        return {
          success: false,
          error: 'AI flow did not return a valid background image URI.',
          debugMessage: `[ACTIONS.TS] generateVideoBackgroundAction: Flow returned unexpected data: ${JSON.stringify(flowResultPayload)}`
        };
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Unknown error in generateVideoBackground flow.';
      return { 
        success: false, 
        error: errorMessage,
        debugMessage: `[ACTIONS.TS] generateVideoBackgroundAction: FAILED in flow call. Error: ${errorMessage}. Stack: ${error.stack}. FlowResult (if any): ${JSON.stringify(flowResultPayload)}` 
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

  if (!gcsUri || typeof startTime !== 'number' || typeof endTime !== 'number') {
    return { success: false, error: "Missing GCS URI, startTime, or endTime." };
  }
  if (startTime >= endTime) {
    return { success: false, error: "Start time must be before end time." };
  }
  if (startTime < 0 || endTime < 0) {
    return { success: false, error: "Start and end times must be positive." };
  }

  const gcfClipperTriggerUrl = process.env.GCF_CLIPPER_TRIGGER_URL;

  if (!gcfClipperTriggerUrl) {
    console.error('Server configuration error: GCF_CLIPPER_TRIGGER_URL is not set.');
    return {
      success: false,
      error: 'The video clipping service is not configured correctly. Please contact support.',
    };
  }

  const jobId = uuidv4();

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

    fetch(gcfClipperTriggerUrl, {
      method: 'POST',
      body: JSON.stringify({ 
        jobId, 
        gcsUri, 
        startTime, 
        endTime, 
        outputFormat 
      }),
      headers: { 'Content-Type': 'application/json' },
    })
    .then(response => {
      if (!response.ok) {
        response.text().then(text => {
          console.error(`Error triggering GCF Clipper for job ${jobId}. Status: ${response.status}. Body: ${text}`);
        });
      } else {
        console.log(`Successfully triggered GCF Clipper for job ${jobId}`);
      }
    })
    .catch(triggerError => {
      console.error(`Network or other error triggering GCF Clipper for job ${jobId}:`, triggerError);
    });

    return { success: true, jobId };
  } catch (error: any) {
    console.error('Error requesting video clip job:', error);
    const clientErrorMessage = error instanceof Error ? error.message : 'Failed to create video clip job in Firestore.';
    return {
      success: false,
      error: clientErrorMessage,
    };
  }
}