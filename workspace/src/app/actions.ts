
'use server';

import { generateTranscript, GenerateTranscriptInput } from '@/ai/flows/generate-transcript';
import { suggestHotspots, SuggestHotspotsInput } from '@/ai/flows/suggest-hotspots';
import { generateVideoBackground, GenerateVideoBackgroundInput } from '@/ai/flows/generate-video-background';

import { db } from '@/lib/firebase';
import { collection, doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import type { TranscriptionJob } from '@/lib/types';

export async function generateTranscriptFromGcsAction(input: GenerateTranscriptInput) {
  try {
    const transcript = await generateTranscript(input);
    return { success: true, data: transcript };
  } catch (error) {
    console.error('A critical error occurred in generateTranscriptFromGcsAction. Full error:', error);
    const clientErrorMessage = 'The AI model failed to process the video. This could be an issue with the file, API permissions, or a temporary service problem. Please check the server logs for details.';
    return { 
      success: false, 
      error: clientErrorMessage
    };
  }
}

interface RequestTranscriptionInput {
  gcsUri: string;
  jobId: string;
}

export async function requestTranscriptionAction(input: RequestTranscriptionInput): Promise<{ success: boolean; jobId?: string; error?: string }> {
  const { gcsUri, jobId } = input;

  if (!gcsUri || !jobId) {
    return { success: false, error: "Missing GCS URI or Job ID." };
  }
  
  // Access the server-side environment variable directly within the action.
  const gcfTriggerUrl = process.env.GCF_TRANSCRIPTION_TRIGGER_URL;

  // Validate the variable's presence at the time of execution.
  if (!gcfTriggerUrl) {
    console.error('Server configuration error: GCF_TRANSCRIPTION_TRIGGER_URL is not set.');
    return { 
      success: false, 
      error: 'The transcription service is not configured correctly. Please contact support.' 
    };
  }

  try {
    const jobRef = doc(db, "transcriptionJobs", jobId);
    
    const newJob: Omit<TranscriptionJob, 'id' | 'transcript' | 'error'> & { createdAt: any; updatedAt: any } = {
      gcsUri,
      status: 'PENDING',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await setDoc(jobRef, newJob);

    // Fire-and-forget the trigger. The GCF will update Firestore.
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
  } catch (error) {
    console.error('Error requesting transcription job:', error);
    const clientErrorMessage = error instanceof Error ? error.message : 'Failed to create transcription job in Firestore.';
    return { 
      success: false, 
      error: clientErrorMessage
    };
  }
}

export async function getTranscriptionJobAction(jobId: string): Promise<{ success: boolean; job?: TranscriptionJob | null; error?: string }> {
  if (!jobId) {
    return { success: false, error: "Job ID is required." };
  }

  try {
    const jobRef = doc(db, "transcriptionJobs", jobId);
    const jobSnap = await getDoc(jobRef);

    if (!jobSnap.exists()) {
      return { success: true, job: null }; // Job not found is a valid case, not an error
    }

    const jobData = jobSnap.data() as Omit<TranscriptionJob, 'id'> & { createdAt: any, updatedAt: any };

    const job: TranscriptionJob = {
      id: jobSnap.id,
      ...jobData,
      createdAt: jobData.createdAt?.toDate ? jobData.createdAt.toDate() : jobData.createdAt,
      updatedAt: jobData.updatedAt?.toDate ? jobData.updatedAt.toDate() : jobData.updatedAt,
    };

    return { success: true, job };
  } catch (error) {
    console.error('Error fetching transcription job:', error);
    const clientErrorMessage = error instanceof Error ? error.message : 'Failed to fetch transcription job from Firestore.';
    return { 
      success: false, 
      error: clientErrorMessage
    };
  }
}

export async function suggestHotspotsAction(input: SuggestHotspotsInput) {
  try {
    const hotspots = await suggestHotspots(input);
    return { success: true, data: hotspots };
  } catch (error) {
    console.error('Error suggesting hotspots:', error);
    return { success: true, data: [] };
  }
}

export async function generateVideoBackgroundAction(input: GenerateVideoBackgroundInput) {
    try {
      const result = await generateVideoBackground(input);
      return { success: true, data: result };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
      return { 
        success: false, 
        error: errorMessage 
      };
    }
}
