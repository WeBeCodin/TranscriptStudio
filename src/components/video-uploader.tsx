'use client';

import * as React from 'react';
import { UploadCloud, Loader2 } from 'lucide-react';

interface VideoUploaderProps {
  onFileUpload: (file: File) => void;
  isProcessing: boolean;
  status: string;
}

export function VideoUploader({ onFileUpload, isProcessing, status }: VideoUploaderProps) {
  const [isDragging, setIsDragging] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onFileUpload(file);
    }
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      onFileUpload(file);
    }
  };

  const handleBrowseClick = () => {
    inputRef.current?.click();
  };

  return (
    <div className="w-full max-w-2xl text-center">
      <div
        className={`relative flex w-full flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 transition-colors duration-200 ${
          isDragging ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'
        }`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={handleBrowseClick}
      >
        <input
          ref={inputRef}
          type="file"
          accept="video/mp4,video/quicktime,video/x-ms-wmv"
          className="hidden"
          onChange={handleFileChange}
          disabled={isProcessing}
        />
        {isProcessing ? (
          <>
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <h2 className="mt-4 text-xl font-semibold font-headline tracking-tight">Processing Video...</h2>
            <p className="mt-2 text-sm text-muted-foreground">{status || 'Please wait, this may take a few moments.'}</p>
          </>
        ) : (
          <>
            <UploadCloud className="h-12 w-12 text-primary" />
            <h2 className="mt-4 text-xl font-semibold font-headline tracking-tight">Upload Your Video</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Drag & drop a file or{' '}
              <span className="font-medium text-primary hover:underline cursor-pointer">browse</span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">MP4, MOV, WMV up to 5GB</p>
          </>
        )}
      </div>
    </div>
  );
}
