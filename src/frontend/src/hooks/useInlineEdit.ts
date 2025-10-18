import { useCallback, useState } from "react";

export interface InlineEditState<T> {
  editingItems: Map<string | number, Partial<T>>;
  isEditing: (id: string | number) => boolean;
  getEditValue: (id: string | number, field: keyof T) => T[keyof T] | undefined;
  startEdit: (id: string | number, item: T) => void;
  updateField: (id: string | number, field: keyof T, value: T[keyof T]) => void;
  cancelEdit: (id: string | number) => void;
  saveEdit: (id: string | number) => Promise<void>;
  saveAll: () => Promise<void>;
  cancelAll: () => void;
  hasChanges: boolean;
}

export interface UseInlineEditOptions<T> {
  onUpdate: (id: string | number, changes: Partial<T>) => Promise<void>;
  onError?: (error: Error) => void;
}

export function useInlineEdit<T extends { id: string | number }>({
  onUpdate,
  onError,
}: UseInlineEditOptions<T>): InlineEditState<T> {
  const [editingItems, setEditingItems] = useState<
    Map<string | number, Partial<T>>
  >(new Map());

  const isEditing = useCallback(
    (id: string | number) => {
      return editingItems.has(id);
    },
    [editingItems],
  );

  const getEditValue = useCallback(
    (id: string | number, field: keyof T) => {
      const editData = editingItems.get(id);
      return editData?.[field];
    },
    [editingItems],
  );

  const startEdit = useCallback((id: string | number, item: T) => {
    setEditingItems((prev) => new Map(prev).set(id, { ...item }));
  }, []);

  const updateField = useCallback(
    (id: string | number, field: keyof T, value: T[keyof T]) => {
      setEditingItems((prev) => {
        const newMap = new Map(prev);
        const existing = newMap.get(id) || {};
        newMap.set(id, { ...existing, [field]: value });
        return newMap;
      });
    },
    [],
  );

  const cancelEdit = useCallback((id: string | number) => {
    setEditingItems((prev) => {
      const newMap = new Map(prev);
      newMap.delete(id);
      return newMap;
    });
  }, []);

  const saveEdit = useCallback(
    async (id: string | number) => {
      const changes = editingItems.get(id);
      if (!changes) return;

      try {
        await onUpdate(id, changes);
        setEditingItems((prev) => {
          const newMap = new Map(prev);
          newMap.delete(id);
          return newMap;
        });
      } catch (error) {
        onError?.(error as Error);
      }
    },
    [editingItems, onUpdate, onError],
  );

  const saveAll = useCallback(async () => {
    const promises = Array.from(editingItems.entries()).map(([id, changes]) =>
      onUpdate(id, changes),
    );

    try {
      await Promise.all(promises);
      setEditingItems(new Map());
    } catch (error) {
      onError?.(error as Error);
    }
  }, [editingItems, onUpdate, onError]);

  const cancelAll = useCallback(() => {
    setEditingItems(new Map());
  }, []);

  const hasChanges = editingItems.size > 0;

  return {
    editingItems,
    isEditing,
    getEditValue,
    startEdit,
    updateField,
    cancelEdit,
    saveEdit,
    saveAll,
    cancelAll,
    hasChanges,
  };
}
