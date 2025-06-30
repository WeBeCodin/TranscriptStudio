'use client';

import * as React from 'react';
import { AppHeader } from '@/components/header';
import { VideoUploader } from '@/components/video-uploader';
import { Editor } from '@/components/editor';
import { storage } from '@/lib/firebase';
import { ref, uploadBytesResumable } from 'firebase/storage';
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

    try {
      // Step 1: Upload to Firebase Storage
      setProcessingStatus(`Uploading video... 0%`);
      const storageRef = ref(storage, `videos/${Date.now()}-${file.name}`);
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on('state_changed',
          (snapshot) => {
              const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              setUploadProgress(progress);
              setProcessingStatus(`Uploading video... ${Math.round(progress)}%`);
          },
          (error) => {
              // Firebase storage upload error
              console.error('Upload failed:', error);
              toast({
                  variant: "destructive",
                  title: "Upload Failed",
                  description: `Could not upload to Firebase Storage. Please check your storage rules and Firebase configuration.`,
              });
              resetState();
          },
          async () => {
              // Upload complete, now run Genkit flows
              try {
                  setUploadProgress(100);
                  const gcsUri = `gs://${uploadTask.snapshot.ref.bucket}/${uploadTask.snapshot.ref.fullPath}`;
                  
                  // Step 2: Generate transcript from GCS URI
                  setProcessingStatus('Generating transcript...');
                  const transcriptResult = await generateTranscriptFromGcsAction({ gcsUri });

                  if (!transcriptResult.success || !transcriptResult.data) {
                      throw new Error(transcriptResult.error || 'Failed to generate transcript. Please ensure your API key and Firebase config are correct.');
                  }
                  setTranscript(transcriptResult.data);
                  toast({
                      title: "Transcript Generated",
                      description: "The transcript is ready for editing.",
                  });

                  // Step 3: Suggest hotspots
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

              } catch (flowError) {
                  // Error during Genkit flow processing
                  console.error('Processing failed after upload:', flowError);
                  toast({
                      variant: "destructive",
                      title: "Oh no! Something went wrong.",
                      description: flowError instanceof Error ? flowError.message : "An unknown error occurred during video processing.",
                  });
                  resetState();
              }
          }
      );

    } catch (error) {
      // Initial upload setup error
      console.error('Processing setup failed:', error);
      toast({
        variant: "destructive",
        title: "Oh no! Something went wrong.",
        description: error instanceof Error ? error.message : "An unknown error occurred during video processing setup.",
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
