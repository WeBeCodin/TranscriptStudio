'use server';

import { generateTranscript, GenerateTranscriptInput } from '@/ai/flows/generate-transcript';
import { suggestHotspots, SuggestHotspotsInput } from '@/ai/flows/suggest-hotspots';
import { generateVideoBackground, GenerateVideoBackgroundInput } from '@/ai/flows/generate-video-background';

export async function generateTranscriptFromGcsAction(input: GenerateTranscriptInput) {
  if (!process.env.GOOGLE_API_KEY) {
    const errorMessage = "The GOOGLE_API_KEY is missing from your .env file. Please get a key from Google AI Studio and add it to your server environment, then restart the development server.";
    console.error(errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }

  try {
    const transcript = await generateTranscript(input);
    return { success: true, data: transcript };
  } catch (error) {
    // Log the detailed error on the server for debugging purposes.
    console.error('A critical error occurred in generateTranscriptFromGcsAction. Full error:', error);
    
    // Return a generic, safe error message to the client.
    // This avoids any potential issues with serializing complex error objects from the server to the client.
    const clientErrorMessage = 'The AI model failed to process the video. This could be an issue with the file, API permissions, or a temporary service problem. Please check the server logs for details.';
    
    return { 
      success: false, 
      error: clientErrorMessage
    };
  }
}

import { db } from '@/lib/firebase';
import { collection, doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore'; // Added getDoc
import type { TranscriptionJob } from '@/lib/types';

interface RequestTranscriptionInput {
  gcsUri: string;
  jobId: string;
}

export async function requestTranscriptionAction(input: RequestTranscriptionInput): Promise<{ success: boolean; jobId?: string; error?: string }> {
  if (!process.env.GOOGLE_API_KEY) { // Keep this check as it's generally good for AI related actions
    const errorMessage = "The GOOGLE_API_KEY is missing from your .env file.";
    console.error(errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }

  const { gcsUri, jobId } = input;

  if (!gcsUri || !jobId) {
    return { success: false, error: "Missing GCS URI or Job ID." };
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

    const gcfTriggerUrl = process.env.GCF_TRANSCRIPTION_TRIGGER_URL;
    if (gcfTriggerUrl) {
      // Fire-and-forget the trigger. The GCF will update Firestore.
      fetch(gcfTriggerUrl, {
        method: 'POST',
        body: JSON.stringify({ jobId, gcsUri }),
        headers: { 'Content-Type': 'application/json' },
      })
      .then(response => {
        if (!response.ok) {
          // Log an error if the trigger itself failed, but don't block client response.
          // The client will rely on Firestore updates for the job status.
          response.text().then(text => { // Use text() to avoid JSON parse error if response is not JSON
            console.error(`Error triggering GCF for job ${jobId}. Status: ${response.status}. Body: ${text}`);
          });
        } else {
          console.log(`Successfully triggered GCF for job ${jobId}`);
        }
      })
      .catch(triggerError => {
        console.error(`Network or other error triggering GCF for job ${jobId}:`, triggerError);
        // Note: This error won't be directly sent to the client from here.
        // The job will remain PENDING in Firestore, and might need manual retry or timeout handling.
      });
    } else {
      console.warn("GCF_TRANSCRIPTION_TRIGGER_URL environment variable is not set. Transcription worker will not be triggered automatically.");
      // To proceed without a real GCF for local testing, you would need to manually
      // run/simulate the worker logic after a job is created in Firestore.
      // For now, we'll assume the user will set this up for a deployed environment.
    }

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

    const jobData = jobSnap.data() as Omit<TranscriptionJob, 'id'> & { createdAt: any, updatedAt: any }; // Timestamps are initially serverTimestamps

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
    // It's better to return an empty array than mock data if hotspots fail.
    // The UI can gracefully handle no hotspots.
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