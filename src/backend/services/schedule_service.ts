import { broadcastEvent, EVENTS } from '../websocket_bun';
import { Schedule } from '../models/schedule';

export class ScheduleService {
    async updateSchedule(scheduleId: string, data: Partial<Schedule>): Promise<Schedule> {
        try {
            // Your existing database update logic here
            const updatedSchedule = await Schedule.findByIdAndUpdate(scheduleId, data, { new: true });

            // Broadcast the update to all connected clients
            broadcastEvent(EVENTS.SCHEDULE_UPDATED, {
                scheduleId,
                data: updatedSchedule,
                timestamp: new Date().toISOString(),
            });

            return updatedSchedule;
        } catch (error) {
            console.error('Error updating schedule:', error);
            throw error;
        }
    }

    async deleteSchedule(scheduleId: string): Promise<void> {
        try {
            // Your existing database delete logic here
            await Schedule.findByIdAndDelete(scheduleId);

            // Broadcast the deletion to all connected clients
            broadcastEvent(EVENTS.SCHEDULE_UPDATED, {
                scheduleId,
                action: 'deleted',
                timestamp: new Date().toISOString(),
            });
        } catch (error) {
            console.error('Error deleting schedule:', error);
            throw error;
        }
    }

    // Add more methods as needed
} 