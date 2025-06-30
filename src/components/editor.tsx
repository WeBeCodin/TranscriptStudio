'use client';

import * as React from 'react';
import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TranscriptViewer } from '@/components/transcript-viewer';
import type { BrandOptions, Hotspot, Selection, Transcript, Word } from '@/lib/types';
import { formatTime } from '@/lib/utils';
import { Scissors, Download, Sparkles } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface EditorProps {
  videoUrl: string;
  transcript: Transcript;
  hotspots: Hotspot[] | null;
  brandOptions: BrandOptions;
}

export function Editor({ videoUrl, transcript, hotspots, brandOptions }: EditorProps) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const [currentTime, setCurrentTime] = React.useState(0);
  const [selection, setSelection] = React.useState<Selection | null>(null);
  const [allWords, setAllWords] = React.useState<Word[]>([]);

  React.useEffect(() => {
    const words = transcript.segments.flatMap(s => s.words);
    setAllWords(words);
  }, [transcript]);

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleSeek = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      videoRef.current.play();
    }
  };
  
  const handleCreateClip = () => {
    if (!selection) return;
    toast({
      title: "Clip Ready for Download!",
      description: "In a real app, this would be a server-rendered video.",
    });
    // In a real application, this would trigger a backend rendering process.
    // For this prototype, we can simulate a download or show a confirmation.
    console.log('Creating clip from', selection);
  }

  const selectionDuration = selection ? selection.end - selection.start : 0;

  return (
    <div className="w-full max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
      <div className="lg:col-span-2 flex flex-col gap-4 h-full">
        <Card className="flex-grow overflow-hidden shadow-lg">
          <CardContent className="p-0 relative aspect-video">
            <video
              ref={videoRef}
              src={videoUrl}
              className="w-full h-full object-cover"
              controls
              onTimeUpdate={handleTimeUpdate}
            />
            {brandOptions.logo && (
              <div className="absolute bottom-4 right-4 w-24 h-24 p-2 bg-white/50 rounded-md backdrop-blur-sm">
                 <Image src={brandOptions.logo} alt="Brand Logo" layout="fill" objectFit="contain" />
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="shadow-lg">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="text-sm">
                <p className="font-semibold font-headline">Selected Clip</p>
                <p className="text-muted-foreground">
                    {selection ? `${formatTime(selection.start)} - ${formatTime(selection.end)}` : 'No selection'}
                </p>
            </div>
            <div className="flex items-center gap-4">
                <div className="text-right">
                    <p className="font-semibold font-headline">Duration</p>
                    <p className="font-mono text-lg font-medium">{formatTime(selectionDuration)}</p>
                </div>
                <Button onClick={handleCreateClip} disabled={!selection} size="lg">
                    <Scissors className="mr-2 h-5 w-5"/>
                    Create & Download Clip
                </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="lg:col-span-1 h-full">
        <Card className="shadow-lg h-full max-h-[calc(100vh-12rem)]">
          <CardContent className="p-0 h-full">
            <TranscriptViewer
              words={allWords}
              hotspots={hotspots}
              currentTime={currentTime}
              onSeek={handleSeek}
              selection={selection}
              onSelectionChange={setSelection}
              brandOptions={brandOptions}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
