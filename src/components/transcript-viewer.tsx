// File: src/components/transcript-viewer.tsx
'use client';

import * as React from 'react';
import type { Word, Hotspot, Selection, BrandOptions } from '@/lib/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Sparkles, Bot } from 'lucide-react';
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
  const wordRefs = React.useRef<(HTMLSpanElement | null)[]>([]);
  const isSelecting = React.useRef(false);
  const [startWordIndex, setStartWordIndex] = React.useState<number | null>(null);

  React.useEffect(() => {
    wordRefs.current = wordRefs.current.slice(0, words.length);
  }, [words]);

  const getWordAtCharIndex = (charIndex: number): number => {
    let cumulativeLength = 0;
    for (let i = 0; i < words.length; i++) {
        cumulativeLength += words[i].text.length + 1; // +1 for space
        if(charIndex < cumulativeLength) return i;
    }
    return words.length - 1;
  }
  
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'SPAN' && target.dataset.wordIndex) {
        isSelecting.current = true;
        const index = parseInt(target.dataset.wordIndex, 10);
        setStartWordIndex(index);
        onSelectionChange({ start: words[index].start, end: words[index].end });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isSelecting.current || startWordIndex === null) return;
    
    const target = e.target as HTMLElement;
    if (target.tagName === 'SPAN' && target.dataset.wordIndex) {
        const currentIndex = parseInt(target.dataset.wordIndex, 10);
        const startIndex = Math.min(startWordIndex, currentIndex);
        const endIndex = Math.max(startWordIndex, currentIndex);
        
        onSelectionChange({
            start: words[startIndex].start,
            end: words[endIndex].end,
        });
    }
  };

  const handleMouseUp = () => {
    isSelecting.current = false;
    setStartWordIndex(null);
  };
  
  const fullTranscriptText = React.useMemo(() => words.map(w => w.text).join(' '), [words]);
  
  const isWordInHotspot = (index: number): boolean => {
    if (!hotspots) return false;
    let charIndex = words.slice(0, index).reduce((acc, word) => acc + word.text.length + 1, 0);
    return hotspots.some(h => charIndex >= h.startIndex && charIndex <= h.endIndex);
  };

  const isWordSelected = (word: Word): boolean => {
    if (!selection) return false;
    // Check if word's time range overlaps with selection time range
    return word.start < selection.end && word.end > selection.start;
  };

  return (
    <ScrollArea className="h-full w-full">
        <div 
            className="p-6 text-lg leading-relaxed select-none"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            style={{
                fontFamily: brandOptions.font === 'Space Grotesk' ? '"Space Grotesk", sans-serif' : 'Inter, sans-serif'
            }}
        >
        <p>
            {words.map((word, index) => {
            const isActive = currentTime >= word.start && currentTime < word.end;
            const isSelected = isWordSelected(word);
            const inHotspot = isWordInHotspot(index);
            return (
                <span
                key={index}
                ref={el => wordRefs.current[index] = el}
                data-word-index={index}
                onClick={() => onSeek(word.start)}
                className={cn(
                    "cursor-pointer transition-colors duration-100 rounded-md",
                    isSelected ? "bg-primary/30" : "hover:bg-primary/10",
                    isActive && "text-white",
                    inHotspot && !isSelected && "bg-accent/20"
                )}
                style={{
                    backgroundColor: isSelected ? brandOptions.primaryColor + '4D' : (inHotspot ? 'hsl(var(--accent) / 0.2)' : 'transparent'),
                    color: isActive ? brandOptions.primaryColor : 'inherit',
                    fontWeight: isActive ? 'bold' : 'normal'
                }}
                >
                {word.text}{' '}
                </span>
            );
            })}
        </p>
        </div>
        <TooltipProvider>
            <div className="p-4 flex justify-end">
                <Tooltip>
                <TooltipTrigger asChild>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Sparkles className="h-4 w-4 text-accent" />
                        <span>AI Hotspots Enabled</span>
                    </div>
                </TooltipTrigger>
                <TooltipContent>
                    <p>AI has highlighted sections that might be interesting.</p>
                </TooltipContent>
                </Tooltip>
            </div>
        </TooltipProvider>
    </ScrollArea>
  );
}
