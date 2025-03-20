import { Settings } from '../models/types';
import { storages } from '../utils/storage';
import { generateId, addBaseFields, updateTimestamp } from '../utils/helpers';

/**
 * Get default settings object
 */
const getDefaultSettings = (): Omit<Settings, 'id' | 'created_at' | 'updated_at'> => {
    return {
        store_name: 'TEDi Store',
        store_address: '',
        store_contact: '',
        timezone: 'Europe/Berlin',
        language: 'de',
        date_format: 'DD.MM.YYYY',
        time_format: '24h',
        store_opening: '09:00',
        store_closing: '20:00',
        pdf_layout_presets: {},
        keyholder_before_minutes: 5,
        keyholder_after_minutes: 10,
        opening_days: {
            '0': false, // Sunday
            '1': true,  // Monday
            '2': true,  // Tuesday
            '3': true,  // Wednesday
            '4': true,  // Thursday
            '5': true,  // Friday
            '6': true,  // Saturday
        },
        special_hours: {},
        page_size: 'A4',
        page_orientation: 'portrait',
        margin_top: 20.0,
        margin_right: 20.0,
        margin_bottom: 20.0,
        margin_left: 20.0,
        table_header_bg_color: '#f3f4f6',
        table_border_color: '#e5e7eb',
        table_text_color: '#111827',
        table_header_text_color: '#111827',
        font_family: 'Helvetica',
        font_size: 10.0,
        header_font_size: 12.0,
        show_employee_id: true,
        show_position: true,
        show_breaks: true,
        show_total_hours: true
    };
};

/**
 * Service for settings-related operations
 */
export const SettingsService = {
    /**
     * Get settings
     */
    get: (): Settings => {
        const settings = storages.settings.getAll() as Settings[];

        // If no settings exist, create default settings
        if (settings.length === 0) {
            return this.createDefault();
        }

        return settings[0];
    },

    /**
     * Create default settings
     */
    createDefault: (): Settings => {
        const existingSettings = storages.settings.getAll() as Settings[];

        // Clear existing settings if any
        if (existingSettings.length > 0) {
            storages.settings.clear();
        }

        // Create new settings with default values
        const newSettings = addBaseFields<Settings>(getDefaultSettings());
        newSettings.id = 1; // Always use ID 1 for settings

        // Save to storage
        return storages.settings.add(newSettings) as Settings;
    },

    /**
     * Update settings
     */
    update: (data: Partial<Settings>): Settings => {
        const currentSettings = this.get();

        // Update with new data
        const updatedSettings = {
            ...currentSettings,
            ...data,
            updated_at: new Date().toISOString()
        };

        // Save to storage
        const result = storages.settings.update(currentSettings.id, updatedSettings);

        if (!result) {
            // If update fails, create new settings
            return this.createDefault();
        }

        return result as Settings;
    },

    /**
     * Reset settings to default
     */
    reset: (): Settings => {
        // Get current settings if they exist
        const settings = storages.settings.getAll() as Settings[];

        // If settings exist, delete them
        if (settings.length > 0) {
            storages.settings.clear();
        }

        // Create and return default settings
        return this.createDefault();
    },

    /**
     * Validate settings data
     */
    validate: (data: Partial<Settings>): { valid: boolean; errors: string[] } => {
        const errors: string[] = [];

        // Check required fields
        if (data.store_name !== undefined && data.store_name.trim() === '') {
            errors.push('Store name is required');
        }

        // Validate time format (HH:MM)
        const timeRegex = /^([0-1][0-9]|2[0-3]):([0-5][0-9])$/;

        if (data.store_opening !== undefined && !timeRegex.test(data.store_opening)) {
            errors.push('Store opening time must be in format HH:MM');
        }

        if (data.store_closing !== undefined && !timeRegex.test(data.store_closing)) {
            errors.push('Store closing time must be in format HH:MM');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }
}; 