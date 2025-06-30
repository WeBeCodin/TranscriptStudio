'use client';

import * as React from 'react';
import { AppHeader } from '@/components/header';
import { VideoUploader } from '@/components/video-uploader';
import { Editor } from '@/components/editor';
import { generateTranscriptAction, suggestHotspotsAction } from '@/app/actions';
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
      // Step 1: "Extract" audio and generate transcript
      // In a real app, you would extract audio properly. Here we simulate it.
      // We will create a dummy data URI as the AI flow expects it.
      // A real implementation would likely use a backend service to extract audio from the video stored in a cloud bucket.
      setProcessingStatus('Generating transcript...');
      const dummyAudioDataUri = 'data:audio/mp3;base64,SUQzBAAAAAAB9B4B'; // Placeholder
      
      const transcriptResult = await generateTranscriptAction({ audioDataUri: dummyAudioDataUri });

      if (!transcriptResult.success || !transcriptResult.data) {
        throw new Error(transcriptResult.error || 'Failed to generate transcript.');
      }
      setTranscript(transcriptResult.data);
      toast({
        title: "Transcript Generated",
        description: "The transcript is ready for editing.",
      });

      // Step 2: Suggest hotspots
      setProcessingStatus('Analyzing for hotspots...');
      const fullTranscriptText = transcriptResult.data.segments.map(s => s.words.map(w => w.text).join(' ')).join('\n');
      const hotspotsResult = await suggestHotspotsAction({ transcript: fullTranscriptText });
      
      if (!hotspotsResult.success || !hotspotsResult.data) {
        console.warn('Could not generate hotspots, but continuing.', hotspotsResult.error);
        setHotspots([]);
      } else {
        setHotspots(hotspotsResult.data);
        toast({
            title: "Hotspots Suggested",
            description: "AI has identified key moments for you.",
        });
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
