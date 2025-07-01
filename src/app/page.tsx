'use client';

import * as React from 'react';
import { AppHeader } from '@/components/header';
import { VideoUploader } from '@/components/video-uploader';
import { Editor } from '@/components/editor';
import { storage } from '@/lib/firebase';
import { ref, uploadBytesResumable, FirebaseStorageError } from 'firebase/storage';
import { generateTranscriptFromGcsAction, suggestHotspotsAction } from '@/app/actions';
import type { BrandOptions, Hotspot, Transcript } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

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
  
  const { toast } = useToast();

  const resetState = () => {
    setVideoFile(null);
    setVideoUrl(null);
    setTranscript(null);
    setHotspots(null);
    setIsProcessing(false);
    setProcessingStatus('');
    setUploadProgress(0);
  };

  const handleFileUpload = async (file: File) => {
    if (isProcessing) return;

    resetState();
    setVideoFile(file);
    setVideoUrl(URL.createObjectURL(file));
    setIsProcessing(true);
    setProcessingStatus('Starting upload...');

    try {
      const gcsUri = await new Promise<string>((resolve, reject) => {
        const storageRef = ref(storage, `videos/${Date.now()}-${file.name}`);
        const uploadTask = uploadBytesResumable(storageRef, file);

        uploadTask.on(
          'state_changed',
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
          () => {
            const gcsPath = `gs://${uploadTask.snapshot.ref.bucket}/${uploadTask.snapshot.ref.fullPath}`;
            resolve(gcsPath);
          }
        );
      });

      setProcessingStatus('Generating transcript...');
      const transcriptResult = await generateTranscriptFromGcsAction({ gcsUri });

      if (!transcriptResult || !transcriptResult.success || !transcriptResult.data) {
        const errorMessage = (transcriptResult && typeof transcriptResult.error === 'string')
          ? transcriptResult.error
          : 'Failed to generate transcript. Please ensure your API key and Firebase config are correct.';
        throw new Error(errorMessage);
      }
      setTranscript(transcriptResult.data);
      toast({
          title: "Transcript Generated",
          description: "The transcript is ready for editing.",
      });

      setProcessingStatus('Analyzing for hotspots...');
      const fullTranscriptText = transcriptResult.data.words.map(w => w.text).join(' ');
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

      setIsProcessing(false);
      setProcessingStatus('');

    } catch (error: any) {
      console.error('Processing failed:', error);
      toast({
        variant: "destructive",
        title: "Oh no! Something went wrong.",
        description: error instanceof Error ? error.message : "An unknown error occurred during video processing.",
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
          />
        ) : (
          <VideoUploader onFileUpload={handleFileUpload} isProcessing={isProcessing} status={processingStatus} progress={uploadProgress} />
        )}
      </main>
    </div>
  );
}
