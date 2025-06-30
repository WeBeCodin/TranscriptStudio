'use client';

import * as React from 'react';
import { AppHeader } from '@/components/header';
import { VideoUploader } from '@/components/video-uploader';
import { Editor } from '@/components/editor';
import { generateTranscriptAction, suggestHotspotsAction } from '@/app/actions';
import type { BrandOptions, Hotspot, Transcript } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

const fileToDataUri = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

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
  
  const { toast } = useToast();

  const resetState = () => {
    setVideoFile(null);
    setVideoUrl(null);
    setTranscript(null);
    setHotspots(null);
    setIsProcessing(false);
    setProcessingStatus('');
  };

  const handleFileUpload = async (file: File) => {
    if (isProcessing) return;

    resetState();
    setVideoFile(file);
    setVideoUrl(URL.createObjectURL(file));
    setIsProcessing(true);

    try {
      // Step 1: Convert file to data URI and generate transcript
      setProcessingStatus('Generating transcript...');
      const mediaDataUri = await fileToDataUri(file);
      
      const transcriptResult = await generateTranscriptAction({ mediaDataUri });

      if (!transcriptResult.success || !transcriptResult.data) {
        throw new Error(transcriptResult.error || 'Failed to generate transcript. Please ensure your API key is configured.');
      }
      setTranscript(transcriptResult.data);
      toast({
        title: "Transcript Generated",
        description: "The transcript is ready for editing.",
      });

      // Step 2: Suggest hotspots
      setProcessingStatus('Analyzing for hotspots...');
      const fullTranscriptText = transcriptResult.data.words.map(w => w.text).join(' ');
      const hotspotsResult = await suggestHotspotsAction({ transcript: fullTranscriptText });
      
      if (!hotspotsResult.success || !hotspotsResult.data) {
        // This is non-critical, so just warn and continue.
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

    } catch (error) {
      console.error('Processing failed:', error);
      toast({
        variant: "destructive",
        title: "Oh no! Something went wrong.",
        description: error instanceof Error ? error.message : "An unknown error occurred during video processing.",
      });
      resetState();
    } finally {
      setIsProcessing(false);
      setProcessingStatus('');
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
          <VideoUploader onFileUpload={handleFileUpload} isProcessing={isProcessing} status={processingStatus} />
        )}
      </main>
    </div>
  );
}
