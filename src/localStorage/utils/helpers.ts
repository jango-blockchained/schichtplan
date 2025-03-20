import { v4 as uuidv4 } from 'uuid';
import { BaseModel } from '../models/types';
import { Storage } from './storage';

/**
 * Generate a timestamp in ISO format
 */
export const generateTimestamp = (): string => new Date().toISOString();

/**
 * Generate a sequential ID for a collection
 */
export const generateId = <T extends BaseModel>(storage: Storage<T>): number => {
    const items = storage.getAll();
    return items.length > 0
        ? Math.max(...items.map(item => item.id)) + 1
        : 1;
};

/**
 * Generate a unique employee ID based on first and last name
 */
export const generateEmployeeId = (firstName: string, lastName: string): string => {
    // Take first 3 chars of first name and first 3 chars of last name
    const prefix = firstName.substring(0, 3).toUpperCase() + lastName.substring(0, 3).toUpperCase();
    // Add random 4 digits
    const random = Math.floor(1000 + Math.random() * 9000);
    return `${prefix}${random}`;
};

/**
 * Get time in HH:MM format from Date
 */
export const getTimeString = (date: Date): string => {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
};

/**
 * Add base model fields to a new object
 */
export const addBaseFields = <T>(obj: Omit<T, keyof BaseModel>): T & BaseModel => {
    const now = generateTimestamp();
    return {
        ...obj as any,
        id: 0, // This should be replaced by the caller with a proper ID
        created_at: now,
        updated_at: now
    };
};

/**
 * Update the updated_at timestamp for an object
 */
export const updateTimestamp = <T extends BaseModel>(obj: T): T => {
    return {
        ...obj,
        updated_at: generateTimestamp()
    };
};

/**
 * Calculate time difference in hours between two HH:MM times
 */
export const calculateHoursDifference = (startTime: string, endTime: string): number => {
    const [startHour, startMinute] = startTime.split(':').map(Number);
    const [endHour, endMinute] = endTime.split(':').map(Number);

    let hours = endHour - startHour;
    let minutes = endMinute - startMinute;

    // Handle negative minutes
    if (minutes < 0) {
        minutes += 60;
        hours -= 1;
    }

    // Handle day wrap (e.g., start at 22:00, end at 06:00)
    if (hours < 0) {
        hours += 24;
    }

    return hours + (minutes / 60);
}; 