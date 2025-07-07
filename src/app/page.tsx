'use client';

import * as React from 'react';
import { AppHeader } from '@/components/header';
import { VideoUploader } from '@/components/video-uploader';
import { Editor } from '@/components/editor';
import { storage } from '@/lib/firebase';
import { ref, uploadBytesResumable } from 'firebase/storage'; 
import type { FirebaseError } from 'firebase/app'; // Using FirebaseError
import { requestTranscriptionAction, suggestHotspotsAction, ActionResult } from '@/app/actions'; 
import type { BrandOptions, Hotspot, Transcript, TranscriptionJob, SuggestHotspotsOutput } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, Timestamp } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';

export default function Home() {
  const [videoFile, setVideoFile] = React.useState<File | null>(null);
  const [videoUrl, setVideoUrl] = React.useState<string | null>(null); 
  const [gcsVideoUri, setGcsVideoUri] = React.useState<string | null>(null); 
  const [transcript, setTranscript] = React.useState<Transcript | null>(null);
  const [hotspots, setHotspots] = React.useState<Hotspot[] | null>(null);
  const [isProcessing, setIsProcessing] = React.useState(false); 
  const [processingStatus, setProcessingStatus] = React.useState('');
  const [brandOptions, setBrandOptions] = React.useState<BrandOptions>({
    primaryColor: '#3498DB',
    font: 'Inter',
  });
  const [uploadProgress, setUploadProgress] = React.useState(0);
  const [currentTranscriptionJobId, setCurrentTranscriptionJobId] = React.useState<string | null>(null); 
  
  const { toast } = useToast();

  React.useEffect(() => {
    let unsubscribeFromTranscriptionJob: (() => void) | undefined = undefined;
    if (!currentTranscriptionJobId) return;

    setProcessingStatus('Transcription requested. Waiting for updates...');
    unsubscribeFromTranscriptionJob = onSnapshot(doc(db, "transcriptionJobs", currentTranscriptionJobId), async (jobDoc) => {
      if (jobDoc.exists()) {
        const jobData = jobDoc.data() as Omit<TranscriptionJob, 'id' | 'createdAt' | 'updatedAt'> & { createdAt: Timestamp, updatedAt: Timestamp };
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

              setProcessingStatus('Analyzing for hotspots...');
              const fullTranscriptText = jobData.transcript.words.map(w => w.text).join(' ');
              const hotspotsResult = await suggestHotspotsAction({ transcript: fullTranscriptText }) as ActionResult<SuggestHotspotsOutput>;

              if (!hotspotsResult.success || !hotspotsResult.data || hotspotsResult.data.length === 0) { 
                console.warn('Could not generate hotspots or no hotspots found.', hotspotsResult.error);
                setHotspots([]); 
                 if(hotspotsResult.error && hotspotsResult.success === false) { 
                    toast({ variant: "destructive", title: "Hotspot Suggestion Error", description: hotspotsResult.error });
                 }
              } else {
                setHotspots(hotspotsResult.data);
                toast({
                  title: "Hotspots Suggested",
                  description: "AI has identified key moments for you.",
                });
              }
              setIsProcessing(false); 
              setProcessingStatus('Processing complete!');
              setCurrentTranscriptionJobId(null);
            } else {
              toast({ variant: "destructive", title: "Error", description: "Transcript missing for completed job." });
              setIsProcessing(false);
              setCurrentTranscriptionJobId(null);
            }
            if (typeof unsubscribeFromTranscriptionJob === 'function') unsubscribeFromTranscriptionJob();
            break;
          case 'FAILED':
            console.error('Transcription job failed:', jobData.error);
            toast({
              variant: "destructive",
              title: "Transcription Failed",
              description: jobData.error || "The AI failed to transcribe the video.",
            });
            resetState(); 
            if (typeof unsubscribeFromTranscriptionJob === 'function') unsubscribeFromTranscriptionJob();
            break;
          case 'PENDING':
            setProcessingStatus('Transcription job is pending...');
            break;
        }
      } else {
        console.warn("Transcription job document not found for ID:", currentTranscriptionJobId);
        setIsProcessing(false); 
        setCurrentTranscriptionJobId(null);
        if (typeof unsubscribeFromTranscriptionJob === 'function') unsubscribeFromTranscriptionJob();
      }
    }, (error) => {
      console.error("Error listening to transcription job updates:", error);
      toast({
        variant: "destructive",
        title: "Connection Error",
        description: "Could not listen for transcription updates.",
      });
      resetState(); 
    });

    return () => {
        if (typeof unsubscribeFromTranscriptionJob === 'function') unsubscribeFromTranscriptionJob();
    };
  }, [currentTranscriptionJobId, toast]);

  const resetState = (keepVideo: boolean = false) => {
    if (!keepVideo) {
      setVideoFile(null);
      setVideoUrl(null);
      setGcsVideoUri(null);
    }
    setTranscript(null);
    setHotspots(null);
    setIsProcessing(false);
    setProcessingStatus('');
    setUploadProgress(0);
    setCurrentTranscriptionJobId(null); 
  };

  const handleFileUpload = async (file: File) => {
    if (isProcessing && currentTranscriptionJobId) { 
        toast({ title: "Processing...", description: "A video is already being processed for transcription."});
        return;
    }

    resetState(); 
    setVideoFile(file);
    setVideoUrl(URL.createObjectURL(file)); 
    setIsProcessing(true); 
    setProcessingStatus('Starting upload...');
    setUploadProgress(0);
    let uploadedGcsPath = ""; 

    try {
      uploadedGcsPath = await new Promise<string>((resolve, reject) => {
        const storagePath = `videos/${Date.now()}-${file.name}`;
        const fileRef = ref(storage, storagePath);
        const uploadTask = uploadBytesResumable(fileRef, file);

        uploadTask.on(
          'state_changed',
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            setUploadProgress(progress);
            setProcessingStatus(`Uploading video... ${Math.round(progress)}%`);
          },
          (error: FirebaseError) => { 
            console.error("Firebase Storage Error:", error);
            let message = `Upload failed: ${error.message}`;
            if (error.code === 'storage/unauthorized') {
              message = "Permission denied. Please check your Firebase Storage rules.";
            } else if (error.code === 'storage/canceled') {
              message = "Upload canceled.";
            }
            reject(new Error(message));
          },
          async () => {
            const gcsUriToSet = `gs://${uploadTask.snapshot.ref.bucket}/${uploadTask.snapshot.ref.fullPath}`;
            setGcsVideoUri(gcsUriToSet); 
            resolve(gcsUriToSet);
          }
        );
      });
      
      setProcessingStatus('Upload complete. Requesting transcript...');
      const newTranscriptionJobId = uuidv4();
      const transcriptRequestResult = await requestTranscriptionAction({ gcsUri: uploadedGcsPath, jobId: newTranscriptionJobId }) as ActionResult;

      if (!transcriptRequestResult?.success || !transcriptRequestResult.jobId) {
        const errorMessage = transcriptRequestResult?.error || 'Failed to request transcript generation due to an unknown issue.';
        throw new Error(errorMessage);
      }
      setCurrentTranscriptionJobId(transcriptRequestResult.jobId);

    } catch (error: any) {
      console.error('File upload or processing request failed:', error);
      toast({
        variant: "destructive",
        title: "Oh no! Something went wrong.",
        description: error.message || "An unknown error occurred during setup.",
      });
      resetState(); 
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <AppHeader brandOptions={brandOptions} onBrandOptionsChange={setBrandOptions} onNewVideo={() => resetState()} isEditing={!!videoFile} />
      <main className="flex-grow flex flex-col items-center justify-center p-4 sm:p-6 md:p-8">
        {videoUrl && gcsVideoUri ? ( 
          <Editor
            videoUrl={videoUrl}
            gcsVideoUri={gcsVideoUri} 
            transcript={transcript} 
            hotspots={hotspots}
            brandOptions={brandOptions}
          />
        ) : (
          <VideoUploader 
            onFileUpload={handleFileUpload} 
            isProcessing={isProcessing} 
            status={processingStatus} 
            progress={uploadProgress} 
          />
        )}
      </main>
    </div>
  );
}