'use client';

import * as React from 'react';
import { AppHeader } from '@/components/header';
import { VideoUploader } from '@/components/video-uploader';
import { Editor } from '@/components/editor';
import { storage } from '@/lib/firebase';
import { ref, uploadBytesResumable } from 'firebase/storage'; 
import type { FirebaseError } from 'firebase/app';
import { Button } from '@/components/ui/button'; 
import { Loader2 } from 'lucide-react'; 
import { 
  requestTranscriptionAction, 
  suggestHotspotsAction, 
  ActionResult 
} from '@/app/actions'; 
import type { BrandOptions, Hotspot, Transcript, TranscriptionJob, SuggestHotspotsOutput } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, Timestamp } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';

export default function Home() {
  const [videoFile, setVideoFile] = React.useState<File | null>(null);
  const [videoUrl, setVideoUrl] = React.useState<string | null>(null); 
  const [gcsUploadPath, setGcsUploadPath] = React.useState<string | null>(null); 
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

    if (currentTranscriptionJobId) {
      console.log("[PAGE.TSX] useEffect: ATTACHING Firestore listener for currentTranscriptionJobId:", currentTranscriptionJobId);
      setIsProcessing(true); 
      setProcessingStatus('Transcription job active. Waiting for updates...');
      
      unsubscribeFromTranscriptionJob = onSnapshot(doc(db, "transcriptionJobs", currentTranscriptionJobId), async (jobDoc) => {
        console.log("[PAGE.TSX] Firestore onSnapshot callback. JobId:", currentTranscriptionJobId, "Exists:", jobDoc.exists());
        if (jobDoc.exists()) {
          const jobData = jobDoc.data() as Omit<TranscriptionJob, 'id' | 'createdAt' | 'updatedAt'> & { createdAt: Timestamp, updatedAt: Timestamp };
          const currentStatusDisplay = `Job status: ${jobData.status?.toLowerCase() || 'unknown'}...`;
          setProcessingStatus(currentStatusDisplay);

          switch (jobData.status) {
            case 'PROCESSING':
              if(!isProcessing) setIsProcessing(true); 
              setProcessingStatus('AI is processing video for transcription...');
              break;
            case 'COMPLETED':
              console.log(`[PAGE.TSX] Job ${currentTranscriptionJobId} COMPLETED. Transcript data:`, jobData.transcript);
              if (jobData.transcript) {
                setTranscript(jobData.transcript);
                toast({ title: "Transcript Generated", description: "The transcript is ready." });
                
                setProcessingStatus('Analyzing for hotspots...');
                const fullTranscriptText = jobData.transcript.words.map(w => w.text).join(' ');
                try {
                  const hotspotsResult = await suggestHotspotsAction({ transcript: fullTranscriptText }) as ActionResult<SuggestHotspotsOutput>;
                  console.log(`[PAGE.TSX] Hotspots result for job ${currentTranscriptionJobId}:`, hotspotsResult);
                  if (hotspotsResult.success && hotspotsResult.data) {
                    setHotspots(hotspotsResult.data);
                    if (hotspotsResult.data.length > 0) toast({ title: "Hotspots Suggested" });
                    else toast({title: "Hotspots", description: "No specific hotspots suggested by AI."});
                  } else {
                    console.warn('Hotspot generation failed or no hotspots found:', hotspotsResult.error, hotspotsResult.debugMessage);
                    toast({ variant: "destructive", title: "Hotspot Suggestion", description: hotspotsResult.error || "No hotspots suggested or an error occurred."});
                    setHotspots([]); 
                  }
                } catch (e:any) { 
                  console.error('suggestHotspotsAction threw an error:',e); 
                  toast({variant:"destructive", title:"Hotspot Call Error", description:e.message}); 
                  setHotspots([]);
                }
                setProcessingStatus('All processing complete!');
              } else {
                toast({ variant: "destructive", title: "Error", description: "Transcript missing for completed job." });
                setProcessingStatus('Error: Transcript data missing on completed job.');
              }
              setIsProcessing(false); 
              setCurrentTranscriptionJobId(null); 
              break;
            case 'FAILED':
              console.error(`[PAGE.TSX] Job ${currentTranscriptionJobId} FAILED. Error:`, jobData.error);
              toast({
                variant: "destructive",
                title: "Transcription Failed",
                description: jobData.error || "The AI failed to transcribe the video.",
              });
              setIsProcessing(false);
              setProcessingStatus(`Transcription failed: ${jobData.error || "Unknown error"}`);
              setCurrentTranscriptionJobId(null); 
              break;
            case 'PENDING':
              if(!isProcessing) setIsProcessing(true);
              setProcessingStatus('Transcription job is pending...');
              break;
            default:
              setProcessingStatus(`Job status: ${jobData.status || 'unknown'}`);
              break;
          }
        } else {
          console.warn("[PAGE.TSX] Transcription job document not found for ID:", currentTranscriptionJobId, "while listener was active.");
          toast({variant:"destructive", title:"Error", description:"Transcription job tracking lost (document disappeared)."});
          setIsProcessing(false); 
          setProcessingStatus('Error: Job details disappeared.');
          setCurrentTranscriptionJobId(null); 
        }
      }, (error) => {
        console.error("[PAGE.TSX] Error listening to transcription job updates for ID:", currentTranscriptionJobId, error);
        toast({ variant: "destructive", title: "Connection Error", description: "Could not listen for transcription updates."});
        setIsProcessing(false);
        setProcessingStatus('Error listening for transcription updates.');
        setCurrentTranscriptionJobId(null); 
      });

      return () => {
        if (typeof unsubscribeFromTranscriptionJob === 'function') {
          console.log("[PAGE.TSX] useEffect: CLEANUP Unsubscribing Firestore listener for:", currentTranscriptionJobId);
          unsubscribeFromTranscriptionJob();
        }
      };
    } else {
      if (isProcessing && !processingStatus.startsWith("Uploading")) {
        console.log("[PAGE.TSX] useEffect: No currentTranscriptionJobId, ensuring isProcessing is false (unless uploading).");
        setIsProcessing(false);
      }
    }
  }, [currentTranscriptionJobId, toast]);

  const resetState = (keepVideo: boolean = false) => {
    console.log("[PAGE.TSX] resetState called. keepVideo:", keepVideo);
    if (!keepVideo) {
      setVideoFile(null);
      setVideoUrl(null);
      setGcsUploadPath(null);
    }
    setTranscript(null);
    setHotspots(null);
    setIsProcessing(false);
    setProcessingStatus('');
    setUploadProgress(0);
    if (currentTranscriptionJobId) { 
        console.log("[PAGE.TSX] Clearing currentTranscriptionJobId in resetState. Was:", currentTranscriptionJobId);
    }
    setCurrentTranscriptionJobId(null); 
  };

  const handleFileUpload = async (file: File) => {
    if (isProcessing && processingStatus.startsWith("Uploading")) {
        toast({ title: "Upload in Progress", description: "Please wait for the current upload to complete."});
        return;
    }
    console.log("[CLIENT-SIDE /app/page.tsx] handleFileUpload: Process started for file:", file.name);
    resetState(); 
    setVideoFile(file);
    setVideoUrl(URL.createObjectURL(file)); 
    setIsProcessing(true); 
    setProcessingStatus('Starting GCS upload...');
    setUploadProgress(0);

    try {
      console.log("[CLIENT-SIDE /app/page.tsx] handleFileUpload: Attempting GCS upload.");
      const gcsPathValue = await new Promise<string>((resolve, reject) => {
        const storagePath = `videos/${Date.now()}-${file.name}`;
        const fileRef = ref(storage, storagePath);
        const uploadTask = uploadBytesResumable(fileRef, file);

        uploadTask.on('state_changed',
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            setUploadProgress(progress);
            setProcessingStatus(`Uploading to GCS... ${Math.round(progress)}%`);
          },
          (error: FirebaseError) => { 
            console.error("[CLIENT-SIDE /app/page.tsx] Firebase Storage Error during upload:", error);
            let message = `Upload failed: ${error.message}`;
            if (error.code === 'storage/unauthorized') {
              message = "Permission denied. Check Storage rules.";
            } else if (error.code === 'storage/canceled') {
              message = "Upload canceled.";
            }
            reject(new Error(message));
          },
          async () => { 
            const path = `gs://${uploadTask.snapshot.ref.bucket}/${uploadTask.snapshot.ref.fullPath}`;
            console.log("[CLIENT-SIDE /app/page.tsx] GCS Upload successful. GCS Path:", path);
            resolve(path);
          }
        );
      });

      setGcsUploadPath(gcsPathValue);
      setProcessingStatus(`Upload complete! Video ready.`); 
      setIsProcessing(false); 
      toast({ title: "Upload Successful", description: "Video is uploaded. Click 'Transcribe Video' to proceed." });
      console.log("[CLIENT-SIDE /app/page.tsx] Video uploaded. Transcription will be manually triggered via button.");

    } catch (error: any) {
      console.error('[CLIENT-SIDE /app/page.tsx] Error in handleFileUpload (during GCS upload):', error);
      console.error('[CLIENT-SIDE /app/page.tsx] Actual error object caught during GCS upload:', error);
      toast({
        variant: "destructive",
        title: "Upload Failed",
        description: error.message || "An unknown error occurred during video upload.",
      });
      resetState(); 
    }
  };

  const handleRequestTranscription = async () => {
    if (!gcsUploadPath) {
      toast({ title: "No Video Uploaded", description: "Please upload a video first.", variant: "destructive"});
      return;
    }
    if (isProcessing && currentTranscriptionJobId) { 
        toast({ title: "Processing...", description: "A transcription job is already in progress."});
        return;
    }
    console.log("[CLIENT-SIDE /app/page.tsx] handleRequestTranscription: Called. GCS Path:", gcsUploadPath);
    setIsProcessing(true); 
    setProcessingStatus('Requesting transcription...');
    setTranscript(null); 
    setHotspots(null);   
    const newJobId = uuidv4();

    try {
        console.log("[CLIENT-SIDE /app/page.tsx] Attempting to call requestTranscriptionAction with jobId:", newJobId, "and gcsUri:", gcsUploadPath);
        const result = await requestTranscriptionAction({ gcsUri: gcsUploadPath, jobId: newJobId }) as ActionResult;
        
        console.log("[CLIENT-SIDE /app/page.tsx] requestTranscriptionAction raw result:", result);

        if (result && result.debugMessage) { 
            console.log("%c[CLIENT-SIDE DEBUG] Server Action Debug Message:", "color: blue; font-weight: bold;", result.debugMessage);
        }
        if (result?.success && result.jobId) {
            console.log("[CLIENT-SIDE /app/page.tsx] requestTranscriptionAction call successful. Setting currentTranscriptionJobId:", result.jobId);
            setCurrentTranscriptionJobId(result.jobId); 
        } else {
            console.error("[CLIENT-SIDE /app/page.tsx] requestTranscriptionAction call FAILED. Full result:", result);
            throw new Error(result?.error || result?.debugMessage || 'Failed to start transcription job.');
        }
    } catch (error: any) {
        console.error('[CLIENT-SIDE /app/page.tsx] Error in handleRequestTranscription catch block:', error);
        console.error('[CLIENT-SIDE /app/page.tsx] Actual error object caught in handleRequestTranscription:', error);
        toast({ variant: "destructive", title: "Transcription Request Failed", description: error.message || "Could not start transcription." });
        setIsProcessing(false); 
        setProcessingStatus('Transcription request failed.');
        setCurrentTranscriptionJobId(null); 
    }
  };

  const showEditorComponent = videoUrl && gcsUploadPath;
  const showTranscribeButton = showEditorComponent && !transcript && !currentTranscriptionJobId && !isProcessing;
  const showUploaderComponent = !showEditorComponent;
  const showProcessingSpinner = isProcessing && !processingStatus.startsWith("Uploading to GCS...");

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <AppHeader brandOptions={brandOptions} onBrandOptionsChange={setBrandOptions} onNewVideo={() => resetState(false)} isEditing={!!videoFile} />
      <main className="flex-grow flex flex-col items-center justify-center p-4 sm:p-6 md:p-8">
        
        {showTranscribeButton && (
          <Button onClick={handleRequestTranscription} className="my-4">
            Transcribe Video
          </Button>
        )}
        
        {showEditorComponent ? (
          <Editor
            videoUrl={videoUrl} 
            gcsVideoUri={gcsUploadPath} 
            transcript={transcript} 
            hotspots={hotspots}   
            brandOptions={brandOptions}
          />
        ) : (
          <VideoUploader 
            onFileUpload={handleFileUpload} 
            isProcessing={isProcessing && processingStatus.startsWith("Uploading to GCS...")} 
            status={processingStatus} 
            progress={uploadProgress} 
          />
        )}
        
        {showProcessingSpinner && (
            <div className="mt-4 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
                <p className="mt-2 text-sm text-muted-foreground">{processingStatus || "Processing..."}</p>
            </div>
        )}
      </main>
    </div>
  );
}
