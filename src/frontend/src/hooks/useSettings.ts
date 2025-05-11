import { useState, useEffect } from 'react';
import type { Settings } from '../types/index';
import axios from 'axios';

// Default settings object to use as fallback
export const DEFAULT_SETTINGS: Settings = {
    id: 0,
    store_name: 'Store',
    store_address: null,
    store_contact: null,
    timezone: 'Europe/Berlin',
    language: 'de',
    date_format: 'DD.MM.YYYY',
    time_format: '24h',
    store_opening: '09:00',
    store_closing: '20:00',
    keyholder_before_minutes: 30,
    keyholder_after_minutes: 30,
    opening_days: {},
    special_hours: {},
    availability_types: { types: [] },
    shift_types: [],
    general: {
        store_name: '',
        store_address: '',
        store_contact: '',
        timezone: 'Europe/Berlin',
        language: 'de',
        date_format: 'DD.MM.YYYY',
        time_format: '24h',
        store_opening: '09:00',
        store_closing: '20:00',
        keyholder_before_minutes: 30,
        keyholder_after_minutes: 30,
        opening_days: {},
        special_hours: {}
    },
    scheduling: {
        scheduling_resource_type: 'shifts',
        default_shift_duration: 8,
        min_break_duration: 30,
        max_daily_hours: 10,
        max_weekly_hours: 40,
        min_rest_between_shifts: 11,
        scheduling_period_weeks: 1,
        auto_schedule_preferences: true,
        enable_diagnostics: false,
        generation_requirements: {
            enforce_minimum_coverage: true,
            enforce_contracted_hours: true,
            enforce_keyholder_coverage: true,
            enforce_rest_periods: true,
            enforce_early_late_rules: true,
            enforce_employee_group_rules: true,
            enforce_break_rules: true,
            enforce_max_hours: true,
            enforce_consecutive_days: true,
            enforce_weekend_distribution: true,
            enforce_shift_distribution: true,
            enforce_availability: true,
            enforce_qualifications: true,
            enforce_opening_hours: true
        }
    },
    display: {
        theme: 'light',
        primary_color: '#000000',
        secondary_color: '#000000',
        accent_color: '#000000',
        background_color: '#ffffff',
        surface_color: '#ffffff',
        text_color: '#000000',
        dark_theme: {
            primary_color: '#ffffff',
            secondary_color: '#ffffff',
            accent_color: '#ffffff',
            background_color: '#000000',
            surface_color: '#000000',
            text_color: '#ffffff'
        },
        show_sunday: false,
        show_weekdays: true,
        start_of_week: 1,
        email_notifications: false,
        schedule_published: false,
        shift_changes: false,
        time_off_requests: false
    },
    pdf_layout: {
        page_size: 'A4',
        orientation: 'portrait',
        margins: {
            top: 20,
            right: 20,
            bottom: 20,
            left: 20
        },
        table_style: {
            header_bg_color: '#f5f5f5',
            border_color: '#e0e0e0',
            text_color: '#000000',
            header_text_color: '#000000'
        },
        fonts: {
            family: 'Arial',
            size: 12,
            header_size: 14
        },
        content: {
            show_employee_id: true,
            show_position: true,
            show_breaks: true,
            show_total_hours: true
        }
    },
    employee_groups: {
        employee_types: [{
            id: "VZ",
            name: "Vollzeit",
            min_hours: 35,
            max_hours: 40,
            type: 'employee'
        }],
        shift_types: [{
            id: "EARLY",
            name: "Frühschicht",
            color: "#4CAF50",
            type: 'shift'
        }],
        absence_types: [{
            id: "URL",
            name: "Urlaub",
            color: "#FF9800",
            type: 'absence'
        }]
    },
    actions: {
        demo_data: {
            selected_module: '',
            last_execution: null
        }
    },
    ai_scheduling: {
        enabled: false,
        api_key: ""
    }
};

export function useSettings() {
    const [settings, setSettings] = useState<Settings | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            setIsLoading(true);
            const response = await axios.get<Settings>('/api/settings');
            setSettings(response.data);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Failed to fetch settings'));
        } finally {
            setIsLoading(false);
        }
    };

    const formatSettingsUpdate = (newSettings: Partial<Settings>) => {
        const formattedData: Record<string, any> = {};

        // Format general settings
        if (Object.keys(newSettings).some(key => ['store_name', 'store_address', 'store_contact', 'timezone', 'language', 'date_format', 'time_format', 'store_opening', 'store_closing', 'keyholder_before_minutes', 'keyholder_after_minutes', 'opening_days', 'special_hours'].includes(key))) {
            formattedData.general = {};
            ['store_name', 'store_address', 'store_contact', 'timezone', 'language', 'date_format', 'time_format', 'store_opening', 'store_closing', 'keyholder_before_minutes', 'keyholder_after_minutes', 'opening_days', 'special_hours'].forEach(key => {
                if (key in newSettings) {
                    formattedData.general[key] = newSettings[key as keyof Settings];
                }
            });
        }

        // Format scheduling settings
        if ('scheduling' in newSettings) {
            formattedData.scheduling = newSettings.scheduling;
        }

        // Format display settings
        if ('display' in newSettings) {
            formattedData.display = newSettings.display;
        }

        // Format PDF layout settings
        if ('pdf_layout' in newSettings) {
            formattedData.pdf_layout = newSettings.pdf_layout;
        }

        // Format employee groups settings
        if ('employee_groups' in newSettings) {
            formattedData.employee_groups = newSettings.employee_groups;
        }

        // Format availability types
        if ('availability_types' in newSettings) {
            formattedData.availability_types = newSettings.availability_types;
        }

        // Format actions settings
        if ('actions' in newSettings) {
            formattedData.actions = newSettings.actions;
        }

        return formattedData;
    };

    const updateSettings = async (newSettings: Partial<Settings>) => {
        try {
            setIsLoading(true);
            const formattedData = formatSettingsUpdate(newSettings);
            const response = await axios.put<Settings>('/api/settings', formattedData);
            setSettings(response.data);
            setError(null);
            return response.data;
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Failed to update settings'));
            throw err;
        } finally {
            setIsLoading(false);
        }
    };

    return {
        settings,
        isLoading,
        error,
        updateSettings,
        refetch: fetchSettings,
    };
} 