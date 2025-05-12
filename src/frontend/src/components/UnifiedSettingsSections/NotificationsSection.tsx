import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { Settings } from '@/types';

interface NotificationsSectionProps {
  settings: Settings['display'] | undefined;
  onDisplaySettingChange: (key: keyof Settings['display'], value: any) => void;
}

const NotificationsSection: React.FC<NotificationsSectionProps> = ({
  settings,
  onDisplaySettingChange,
}) => {
  if (!settings) {
    return <div>Loading notification settings...</div>; // Or some loading/fallback UI
  }

  const handleToggle = (key: keyof Settings['display'], checked: boolean) => {
    onDisplaySettingChange(key, checked);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notification Preferences</CardTitle>
        <CardDescription>
          Manage how you receive notifications from the application.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          {/* Email Notifications Toggle */}
          <div className="flex items-center justify-between p-4 border rounded-md">
            <Label htmlFor="email-notifications-toggle" className="flex flex-col space-y-1 cursor-pointer">
              <span>Email Notifications</span>
              <span className="font-normal leading-snug text-muted-foreground">
                Receive important updates via email.
              </span>
            </Label>
            <Switch
              id="email-notifications-toggle"
              checked={settings.email_notifications ?? false}
              onCheckedChange={(checked) => handleToggle('email_notifications', checked)}
            />
          </div>

          {/* Schedule Published Notifications Toggle */}
          <div className="flex items-center justify-between p-4 border rounded-md">
            <Label htmlFor="schedule-published-toggle" className="flex flex-col space-y-1 cursor-pointer">
              <span>Schedule Published</span>
              <span className="font-normal leading-snug text-muted-foreground">
                Get notified when a new schedule is published.
              </span>
            </Label>
            <Switch
              id="schedule-published-toggle"
              checked={settings.schedule_published ?? false}
              onCheckedChange={(checked) => handleToggle('schedule_published', checked)}
            />
          </div>

          {/* Shift Changes Notifications Toggle */}
          <div className="flex items-center justify-between p-4 border rounded-md">
            <Label htmlFor="shift-changes-toggle" className="flex flex-col space-y-1 cursor-pointer">
              <span>Shift Changes</span>
              <span className="font-normal leading-snug text-muted-foreground">
                Receive notifications for changes to your assigned shifts.
              </span>
            </Label>
            <Switch
              id="shift-changes-toggle"
              checked={settings.shift_changes ?? false}
              onCheckedChange={(checked) => handleToggle('shift_changes', checked)}
            />
          </div>

          {/* Time Off Requests Notifications Toggle */}
          <div className="flex items-center justify-between p-4 border rounded-md">
            <Label htmlFor="time-off-requests-toggle" className="flex flex-col space-y-1 cursor-pointer">
              <span>Time Off Requests</span>
              <span className="font-normal leading-snug text-muted-foreground">
                Get notified about updates to your time off requests.
              </span>
            </Label>
            <Switch
              id="time-off-requests-toggle"
              checked={settings.time_off_requests ?? false}
              onCheckedChange={(checked) => handleToggle('time_off_requests', checked)}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default NotificationsSection; 