import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { DateTimePicker } from '@/components/ui/date-time-picker';
import { Loader2 } from 'lucide-react';
import type { Settings } from '@/types/index';

// Props that will be passed from UnifiedSettingsPage.tsx
interface GeneralStoreSetupSectionProps {
  localSettings: Partial<Settings>; // Using Partial as not all settings might be loaded initially or relevant here
  handleSave: (category: 'general', updates: Partial<Settings['general']>) => void;
  handleImmediateUpdate: () => void;
  updateMutationIsPending: boolean;
  timeStringToDate: (timeStr: string) => Date;
  dateToTimeString: (date: Date | null | undefined) => string;
}

export const GeneralStoreSetupSection: React.FC<GeneralStoreSetupSectionProps> = ({
  localSettings,
  handleSave,
  handleImmediateUpdate,
  updateMutationIsPending,
  timeStringToDate,
  dateToTimeString,
}) => {
  // Fallback for localSettings.general if it's undefined
  const generalSettings = localSettings.general ?? {};

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="storeName">Store Name</Label>
            <Input
              id="storeName"
              value={generalSettings.store_name ?? ''}
              onChange={(e) => handleSave('general', { store_name: e.target.value })}
              onBlur={handleImmediateUpdate}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="storeAddress">Store Address</Label>
            <Input
              id="storeAddress"
              value={generalSettings.store_address ?? ''}
              onChange={(e) => handleSave('general', { store_address: e.target.value })}
              onBlur={handleImmediateUpdate}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="storeContact">Store Contact</Label>
            <Input
              id="storeContact"
              value={generalSettings.store_contact ?? ''}
              onChange={(e) => handleSave('general', { store_contact: e.target.value })}
              onBlur={handleImmediateUpdate}
            />
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-medium">Store Hours</h3>
          <div className="rounded-lg border p-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="store-opening">Opening Time</Label>
                <DateTimePicker
                  date={timeStringToDate(generalSettings.store_opening ?? '09:00')}
                  setDate={(date) => handleSave('general', { store_opening: dateToTimeString(date) })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="store-closing">Closing Time</Label>
                <DateTimePicker
                  date={timeStringToDate(generalSettings.store_closing ?? '20:00')}
                  setDate={(date) => handleSave('general', { store_closing: dateToTimeString(date) })}
                />
              </div>
            </div>
            <Separator />
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="keyholder-before">Keyholder Before (min)</Label>
                <Input
                  id="keyholder-before"
                  type="number" min="0" max="120"
                  value={generalSettings.keyholder_before_minutes ?? 30}
                  onChange={(e) => handleSave('general', { keyholder_before_minutes: parseInt(e.target.value) })}
                  onBlur={handleImmediateUpdate}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="keyholder-after">Keyholder After (min)</Label>
                <Input
                  id="keyholder-after"
                  type="number" min="0" max="120"
                  value={generalSettings.keyholder_after_minutes ?? 30}
                  onChange={(e) => handleSave('general', { keyholder_after_minutes: parseInt(e.target.value) })}
                  onBlur={handleImmediateUpdate}
                />
              </div>
            </div>
          </div>
        </div>
        <div className="space-y-4 md:col-span-2">
          <Label>Opening Days</Label>
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, index) => (
              <div key={day} className="flex flex-col items-center space-y-1">
                <Label htmlFor={`opening-day-${day}`} className="text-sm font-normal">{day}</Label>
                <Switch
                  id={`opening-day-${day}`}
                  checked={generalSettings.opening_days?.[index.toString()] ?? false}
                  onCheckedChange={(checked) => {
                    const updatedOpeningDays = { ...(generalSettings.opening_days ?? {}), [index.toString()]: checked };
                    handleSave('general', { opening_days: updatedOpeningDays });
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="flex justify-end mt-6">
        <Button onClick={handleImmediateUpdate} disabled={updateMutationIsPending}>
          {updateMutationIsPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save General Settings
        </Button>
      </div>
    </div>
  );
}; 