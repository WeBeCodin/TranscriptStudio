// File: src/components/brand-settings.tsx
'use client';

import * as React from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import type { BrandOptions } from '@/lib/types';
import { Separator } from './ui/separator';
import Image from 'next/image';

interface BrandSettingsProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  options: BrandOptions;
  onSave: (options: BrandOptions) => void;
}

export function BrandSettings({ isOpen, onOpenChange, options, onSave }: BrandSettingsProps) {
  const [localOptions, setLocalOptions] = React.useState<BrandOptions>(options);

  React.useEffect(() => {
    setLocalOptions(options);
  }, [options, isOpen]);

  const handleSave = () => {
    onSave(localOptions);
    onOpenChange(false);
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setLocalOptions(prev => ({ ...prev, logo: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle className="font-headline">Brand Kit</SheetTitle>
          <SheetDescription>Customize your clips to match your brand identity. Applied on export.</SheetDescription>
        </SheetHeader>
        <Separator className="my-4" />
        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label>Logo</Label>
            <Input type="file" accept="image/png, image/jpeg" onChange={handleLogoChange} />
             {localOptions.logo && (
              <div className="mt-2 p-2 border rounded-md bg-muted/50 w-32 h-32 flex items-center justify-center">
                 <Image src={localOptions.logo} alt="Logo preview" width={100} height={100} className="object-contain max-w-full max-h-full" />
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label>Highlight Color</Label>
            <div className="flex items-center gap-2">
              <Input
                type="color"
                value={localOptions.primaryColor}
                onChange={(e) => setLocalOptions(prev => ({ ...prev, primaryColor: e.target.value }))}
                className="p-1 h-10 w-14"
              />
              <Input
                type="text"
                value={localOptions.primaryColor}
                onChange={(e) => setLocalOptions(prev => ({ ...prev, primaryColor: e.target.value }))}
                className="flex-1"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Caption Font</Label>
            <RadioGroup
              value={localOptions.font}
              onValueChange={(value: 'Inter' | 'Space Grotesk') => setLocalOptions(prev => ({ ...prev, font: value }))}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="Inter" id="font-inter" />
                <Label htmlFor="font-inter" className="font-body">Inter</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="Space Grotesk" id="font-space" />
                <Label htmlFor="font-space" className="font-headline">Space Grotesk</Label>
              </div>
            </RadioGroup>
          </div>
        </div>
        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave}>Save Changes</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
