'use client';

import * as React from 'react';
import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { TranscriptViewer } from '@/components/transcript-viewer';
import type { BrandOptions, Hotspot, Selection, Transcript, Word } from '@/lib/types';
import { formatTime, cn } from '@/lib/utils';
import { Scissors, RectangleHorizontal, RectangleVertical, Square } from 'lucide-react';
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
  const [aspectRatio, setAspectRatio] = React.useState<'original' | 'portrait' | 'square'>('original');

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
        <div className="flex-grow flex flex-col gap-4">
            <div className="flex justify-center items-center gap-2">
                <span className="text-sm text-muted-foreground font-medium">Aspect Ratio:</span>
                <ToggleGroup
                    type="single"
                    variant="outline"
                    value={aspectRatio}
                    onValueChange={(value: 'original' | 'portrait' | 'square') => {
                        if (value) setAspectRatio(value);
                    }}
                    aria-label="Video aspect ratio"
                >
                    <ToggleGroupItem value="original" aria-label="Original aspect ratio">
                        <RectangleHorizontal className="h-5 w-5" />
                    </ToggleGroupItem>
                    <ToggleGroupItem value="portrait" aria-label="Portrait 9:16">
                        <RectangleVertical className="h-5 w-5" />
                    </ToggleGroupItem>
                    <ToggleGroupItem value="square" aria-label="Square 1:1">
                        <Square className="h-5 w-5" />
                    </ToggleGroupItem>
                </ToggleGroup>
            </div>
            <Card className="flex-grow overflow-hidden shadow-lg flex items-center justify-center bg-black/90">
                 <div
                    className={cn(
                    'relative overflow-hidden transition-all duration-300 ease-in-out bg-black',
                    aspectRatio === 'original' && 'w-full aspect-video',
                    aspectRatio === 'portrait' && 'h-full aspect-[9/16]',
                    aspectRatio === 'square' && 'h-full aspect-square'
                    )}
                >
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
                </div>
            </Card>
        </div>
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
