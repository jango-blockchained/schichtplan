import { useCallback, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import debounce from 'lodash/debounce';

interface InvalidationConfig {
    queryKey: string[];
    debounceMs?: number;
    maxWait?: number;
    priority?: 'low' | 'medium' | 'high';
    batchWith?: string[]; // Other query keys to batch with
}

interface DebouncedInvalidation {
    fn: ReturnType<typeof debounce>;
    priority: number;
    batchGroup?: string;
}

const PRIORITY_MAP = {
    low: 1,
    medium: 2,
    high: 3
};

export const useDebounceInvalidation = (
    configs: InvalidationConfig[],
    defaultDebounceMs = 1000,
    defaultMaxWait = 5000
) => {
    const queryClient = useQueryClient();
    const batchGroupsRef = useRef<Map<string, Set<string>>>(new Map());

    // Create batch groups
    useEffect(() => {
        configs.forEach(({ queryKey, batchWith }) => {
            if (batchWith?.length) {
                const groupKey = [queryKey, ...batchWith].sort().join('|');
                if (!batchGroupsRef.current.has(groupKey)) {
                    batchGroupsRef.current.set(groupKey, new Set([queryKey.join('.'), ...batchWith.map(key => key)]));
                }
            }
        });
    }, [configs]);

    const debouncedInvalidations = useCallback(
        configs.reduce((acc, { queryKey, debounceMs = defaultDebounceMs, maxWait = defaultMaxWait, priority = 'medium', batchWith }) => {
            const key = queryKey.join('.');
            const groupKey = batchWith ? [key, ...batchWith].sort().join('|') : undefined;

            acc[key] = {
                fn: debounce(
                    () => {
                        // If part of a batch group, invalidate all related queries
                        if (groupKey && batchGroupsRef.current.has(groupKey)) {
                            const group = batchGroupsRef.current.get(groupKey)!;
                            group.forEach(queryKey => {
                                const keys = queryKey.split('.');
                                queryClient.invalidateQueries({ queryKey: keys });
                            });
                        } else {
                            queryClient.invalidateQueries({ queryKey });
                        }
                    },
                    debounceMs,
                    {
                        maxWait,
                        leading: priority === 'high', // High priority gets leading edge execution
                        trailing: true
                    }
                ),
                priority: PRIORITY_MAP[priority],
                batchGroup: groupKey
            };
            return acc;
        }, {} as Record<string, DebouncedInvalidation>),
        [queryClient]
    );

    const invalidateQueries = useCallback(
        (queryKeys: string[][], options?: { force?: boolean }) => {
            // Sort by priority (high to low)
            const sortedKeys = queryKeys
                .map(key => ({
                    key: key.join('.'),
                    invalidation: debouncedInvalidations[key.join('.')]
                }))
                .sort((a, b) => (b.invalidation?.priority || 0) - (a.invalidation?.priority || 0));

            sortedKeys.forEach(({ key, invalidation }) => {
                if (invalidation) {
                    if (options?.force) {
                        // Cancel debounce and execute immediately for forced updates
                        invalidation.fn.flush();
                    } else {
                        invalidation.fn();
                    }
                }
            });
        },
        [debouncedInvalidations]
    );

    // Cleanup function
    useEffect(() => {
        return () => {
            Object.values(debouncedInvalidations).forEach(({ fn }) => {
                fn.cancel();
            });
        };
    }, [debouncedInvalidations]);

    return invalidateQueries;
}; 