import { useState, useEffect } from 'react';
import { Settings } from '@/types';
import axios from 'axios';

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

    const updateSettings = async (newSettings: Partial<Settings>) => {
        try {
            setIsLoading(true);
            const response = await axios.put<Settings>('/api/settings', newSettings);
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