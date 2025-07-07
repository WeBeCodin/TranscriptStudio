'use client';

import * as React from 'react';
import Image from 'next/image';
import { storage } from '@/lib/firebase'; // For getDownloadURL
import { ref as storageRef, getDownloadURL } from 'firebase/storage'; // For getDownloadURL
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { TranscriptViewer } from '@/components/transcript-viewer';
import type { BrandOptions, Hotspot, Selection, Transcript, Word, ClippingJob } from '@/lib/types'; // Added ClippingJob
import { formatTime, cn } from '@/lib/utils';
import { Scissors, RectangleHorizontal, RectangleVertical, Square, Wand2, RefreshCw, Download } from 'lucide-react'; // Added Download
import { toast } from '@/hooks/use-toast';
import { generateVideoBackgroundAction, requestVideoClipAction } from '@/app/actions'; // Added requestVideoClipAction
import { Slider } from '@/components/ui/slider';
import { db } from '@/lib/firebase'; // Added db for Firestore
import { doc, onSnapshot, Timestamp } from 'firebase/firestore'; // Added Firestore specific imports


interface EditorProps {
  videoUrl: string; // This is the blob URL for local playback
  gcsVideoUri: string | null; // This is the GCS URI for server-side processing
  transcript: Transcript | null; // Made transcript nullable in previous steps
  hotspots: Hotspot[] | null;
  brandOptions: BrandOptions;
}

export function Editor({ videoUrl, transcript, hotspots, brandOptions }: EditorProps) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const [currentTime, setCurrentTime] = React.useState(0);
  const [selection, setSelection] = React.useState<Selection | null>(null);
  const [allWords, setAllWords] = React.useState<Word[]>([]);
  
  const [aspectRatio, setAspectRatio] = React.useState<'original' | 'portrait' | 'square'>('original');
  const [zoom, setZoom] = React.useState(1);
  const [pan, setPan] = React.useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = React.useState(false);
  const [startPanPoint, setStartPanPoint] = React.useState({ x: 0, y: 0 });

  const [fillMode, setFillMode] = React.useState<'black' | 'blur' | 'generative'>('black');
  const [generativeBg, setGenerativeBg] = React.useState<string | null>(null);
  const [isGeneratingBg, setIsGeneratingBg] = React.useState(false);

  // State for clipping
  const [currentClippingJobId, setCurrentClippingJobId] = React.useState<string | null>(null);
  const [isClipping, setIsClipping] = React.useState(false);
  const [clipDownloadUrl, setClipDownloadUrl] = React.useState<string | null>(null);
  const [clippingStatusMessage, setClippingStatusMessage] = React.useState('');


  React.useEffect(() => {
    if (transcript && transcript.words) {
      setAllWords(transcript.words);
    } else {
      setAllWords([]);
    }
  }, [transcript]);
  
  React.useEffect(() => {
    // Reset zoom and pan when aspect ratio changes
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [aspectRatio]);

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
  
  // Firestore listener for clipping job
  React.useEffect(() => {
    if (!currentClippingJobId) return;

    setClippingStatusMessage('Clipping job requested. Waiting for updates...');
    const unsubscribe = onSnapshot(doc(db, "clippingJobs", currentClippingJobId), async (jobDoc) => {
      if (jobDoc.exists()) {
        const jobData = jobDoc.data() as Omit<ClippingJob, 'id'> & { createdAt: Timestamp, updatedAt: Timestamp };
        setClippingStatusMessage(`Clip status: ${jobData.status.toLowerCase()}...`);

        switch (jobData.status) {
          case 'PROCESSING':
            setIsClipping(true);
            setClippingStatusMessage('Your clip is being processed...');
            break;
          case 'COMPLETED':
            if (jobData.clippedVideoGcsUri) {
              try {
                const downloadUrl = await getDownloadURL(storageRef(storage, jobData.clippedVideoGcsUri));
                setClipDownloadUrl(downloadUrl);
                toast({
                  title: "Clip Ready!",
                  description: "Your video clip is ready for download.",
                });
                setClippingStatusMessage('Clip ready for download!');
              } catch (error) {
                console.error("Error getting download URL:", error);
                toast({ variant: "destructive", title: "Error", description: "Could not get clip download URL." });
                setClippingStatusMessage('Error: Could not get download URL.');
              }
            } else {
              toast({ variant: "destructive", title: "Error", description: "Clipping completed but no URI found." });
              setClippingStatusMessage('Error: Clip URI missing.');
            }
            setIsClipping(false);
            setCurrentClippingJobId(null); // Clear job ID
            unsubscribe();
            break;
          case 'FAILED':
            console.error('Clipping job failed:', jobData.error);
            toast({
              variant: "destructive",
              title: "Clipping Failed",
              description: jobData.error || "The video clip could not be generated.",
            });
            setClippingStatusMessage(`Failed: ${jobData.error || "Unknown error"}`);
            setIsClipping(false);
            setCurrentClippingJobId(null); // Clear job ID
            unsubscribe();
            break;
          case 'PENDING':
            setIsClipping(true);
            setClippingStatusMessage('Clip job is pending...');
            break;
        }
      } else {
        console.warn("Clipping job document not found for ID:", currentClippingJobId);
        // Potentially handle this, though it shouldn't happen if created correctly
      }
    }, (error) => {
      console.error("Error listening to clipping job updates:", error);
      toast({
        variant: "destructive",
        title: "Connection Error",
        description: "Could not listen for clipping updates.",
      });
      setIsClipping(false);
      setCurrentClippingJobId(null);
      setClippingStatusMessage('Error: Connection failed.');
    });

    return () => unsubscribe();
  }, [currentClippingJobId, toast]);

  const handleCreateClip = async () => {
    if (!selection || !gcsVideoUri) {
      toast({
        variant: "destructive",
        title: "Cannot Create Clip",
        description: !gcsVideoUri ? "Video GCS URI is missing." : "No portion of the video is selected.",
      });
      return;
    }
    if (isClipping) return;

    setIsClipping(true);
    setClipDownloadUrl(null); // Reset previous download URL
    setClippingStatusMessage('Requesting video clip...');
    toast({
      title: "Requesting Clip...",
      description: "Your video clip request is being sent.",
    });

    try {
      const result = await requestVideoClipAction({
        gcsUri: gcsVideoUri,
        startTime: selection.start,
        endTime: selection.end,
        // outputFormat: 'mp4', // Default is mp4 in action
      });

      if (result.success && result.jobId) {
        setCurrentClippingJobId(result.jobId);
        // useEffect listener will pick up from here
      } else {
        throw new Error(result.error || "Failed to start clipping job.");
      }
    } catch (error: any) {
      console.error("Failed to request video clip:", error);
      toast({
        variant: "destructive",
        title: "Clipping Request Failed",
        description: error.message || "An unknown error occurred.",
      });
      setIsClipping(false);
      setClippingStatusMessage(`Error: ${error.message}`);
    }
  };

  const handlePanMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (zoom <= 1 || aspectRatio === 'original') return;
    e.preventDefault();
    setIsPanning(true);
    setStartPanPoint({
      x: e.clientX - pan.x,
      y: e.clientY - pan.y,
    });
  };

  const handlePanMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isPanning) return;
    e.preventDefault();
    const newPan = {
      x: e.clientX - startPanPoint.x,
      y: e.clientY - startPanPoint.y,
    };
    setPan(newPan);
  };

  const handlePanMouseUp = () => {
    setIsPanning(false);
  };

  const handleGenerateBackground = async () => {
    if (!videoRef.current || isGeneratingBg) return;

    setIsGeneratingBg(true);
    toast({
        title: "Generating background...",
        description: "AI is creating a custom background. This might take a moment.",
    });

    try {
        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Could not get canvas context');
        
        // Seek to the middle of the video for a representative frame
        videoRef.current.currentTime = videoRef.current.duration / 2;
        
        // Wait for the frame to be ready
        await new Promise(resolve => {
          videoRef.current!.onseeked = () => resolve(true);
        });

        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const frameDataUri = canvas.toDataURL('image/jpeg');

        const result = await generateVideoBackgroundAction({ frameDataUri });

        if (result.success && result.data) {
            setGenerativeBg(result.data.backgroundDataUri);
            toast({
                title: "AI Background Generated!",
                description: "Your new background has been applied.",
            });
        } else {
            throw new Error(result.error || 'Failed to generate background.');
        }
    } catch (error) {
        console.error('Generative fill failed:', error);
        toast({
            variant: "destructive",
            title: "Oh no! Background generation failed.",
            description: error instanceof Error ? error.message : "An unknown error occurred.",
        });
        setFillMode('black');
    } finally {
        setIsGeneratingBg(false);
    }
  };

  const selectionDuration = selection ? selection.end - selection.start : 0;

  return (
    <div className="w-full max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
      <div className="lg:col-span-2 flex flex-col gap-4 h-full">
        <div className="flex-grow flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row justify-center items-center gap-4 sm:gap-6 mb-2">
                <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground font-medium">Aspect:</span>
                    <ToggleGroup type="single" variant="outline" size="sm" value={aspectRatio} onValueChange={(v: typeof aspectRatio) => v && setAspectRatio(v)} >
                        <ToggleGroupItem value="original" aria-label="Original"><RectangleHorizontal className="h-5 w-5" /></ToggleGroupItem>
                        <ToggleGroupItem value="portrait" aria-label="Portrait"><RectangleVertical className="h-5 w-5" /></ToggleGroupItem>
                        <ToggleGroupItem value="square" aria-label="Square"><Square className="h-5 w-5" /></ToggleGroupItem>
                    </ToggleGroup>
                </div>
                 <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground font-medium">Fill:</span>
                    <ToggleGroup type="single" variant="outline" size="sm" value={fillMode} onValueChange={(v: typeof fillMode) => v && setFillMode(v)} disabled={aspectRatio === 'original'}>
                        <ToggleGroupItem value="black" aria-label="Black background">Black</ToggleGroupItem>
                        <ToggleGroupItem value="blur" aria-label="Blurred background">Blur</ToggleGroupItem>
                        <ToggleGroupItem value="generative" aria-label="Generative AI background">AI</ToggleGroupItem>
                    </ToggleGroup>
                </div>
                <div className="flex items-center gap-2 w-40">
                    <span className="text-sm text-muted-foreground font-medium">Zoom:</span>
                    <Slider value={[zoom]} onValueChange={([v]) => setZoom(v)} min={1} max={3} step={0.05} disabled={aspectRatio === 'original'}/>
                </div>
            </div>

            {fillMode === 'generative' && aspectRatio !== 'original' && (
                <div className="flex justify-center -mb-2">
                    <Button onClick={handleGenerateBackground} disabled={isGeneratingBg} size="sm" variant="ghost">
                        {isGeneratingBg ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                        {generativeBg ? 'Re-generate AI Background' : 'Generate AI Background'}
                    </Button>
                </div>
            )}

            <Card className="flex-grow overflow-hidden shadow-lg flex items-center justify-center bg-black/90"
              onMouseMove={handlePanMouseMove}
              onMouseUp={handlePanMouseUp}
              onMouseLeave={handlePanMouseUp}
            >
                 <div
                    className={cn(
                        'relative overflow-hidden transition-all duration-300 ease-in-out bg-black',
                        aspectRatio === 'original' && 'w-full aspect-video',
                        aspectRatio === 'portrait' && 'h-full aspect-[9/16]',
                        aspectRatio === 'square' && 'h-full aspect-square',
                    )}
                    style={{ cursor: zoom > 1 && aspectRatio !== 'original' ? (isPanning ? 'grabbing' : 'grab') : 'default' }}
                >
                    {aspectRatio !== 'original' && fillMode === 'blur' && (
                        <video key={`bg-blur-${videoUrl}`} src={videoUrl} className="absolute inset-0 w-full h-full object-cover blur-2xl scale-110 opacity-50" muted loop autoPlay playsInline />
                    )}
                    {aspectRatio !== 'original' && fillMode === 'generative' && generativeBg && (
                         <Image src={generativeBg} alt="AI Generated Background" layout="fill" objectFit="cover" />
                    )}

                    <div
                      className="relative w-full h-full"
                      onMouseDown={handlePanMouseDown}
                    >
                      <div
                          className="w-full h-full transition-transform duration-100 ease-linear"
                          style={{ transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)` }}
                      >
                          <video
                              key={`main-${videoUrl}`}
                              ref={videoRef}
                              src={videoUrl}
                              className="w-full h-full object-contain"
                              onTimeUpdate={handleTimeUpdate}
                              onClick={() => videoRef.current?.paused ? videoRef.current?.play() : videoRef.current?.pause()}
                              playsInline
                          />
                      </div>
                    </div>
                    
                    {brandOptions.logo && (
                        <div className="absolute bottom-4 right-4 w-24 h-24 p-2 bg-white/50 rounded-md backdrop-blur-sm z-10">
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
                {clipDownloadUrl ? (
                  <Button asChild size="lg">
                    <a href={clipDownloadUrl} download target="_blank" rel="noopener noreferrer">
                      <Download className="mr-2 h-5 w-5" />
                      Download Clip
                    </a>
                  </Button>
                ) : (
                  <Button onClick={handleCreateClip} disabled={!selection || isClipping || !gcsVideoUri} size="lg">
                    <Scissors className="mr-2 h-5 w-5"/>
                    {isClipping ? 'Clipping...' : 'Create Clip'}
                  </Button>
                )}
            </div>
          </CardContent>
        </Card>
        {clippingStatusMessage && (
          <p className="text-sm text-muted-foreground text-center mt-2">{clippingStatusMessage}</p>
        )}
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
