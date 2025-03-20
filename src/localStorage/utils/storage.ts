import { LocalStorage } from 'node-localstorage';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Get the current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create data directory if it doesn't exist
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize LocalStorage with the data directory
const localStorage = new LocalStorage(dataDir);

/**
 * Storage class to abstract localStorage operations
 */
export class Storage<T> {
    private key: string;

    constructor(key: string) {
        this.key = key;
    }

    /**
     * Get all items
     */
    getAll(): T[] {
        const data = localStorage.getItem(this.key);
        return data ? JSON.parse(data) : [];
    }

    /**
     * Get an item by ID
     */
    getById(id: number | string): T | undefined {
        const items = this.getAll();
        return items.find((item: any) => item.id === id);
    }

    /**
     * Save all items
     */
    saveAll(items: T[]): void {
        localStorage.setItem(this.key, JSON.stringify(items));
    }

    /**
     * Add a new item
     */
    add(item: T): T {
        const items = this.getAll();
        items.push(item);
        this.saveAll(items);
        return item;
    }

    /**
     * Update an item
     */
    update(id: number | string, updatedItem: Partial<T>): T | null {
        const items = this.getAll();
        const index = items.findIndex((item: any) => item.id === id);

        if (index === -1) {
            return null;
        }

        items[index] = { ...items[index], ...updatedItem };
        this.saveAll(items);
        return items[index];
    }

    /**
     * Delete an item
     */
    delete(id: number | string): boolean {
        const items = this.getAll();
        const initialLength = items.length;
        const filteredItems = items.filter((item: any) => item.id !== id);

        if (filteredItems.length === initialLength) {
            return false;
        }

        this.saveAll(filteredItems);
        return true;
    }

    /**
     * Clear all items
     */
    clear(): void {
        localStorage.removeItem(this.key);
    }
}

/**
 * Initialize database with empty collections
 */
export const initializeDatabase = (): void => {
    // Check if initialized already
    if (localStorage.getItem('db_initialized')) {
        return;
    }

    // Create empty collections for all models
    const collections = [
        'settings',
        'employees',
        'shifts',
        'schedules',
        'schedule_version_meta',
        'availabilities',
        'absences',
        'coverage'
    ];

    collections.forEach(collection => {
        if (!localStorage.getItem(collection)) {
            localStorage.setItem(collection, '[]');
        }
    });

    // Set initialization flag
    localStorage.setItem('db_initialized', 'true');
};

/**
 * Reset database to empty state
 */
export const resetDatabase = (): void => {
    const collections = [
        'settings',
        'employees',
        'shifts',
        'schedules',
        'schedule_version_meta',
        'availabilities',
        'absences',
        'coverage'
    ];

    collections.forEach(collection => {
        localStorage.removeItem(collection);
        localStorage.setItem(collection, '[]');
    });
};

// Export named storages for each model type
export const storages = {
    settings: new Storage('settings'),
    employees: new Storage('employees'),
    shifts: new Storage('shifts'),
    schedules: new Storage('schedules'),
    scheduleVersionMeta: new Storage('schedule_version_meta'),
    availabilities: new Storage('availabilities'),
    absences: new Storage('absences'),
    coverage: new Storage('coverage')
}; 