'use client';

import * as React from 'react';
import { Palette, Sparkles, FileVideo, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BrandSettings } from '@/components/brand-settings';
import type { BrandOptions } from '@/lib/types';

interface AppHeaderProps {
  brandOptions: BrandOptions;
  onBrandOptionsChange: (options: BrandOptions) => void;
  onNewVideo: () => void;
  isEditing: boolean;
}

export function AppHeader({ brandOptions, onBrandOptionsChange, onNewVideo, isEditing }: AppHeaderProps) {
  const [isBrandSettingsOpen, setIsBrandSettingsOpen] = React.useState(false);

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center">
          <div className="mr-4 flex items-center">
            <Sparkles className="h-6 w-6 mr-2 text-primary" />
            <h1 className="text-xl font-bold font-headline text-foreground">Transcript Studio</h1>
          </div>
          <div className="flex flex-1 items-center justify-end space-x-2">
            {isEditing && (
               <Button variant="outline" size="sm" onClick={onNewVideo}>
                <Plus className="mr-2 h-4 w-4" />
                New Project
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => setIsBrandSettingsOpen(true)}>
              <Palette className="mr-2 h-4 w-4" />
              Customize
            </Button>
          </div>
        </div>
      </header>
      <BrandSettings
        isOpen={isBrandSettingsOpen}
        onOpenChange={setIsBrandSettingsOpen}
        options={brandOptions}
        onSave={onBrandOptionsChange}
      />
    </>
  );
}
