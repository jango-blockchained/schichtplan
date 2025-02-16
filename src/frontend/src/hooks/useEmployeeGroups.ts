import { useState, useEffect } from 'react';

export interface EmployeeGroup {
    id: string;  // Matches backend's EmployeeGroup enum values: VL, TZ, GFB, TL
    name: string;
    description: string;
    minHours: number;
    maxHours: number;
    isFullTime: boolean;
}

const DEFAULT_GROUPS: EmployeeGroup[] = [
    {
        id: 'VL',
        name: 'Vollzeit',
        description: 'Full-time employee',
        minHours: 40,
        maxHours: 40,
        isFullTime: true
    },
    {
        id: 'TZ',
        name: 'Teilzeit',
        description: 'Part-time employee',
        minHours: 10,
        maxHours: 30,
        isFullTime: false
    },
    {
        id: 'GfB',  // Updated to match backend's enum value
        name: 'Geringfügig Beschäftigt',
        description: 'Mini-job employee',
        minHours: 0,
        maxHours: 40,
        isFullTime: false
    },
    {
        id: 'TL',
        name: 'Team Leader',
        description: 'Team leader (full-time)',
        minHours: 40,
        maxHours: 40,
        isFullTime: true
    }
];

export const useEmployeeGroups = () => {
    const [employeeGroups, setEmployeeGroups] = useState<EmployeeGroup[]>(() => {
        const storedGroups = localStorage.getItem('employeeGroups');
        return storedGroups ? JSON.parse(storedGroups) : DEFAULT_GROUPS;
    });

    useEffect(() => {
        localStorage.setItem('employeeGroups', JSON.stringify(employeeGroups));
    }, [employeeGroups]);

    const addGroup = (group: EmployeeGroup) => {
        if (employeeGroups.some(g => g.id === group.id)) {
            throw new Error('Group ID must be unique');
        }
        setEmployeeGroups([...employeeGroups, group]);
    };

    const updateGroup = (id: string, updatedGroup: Partial<EmployeeGroup>) => {
        setEmployeeGroups(groups =>
            groups.map(group =>
                group.id === id ? { ...group, ...updatedGroup } : group
            )
        );
    };

    const deleteGroup = (id: string) => {
        if (employeeGroups.length <= 1) {
            throw new Error('Cannot delete the last group');
        }
        setEmployeeGroups(groups => groups.filter(group => group.id !== id));
    };

    const getGroup = (id: string) => {
        return employeeGroups.find(group => group.id === id);
    };

    const getHoursRange = (id: string): [number, number] => {
        const group = getGroup(id);
        return group ? [group.minHours, group.maxHours] : [0, 0];
    };

    return {
        employeeGroups,
        addGroup,
        updateGroup,
        deleteGroup,
        getGroup,
        getHoursRange
    };
}; 