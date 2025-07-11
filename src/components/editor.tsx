'use client';

import * as React from 'react';
import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { TranscriptViewer } from '@/components/transcript-viewer';
import type { BrandOptions, Hotspot, Selection, Transcript, Word, JobStatus, ClippingJob } from '@/lib/types';
import { formatTime, cn } from '@/lib/utils';
import { Scissors, RectangleHorizontal, RectangleVertical, Square, Wand2, RefreshCw, Download, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { generateVideoBackgroundAction, requestVideoClipAction, ActionResult } from '@/app/actions';
import { Slider } from '@/components/ui/slider';
import { getStorage, ref as storageFileRef, getDownloadURL } from 'firebase/storage';
import { db } from '@/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

interface EditorProps {
  videoUrl: string | null;
  gcsVideoUri: string | null;
  transcript: Transcript | null;
  hotspots: Hotspot[] | null;
  brandOptions: BrandOptions;
}

export function Editor({ videoUrl, gcsVideoUri, transcript, hotspots, brandOptions }: EditorProps) {
  console.log("[EDITOR.TSX] Props received:", { videoUrlGcs: gcsVideoUri, transcriptProp: transcript, hotspotsProp: hotspots });

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

  const [isClipping, setIsClipping] = React.useState(false);
  const [clippingStatus, setClippingStatus] = React.useState('');
  const [currentClippingJobId, setCurrentClippingJobId] = React.useState<string | null>(null);
  const [finalClipUrl, setFinalClipUrl] = React.useState<string | null>(null);

  const { toast } = useToast();

  React.useEffect(() => {
    console.log("[EDITOR.TSX] useEffect for transcript processing. Received transcript prop:", transcript);
    if (transcript && transcript.words) {
      setAllWords(transcript.words);
      console.log("[EDITOR.TSX] allWords state updated with", transcript.words.length, "words.");
    } else {
      setAllWords([]);
      console.log("[EDITOR.TSX] allWords state reset as transcript is null or has no words.");
    }
  }, [transcript]);

  React.useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [aspectRatio]);

  React.useEffect(() => {
    const videoElement = videoRef.current;
    if (videoElement && gcsVideoUri && !selection && !transcript) {
      const setTestSelection = () => {
        if (videoElement.duration && isFinite(videoElement.duration) && videoElement.duration > 0) {
          let defaultStartTime = 1;
          let defaultEndTime = Math.min(5, videoElement.duration - 0.01);

          if (videoElement.duration <= 1.01) {
            defaultStartTime = 0;
            defaultEndTime = videoElement.duration;
          } else if (videoElement.duration < 5) {
             defaultStartTime = 1;
             if(defaultStartTime >= videoElement.duration) defaultStartTime = 0;
             defaultEndTime = videoElement.duration;
          }

          if (defaultEndTime > defaultStartTime) {
            console.log(`[EDITOR.TSX] Setting default selection for clipping test: ${defaultStartTime.toFixed(2)}s to ${defaultEndTime.toFixed(2)}s`);
            setSelection({ start: defaultStartTime, end: defaultEndTime });
            toast({ title: "Test Selection Set", description: `Default selection: ${defaultStartTime.toFixed(1)}s to ${defaultEndTime.toFixed(1)}s. Adjust via transcript.`, duration: 4000 });
          } else if (videoElement.duration > 0) {
            console.log(`[EDITOR.TSX] Video too short for specific default. Selecting full video: 0s to ${videoElement.duration.toFixed(2)}s`);
            setSelection({ start: 0, end: videoElement.duration });
             toast({ title: "Test Selection Set", description: `Video short. Default: Full duration. Adjust via transcript.`, duration: 4000 });
          } else {
            console.warn("[EDITOR.TSX] Video duration still 0 or invalid, cannot set default selection yet.");
          }
        } else {
          console.log("[EDITOR.TSX] Video duration not yet available or invalid for default selection when attempting to set.");
        }
      };

      if (videoElement.readyState >= HTMLMediaElement.HAVE_METADATA) {
        setTestSelection();
      } else {
        const handleMetadataLoaded = () => {
          console.log("[EDITOR.TSX] 'loadedmetadata' event fired for default selection.");
          setTestSelection();
          videoElement.removeEventListener('loadedmetadata', handleMetadataLoaded);
        };
        videoElement.addEventListener('loadedmetadata', handleMetadataLoaded);
        return () => {
          videoElement.removeEventListener('loadedmetadata', handleMetadataLoaded);
        };
      }
    }
  }, [gcsVideoUri, videoUrl, selection, transcript, toast]);

  React.useEffect(() => {
    if (!currentClippingJobId) {
      setFinalClipUrl(null);
      return;
    }

    setIsClipping(true);
    setClippingStatus('Clipping job started. Waiting for updates...');
    setFinalClipUrl(null);

    console.log(`[EDITOR.TSX] Attaching Firestore listener for clipping job: ${currentClippingJobId}`);
    const unsubscribeClipping = onSnapshot(doc(db, "clippingJobs", currentClippingJobId), async (jobDoc) => {
      console.log(`[EDITOR.TSX] Clipping job update for ${currentClippingJobId}:`, jobDoc.data());
      if (jobDoc.exists()) {
        const jobData = jobDoc.data() as ClippingJob;
        setClippingStatus(`Clip status: ${jobData.status.toLowerCase()}...`);

        if (jobData.status === 'COMPLETED') {
          if (jobData.clippedVideoGcsUri) {
            try {
              const fStorage = getStorage();
              const clipFileRef = storageFileRef(fStorage, jobData.clippedVideoGcsUri);
              const downloadUrl = await getDownloadURL(clipFileRef);
              setFinalClipUrl(downloadUrl);
              toast({ title: "Clip Ready!", description: "Your video clip has been processed." });
              console.log(`[EDITOR.TSX] Clip ready. Download URL: ${downloadUrl}`);
            } catch (error) {
              console.error("[EDITOR.TSX] Error getting download URL for clip:", error);
              toast({ variant: "destructive", title: "Error", description: "Could not get clip download URL." });
              setFinalClipUrl(null);
            }
          } else {
            toast({ variant: "destructive", title: "Error", description: "Clipping completed but no video URL found." });
            setFinalClipUrl(null);
          }
          setIsClipping(false);
          setCurrentClippingJobId(null);
        } else if (jobData.status === 'FAILED') {
          toast({ variant: "destructive", title: "Clipping Failed", description: jobData.error || "An unknown error occurred during clipping." });
          setIsClipping(false);
          setCurrentClippingJobId(null);
          setFinalClipUrl(null);
        }
      } else {
        console.warn(`[EDITOR.TSX] Clipping job document ${currentClippingJobId} not found while listener was active.`);
      }
    });

    return () => {
      console.log(`[EDITOR.TSX] Detaching Firestore listener for clipping job: ${currentClippingJobId}`);
      unsubscribeClipping();
    };
  }, [currentClippingJobId, toast]);

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleSeek = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
  };

  const handleCreateClip = async () => {
    if (!selection) {
      toast({ title: "No Selection", description: "Please select a portion of the video to clip, or wait for default selection.", variant: "destructive" });
      return;
    }
    if (!gcsVideoUri) {
      toast({ title: "Video Not Processed", description: "Source video GCS URI is missing. Please re-upload.", variant: "destructive" });
      return;
    }
    if (isClipping) {
      toast({ title: "Processing...", description: "A clipping job is already in progress."});
      return;
    }

    console.log(`[EDITOR.TSX] Requesting clip for ${gcsVideoUri} from ${selection.start}s to ${selection.end}s`);
    setIsClipping(true);
    setClippingStatus('Requesting video clip...');
    setFinalClipUrl(null);

    try {
      const result = await requestVideoClipAction({
        gcsUri: gcsVideoUri,
        startTime: selection.start,
        endTime: selection.end,
      }) as ActionResult;

      if (result.success && result.jobId) {
        setCurrentClippingJobId(result.jobId);
        toast({ title: "Clipping Job Started", description: `Job ID: ${result.jobId}. Waiting for completion...` });
      } else {
        throw new Error(result.error || result.debugMessage || "Failed to start clipping job. No specific error from action.");
      }
    } catch (error: any) {
      console.error("[EDITOR.TSX] Error calling requestVideoClipAction:", error);
      toast({ variant: "destructive", title: "Clipping Request Failed", description: error.message });
      setIsClipping(false);
      setClippingStatus('Clipping request failed.');
    }
  };

  const handlePanMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (zoom <= 1 || aspectRatio === 'original') return;
    e.preventDefault();
    setIsPanning(true);
    setStartPanPoint({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handlePanMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isPanning) return;
    e.preventDefault();
    setPan({ x: e.clientX - startPanPoint.x, y: e.clientY - startPanPoint.y });
  };

  const handlePanMouseUp = () => {
    setIsPanning(false);
  };

  const handleGenerateBackground = async () => {
    if (!videoRef.current || isGeneratingBg) return;
    setIsGeneratingBg(true);
    toast({ title: "Generating background..." });
    try {
        const videoElement = videoRef.current;
        await new Promise<void>((resolve, reject) => {
            if (videoElement.readyState >= HTMLMediaElement.HAVE_METADATA) resolve();
            else {
                videoElement.onloadedmetadata = () => resolve();
                videoElement.onerror = () => reject(new Error("Video metadata failed to load for background generation."));
            }
        });
        if (!videoElement.videoWidth || !videoElement.videoHeight || videoElement.videoWidth === 0 || videoElement.videoHeight === 0) {
          throw new Error("Video dimensions are not available or invalid for background generation.");
        }
        const canvas = document.createElement('canvas');
        canvas.width = videoElement.videoWidth;
        canvas.height = videoElement.videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Could not get canvas context for background generation.');

        let seekTime = 0;
        if (videoElement.duration && isFinite(videoElement.duration) && videoElement.duration > 0) {
            seekTime = videoElement.duration / 2;
        }
        videoElement.currentTime = seekTime;

        await new Promise<void>((resolve, reject) => {
            if (videoElement.currentTime === seekTime || videoElement.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
                resolve();
                return;
            }
            videoElement.onseeked = () => resolve();
            const seekTimeout = setTimeout(() => {
                console.warn("[EDITOR.TSX] Seek timeout during background generation, attempting to draw with current frame.");
                resolve();
            }, 1500);
            videoElement.onerror = () => { clearTimeout(seekTimeout); reject(new Error("Video seek failed for background generation."));}
        });

        ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
        const frameDataUri = canvas.toDataURL('image/jpeg');

        const result = await generateVideoBackgroundAction({ frameDataUri }) as ActionResult<{ backgroundDataUri: string }>;

        if (result.success && result.data && result.data.backgroundDataUri) {
            setGenerativeBg(result.data.backgroundDataUri);
            toast({ title: "AI Background Generated!" });
        } else {
            throw new Error(result.error || result.debugMessage || 'AI background generation flow failed to return a valid image data URI.');
        }
    } catch (error: any) {
        console.error('[EDITOR.TSX] Generative background fill failed:', error.message, error.stack);
        toast({ variant: "destructive", title: "Background Generation Failed", description: error.message });
        setFillMode('black');
    } finally {
        setIsGeneratingBg(false);
    }
  };

  const selectionDuration = selection ? Math.max(0, selection.end - selection.start) : 0;

  return (
    <div className="w-full max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
      <div className="lg:col-span-2 flex flex-col gap-4 h-full">
        <div className="flex-grow flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row justify-center items-center gap-4 sm:gap-6 mb-2">
                <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground font-medium">Aspect:</span>
                    <ToggleGroup type="single" variant="outline" size="sm" value={aspectRatio} onValueChange={(v: any) => v && setAspectRatio(v)} >
                        <ToggleGroupItem value="original" aria-label="Original"><RectangleHorizontal className="h-5 w-5" /></ToggleGroupItem>
                        <ToggleGroupItem value="portrait" aria-label="Portrait"><RectangleVertical className="h-5 w-5" /></ToggleGroupItem>
                        <ToggleGroupItem value="square" aria-label="Square"><Square className="h-5 w-5" /></ToggleGroupItem>
                    </ToggleGroup>
                </div>
                 <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground font-medium">Fill:</span>
                    <ToggleGroup type="single" variant="outline" size="sm" value={fillMode} onValueChange={(v: any) => v && setFillMode(v)} disabled={aspectRatio === 'original'}>
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
              onMouseMove={handlePanMouseMove} onMouseUp={handlePanMouseUp} onMouseLeave={handlePanMouseUp}
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
                    {aspectRatio !== 'original' && fillMode === 'blur' && videoUrl && (
                        <video key={`bg-blur-${videoUrl}`} src={videoUrl} className="absolute inset-0 w-full h-full object-cover blur-2xl scale-110 opacity-50" muted loop autoPlay playsInline />
                    )}
                    {aspectRatio !== 'original' && fillMode === 'generative' && generativeBg && (
                         <Image src={generativeBg} alt="AI Generated Background" layout="fill" objectFit="cover" />
                    )}
                    <div className="relative w-full h-full" onMouseDown={handlePanMouseDown}>
                      <div className="w-full h-full transition-transform duration-100 ease-linear" style={{ transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)` }}>
                          {videoUrl && (
                            <video key={`main-${videoUrl}`} ref={videoRef} src={videoUrl} className="w-full h-full object-contain"
                                onTimeUpdate={handleTimeUpdate} onClick={() => videoRef.current?.paused ? videoRef.current?.play() : videoRef.current?.pause()} playsInline controls
                            />
                          )}
                      </div>
                    </div>
                    {brandOptions.logo && ( <div className="absolute bottom-4 right-4 w-24 h-24 p-2 bg-white/50 rounded-md backdrop-blur-sm z-10"> <Image src={brandOptions.logo} alt="Brand Logo" layout="fill" objectFit="contain" /> </div> )}
                </div>
            </Card>
        </div>

        <Card className="shadow-lg mt-4">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="text-sm">
                <p className="font-semibold font-headline">Selected Clip</p>
                <p className="text-muted-foreground">
                    {selection ? `${formatTime(selection.start)} - ${formatTime(selection.end)}` : 'No selection yet'}
                </p>
            </div>
            <div className="flex items-center gap-4">
                <div className="text-right">
                    <p className="font-semibold font-headline">Duration</p>
                    <p className="font-mono text-lg font-medium">{formatTime(selectionDuration)}</p>
                </div>
                <Button
                  onClick={handleCreateClip}
                  disabled={!selection || isClipping || !gcsVideoUri}
                  size="lg"
                >
                  {isClipping ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Scissors className="mr-2 h-5 w-5"/>}
                  {isClipping ? clippingStatus || 'Clipping...' : 'Create Clip'}
                </Button>
                {finalClipUrl && !isClipping && (
                  <Button asChild variant="outline" size="lg">
                    <a href={finalClipUrl} download target="_blank" rel="noopener noreferrer">
                      <Download className="mr-2 h-5 w-5" /> Download Clip
                    </a>
                  </Button>
                )}
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
