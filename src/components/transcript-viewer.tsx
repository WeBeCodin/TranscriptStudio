'use client';

import * as React from 'react';
import type { Word, Hotspot, Selection, BrandOptions } from '@/lib/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Sparkles } from 'lucide-react';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
  } from "@/components/ui/tooltip"

interface TranscriptViewerProps {
  words: Word[];
  hotspots: Hotspot[] | null;
  currentTime: number;
  onSeek: (time: number) => void;
  selection: Selection | null;
  onSelectionChange: (selection: Selection | null) => void;
  brandOptions: BrandOptions;
}

export function TranscriptViewer({
  words,
  hotspots,
  currentTime,
  onSeek,
  selection,
  onSelectionChange,
  brandOptions,
}: TranscriptViewerProps) {
  console.log("[TRANSCRIPT_VIEWER.TSX] Props received:", { numWords: words?.length, hotspots, currentTime, selection });

  const wordRefs = React.useRef<(HTMLSpanElement | null)[]>([]);
  const isSelecting = React.useRef(false);
  const [startWordIndex, setStartWordIndex] = React.useState<number | null>(null);

  React.useEffect(() => {
    console.log("[TRANSCRIPT_VIEWER.TSX] useEffect processing words. Count:", words?.length);
    wordRefs.current = wordRefs.current.slice(0, words?.length || 0);
  }, [words]);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'SPAN' && target.dataset.wordIndex !== undefined) {
        isSelecting.current = true;
        const index = parseInt(target.dataset.wordIndex, 10);
        setStartWordIndex(index);
        if (words && words[index]) {
            onSelectionChange({ start: words[index].start, end: words[index].end });
            console.log("[TRANSCRIPT_VIEWER.TSX] MouseDown: Started selection at word", index, "Time:", words[index].start);
        } else {
            console.warn("[TRANSCRIPT_VIEWER.TSX] MouseDown: Word data not found for index", index);
        }
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isSelecting.current || startWordIndex === null || !words || words.length === 0) return;
    const target = e.target as HTMLElement;
    if (target.tagName === 'SPAN' && target.dataset.wordIndex !== undefined) {
        const currentIndex = parseInt(target.dataset.wordIndex, 10);
        if (words[startWordIndex] && words[currentIndex]) {
            const selectionStartIndex = Math.min(startWordIndex, currentIndex);
            const selectionEndIndex = Math.max(startWordIndex, currentIndex);
            onSelectionChange({
                start: words[selectionStartIndex].start,
                end: words[selectionEndIndex].end,
            });
        }
    }
  };

  const handleMouseUp = () => {
    if (isSelecting.current) {
        console.log("[TRANSCRIPT_VIEWER.TSX] MouseUp: Finalized selection.", selection);
        isSelecting.current = false;
    }
  };

  const isWordInHotspot = (wordIndex: number): boolean => {
    if (!hotspots || !words || !words[wordIndex]) return false;
    let charIndex = 0;
    for(let i=0; i < wordIndex; i++) {
        if(words[i]) charIndex += (words[i].text.length + 1);
    }
    // This logic assumes hotspots are character index based. It might need adjustment
    // depending on the precise output of your suggestHotspotsAction Genkit flow.
    return hotspots.some(h => charIndex >= h.startIndex && charIndex < (h.endIndex + words[wordIndex].text.length) );
  };

  const isWordSelected = (word: Word): boolean => {
    if (!selection) return false;
    return word.start < selection.end && word.end > selection.start;
  };

  return (
    <ScrollArea
        className="h-full w-full"
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
    >
        <div
            className="p-6 text-lg leading-relaxed select-text"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            style={{
                fontFamily: brandOptions.font === 'Space Grotesk' ? '"Space Grotesk", sans-serif' : 'Inter, sans-serif'
            }}
        >
        <p>
            {(words && words.length > 0) ? words.map((word, index) => {
            const isActive = currentTime >= word.start && currentTime < word.end;
            const isSelected = isWordSelected(word);
            const inHotspot = isWordInHotspot(index); // Re-enabled hotspot logic

            return (
                <span
                key={`${index}-${word.start}-${word.text.substring(0,5)}`}
                ref={(el: HTMLSpanElement | null) => { wordRefs.current[index] = el; }} // Corrected ref callback
                data-word-index={index}
                onClick={(e) => {
                    e.stopPropagation();
                    onSeek(word.start);
                    console.log("[TRANSCRIPT_VIEWER.TSX] Word clicked, seeking to:", word.start);
                }}
                className={cn(
                    "cursor-pointer transition-colors duration-100 rounded-md px-0.5 py-0.5",
                    isSelected ? "bg-opacity-30" : "hover:bg-opacity-10",
                    isActive && "text-opacity-100",
                    inHotspot && !isSelected && "bg-yellow-200/50 dark:bg-yellow-800/50" // Example hotspot styling
                )}
                style={{
                    backgroundColor: isSelected
                        ? `${brandOptions.primaryColor}4D`
                        : (inHotspot ? 'hsla(54, 96%, 72%, 0.5)' : 'transparent'), // More specific color for hotspot
                    color: isActive ? brandOptions.primaryColor : 'inherit',
                    fontWeight: isActive ? 'bold' : 'normal'
                }}
                >
                {word.text}{' '}
                </span>
            );
            }) : (
                <span className="text-muted-foreground italic">No transcript data available.</span>
            )}
        </p>
        </div>
        {hotspots && hotspots.length > 0 && (
            <TooltipProvider>
                <div className="p-4 flex justify-end">
                    <Tooltip>
                    <TooltipTrigger asChild>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Sparkles className="h-4 w-4 text-accent" />
                            <span>AI Hotspots Analyzed</span>
                        </div>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>AI has identified sections that might be interesting for clips.</p>
                    </TooltipContent>
                    </Tooltip>
                </div>
            </TooltipProvider>
        )}
    </ScrollArea>
  );
}
