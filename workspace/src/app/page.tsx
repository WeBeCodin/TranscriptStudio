
'use client';

import * as React from 'react';
import { AppHeader } from '@/components/header';
import { VideoUploader } from '@/components/video-uploader';
import { Editor } from '@/components/editor';
import { storage } from '@/lib/firebase';
import { ref, uploadBytesResumable, FirebaseStorageError } from 'firebase/storage';
import { requestTranscriptionAction, suggestHotspotsAction } from '@/app/actions';
import type { BrandOptions, Hotspot, Transcript, TranscriptionJob, JobStatus } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, Timestamp } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';

export default function Home() {
  const [videoFile, setVideoFile] = React.useState<File | null>(null);
  const [videoUrl, setVideoUrl] = React.useState<string | null>(null);
  const [transcript, setTranscript] = React.useState<Transcript | null>(null);
  const [hotspots, setHotspots] = React.useState<Hotspot[] | null>(null);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [processingStatus, setProcessingStatus] = React.useState('');
  const [brandOptions, setBrandOptions] = React.useState<BrandOptions>({
    primaryColor: '#3498DB',
    font: 'Inter',
  });
  const [uploadProgress, setUploadProgress] = React.useState(0);
  const [currentJobId, setCurrentJobId] = React.useState<string | null>(null);
  const [gcsVideoUri, setGcsVideoUri] = React.useState<string | null>(null);
  
  const { toast } = useToast();

  // Firestore listener effect
  React.useEffect(() => {
    if (!currentJobId) return;

    setProcessingStatus('Transcription requested. Waiting for updates...');
    const unsubscribe = onSnapshot(doc(db, "transcriptionJobs", currentJobId), async (jobDoc) => {
      if (jobDoc.exists()) {
        const jobData = jobDoc.data() as Omit<TranscriptionJob, 'id'> & { createdAt: Timestamp, updatedAt: Timestamp };
        setProcessingStatus(`Job ${jobData.status.toLowerCase()}...`);

        switch (jobData.status) {
          case 'PROCESSING':
            setProcessingStatus('AI is processing the video...');
            break;
          case 'COMPLETED':
            if (jobData.transcript) {
              setTranscript(jobData.transcript);
              toast({
                title: "Transcript Generated",
                description: "The transcript is ready.",
              });

              // Proceed to hotspots generation
              setProcessingStatus('Analyzing for hotspots...');
              const fullTranscriptText = jobData.transcript.words.map(w => w.text).join(' ');
              const hotspotsResult = await suggestHotspotsAction({ transcript: fullTranscriptText });

              if (!hotspotsResult.success || !hotspotsResult.data) {
                console.warn('Could not generate hotspots, but continuing.', hotspotsResult.error);
                setHotspots([]);
              } else {
                setHotspots(hotspotsResult.data);
                if (hotspotsResult.data.length > 0) {
                  toast({
                    title: "Hotspots Suggested",
                    description: "AI has identified key moments for you.",
                  });
                }
              }
              setIsProcessing(false); // Entire process finished
              setProcessingStatus('Processing complete!');
              setCurrentJobId(null); // Clear job ID after completion
            } else {
              // Should not happen if status is COMPLETED
              toast({ variant: "destructive", title: "Error", description: "Transcript missing for completed job." });
              setIsProcessing(false);
              setCurrentJobId(null);
            }
            unsubscribe(); // Stop listening once completed
            break;
          case 'FAILED':
            console.error('Transcription job failed:', jobData.error);
            toast({
              variant: "destructive",
              title: "Transcription Failed",
              description: jobData.error || "The AI failed to transcribe the video.",
            });
            resetState(); // Reset relevant parts of state
            unsubscribe(); // Stop listening on failure
            break;
          case 'PENDING':
            setProcessingStatus('Transcription job is pending...');
            break;
        }
      } else {
        console.warn("Job document not found for ID:", currentJobId);
      }
    }, (error) => {
      console.error("Error listening to job updates:", error);
      toast({
        variant: "destructive",
        title: "Connection Error",
        description: "Could not listen for transcription updates.",
      });
      resetState();
    });

    return () => unsubscribe();
  }, [currentJobId, toast]);

  const resetState = (keepVideo: boolean = false) => {
    if (!keepVideo) {
      setVideoFile(null);
      setVideoUrl(null);
    }
    setTranscript(null);
    setHotspots(null);
    setIsProcessing(false);
    setProcessingStatus('');
    setUploadProgress(0);
    setCurrentJobId(null);
    setGcsVideoUri(null);
  };

  const handleFileUpload = async (file: File) => {
    if (isProcessing) return;

    resetState();
    setVideoFile(file);
    setVideoUrl(URL.createObjectURL(file));
    setIsProcessing(true);
    setProcessingStatus('Starting upload...');
    setUploadProgress(0);

    try {
      const gcsUri = await new Promise<string>((resolve, reject) => {
        const storageRef = ref(storage, `videos/${Date.now()}-${file.name}`);
        const uploadTask = uploadBytesResumable(storageRef, file);
        uploadTask.on('state_changed',
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            setUploadProgress(progress);
            setProcessingStatus(`Uploading video... ${Math.round(progress)}%`);
          },
          (error: FirebaseStorageError) => {
            console.error("Firebase Storage Error:", error);
            const message = error.code === 'storage/unauthorized' 
              ? "Permission denied. Please check your Firebase Storage rules."
              : `Upload failed: ${error.message}`;
            reject(new Error(message));
          },
          async () => {
            const gcsPath = `gs://${uploadTask.snapshot.ref.bucket}/${uploadTask.snapshot.ref.fullPath}`;
            setGcsVideoUri(gcsPath);
            resolve(gcsPath);
          }
        );
      });

      setProcessingStatus('Upload complete. Requesting transcript...');
      const jobId = uuidv4();
      const transcriptRequestResult = await requestTranscriptionAction({ gcsUri, jobId });

      if (!transcriptRequestResult?.success || !transcriptRequestResult.jobId) {
        throw new Error(transcriptRequestResult?.error || 'Failed to request transcript generation.');
      }
      
      setCurrentJobId(transcriptRequestResult.jobId);

    } catch (error: any) {
      console.error('File upload or transcription request failed:', error);
      toast({
        variant: "destructive",
        title: "Oh no! Something went wrong.",
        description: error.message || "An unknown error occurred during video processing setup.",
      });
      resetState();
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <AppHeader brandOptions={brandOptions} onBrandOptionsChange={setBrandOptions} onNewVideo={resetState} isEditing={!!videoFile} />
      <main className="flex-grow flex flex-col items-center justify-center p-4 sm:p-6 md:p-8">
        {videoUrl && transcript ? (
          <Editor
            videoUrl={videoUrl}
            transcript={transcript}
            hotspots={hotspots}
            brandOptions={brandOptions}
            gcsVideoUri={gcsVideoUri}
          />
        ) : (
          <VideoUploader onFileUpload={handleFileUpload} isProcessing={isProcessing} status={processingStatus} progress={uploadProgress} />
        )}
      </main>
    </div>
  );
}
