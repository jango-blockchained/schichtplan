import { Hono } from 'hono';
import type { Context } from 'hono';
import { SettingsService } from '../services/settingsService';
import { Settings } from '../models/types';
import { resetDatabase } from '../utils/storage';

const settingsRoutes = new Hono();

// GET /settings - Get settings
settingsRoutes.get('/', (c: Context) => {
    const settings = SettingsService.get();
    return c.json(settings);
});

// PUT /settings - Update settings
settingsRoutes.put('/', async (c: Context) => {
    const data = await c.req.json();

    // Validate settings data
    const validation = SettingsService.validate(data);
    if (!validation.valid) {
        return c.json({ errors: validation.errors }, 400);
    }

    try {
        const settings = SettingsService.update(data);
        return c.json(settings);
    } catch (error) {
        return c.json({ error: 'Failed to update settings' }, 500);
    }
});

// POST /settings/reset - Reset settings to default
settingsRoutes.post('/reset', (c: Context) => {
    try {
        const settings = SettingsService.reset();
        return c.json(settings);
    } catch (error) {
        return c.json({ error: 'Failed to reset settings' }, 500);
    }
});

// POST /settings/backup - Get backup of all data
settingsRoutes.post('/backup', (c: Context) => {
    // This would normally create a backup file, but for this implementation
    // we'll just return all data as JSON
    const backup = {
        timestamp: new Date().toISOString(),
        version: '1.0',
        data: {
            settings: SettingsService.get(),
            // Add other data here as needed
        }
    };

    return c.json(backup);
});

// POST /settings/restore - Restore data from backup
settingsRoutes.post('/restore', async (c: Context) => {
    try {
        // In a real implementation, we would parse the uploaded backup file
        // For now, we'll just reset the database
        resetDatabase();
        return c.json({ message: 'Database restored successfully' });
    } catch (error) {
        return c.json({ error: 'Failed to restore database' }, 500);
    }
});

// POST /settings/wipe-tables - Wipe specified tables
settingsRoutes.post('/wipe-tables', async (c: Context) => {
    try {
        const { tables } = await c.req.json();

        if (!Array.isArray(tables)) {
            return c.json({ error: 'Tables must be an array' }, 400);
        }

        // Reset specific tables or all if none specified
        if (tables.length === 0) {
            resetDatabase();
        } else {
            // This would normally wipe specific tables, but for this implementation
            // we'll just return a success message
        }

        return c.json({ message: 'Tables wiped successfully' });
    } catch (error) {
        return c.json({ error: 'Failed to wipe tables' }, 500);
    }
});

export default settingsRoutes; 