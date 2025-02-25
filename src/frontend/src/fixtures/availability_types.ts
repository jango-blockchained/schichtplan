export interface AvailabilityType {
    code: string;
    name: string;
    color: string;
    description?: string;
}

export const AVAILABILITY_TYPES: AvailabilityType[] = [
    { code: 'AVL', name: 'Available', color: '#22c55e', description: 'Employee is available for work' },
    { code: 'FIX', name: 'Fixed', color: '#3b82f6', description: 'Fixed/regular schedule' },
    { code: 'UNA', name: 'Unavailable', color: '#ef4444', description: 'Not available for work' },
    { code: 'PRF', name: 'Preferred', color: '#8b5cf6', description: 'Preferred working time' },
]; 