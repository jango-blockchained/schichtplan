import { useCallback, useEffect, useReducer, useRef } from 'react';
import { 
  SimplifiedPDFConfig, 
  LayoutAction, 
  LayoutState, 
  DEFAULT_CONFIG,
  deepMerge,
  validateConfig,
  PRESET_TEMPLATES,
  PresetTemplate 
} from '@/types/SimplifiedPDFConfig';

const MAX_HISTORY_SIZE = 50;
const DEBOUNCE_DELAY = 300;

function layoutReducer(state: LayoutState, action: LayoutAction): LayoutState {
  switch (action.type) {
    case 'UPDATE_CONFIG': {
      const newConfig = deepMerge(state.config, action.payload as Partial<SimplifiedPDFConfig>);
      const newHistory = state.history.slice(0, state.historyIndex + 1);
      newHistory.push(newConfig);
      
      // Limit history size
      if (newHistory.length > MAX_HISTORY_SIZE) {
        newHistory.shift();
      }
      
      return {
        ...state,
        config: newConfig,
        history: newHistory,
        historyIndex: newHistory.length - 1,
        canUndo: true,
        canRedo: false,
        isDirty: true,
        lastSaved: undefined,
      };
    }
    
    case 'APPLY_PRESET': {
      const preset = action.payload as PresetTemplate;
      const newConfig = deepMerge(DEFAULT_CONFIG, preset.config);
      const newHistory = state.history.slice(0, state.historyIndex + 1);
      newHistory.push(newConfig);
      
      if (newHistory.length > MAX_HISTORY_SIZE) {
        newHistory.shift();
      }
      
      return {
        ...state,
        config: newConfig,
        history: newHistory,
        historyIndex: newHistory.length - 1,
        canUndo: true,
        canRedo: false,
        isDirty: true,
        lastSaved: undefined,
      };
    }
    
    case 'UNDO': {
      if (state.canUndo && state.historyIndex > 0) {
        const newIndex = state.historyIndex - 1;
        return {
          ...state,
          config: state.history[newIndex],
          historyIndex: newIndex,
          canUndo: newIndex > 0,
          canRedo: true,
          isDirty: true,
        };
      }
      return state;
    }
    
    case 'REDO': {
      if (state.canRedo && state.historyIndex < state.history.length - 1) {
        const newIndex = state.historyIndex + 1;
        return {
          ...state,
          config: state.history[newIndex],
          historyIndex: newIndex,
          canUndo: true,
          canRedo: newIndex < state.history.length - 1,
          isDirty: true,
        };
      }
      return state;
    }
    
    case 'RESET': {
      const newHistory = [DEFAULT_CONFIG];
      return {
        ...state,
        config: DEFAULT_CONFIG,
        history: newHistory,
        historyIndex: 0,
        canUndo: false,
        canRedo: false,
        isDirty: false,
        lastSaved: new Date(),
      };
    }
    
    default:
      return state;
  }
}

function createInitialState(initialConfig?: Partial<SimplifiedPDFConfig>): LayoutState {
  const config = initialConfig ? deepMerge(DEFAULT_CONFIG, initialConfig) : DEFAULT_CONFIG;
  return {
    config,
    history: [config],
    historyIndex: 0,
    canUndo: false,
    canRedo: false,
    isDirty: false,
    lastSaved: new Date(),
  };
}

export interface UsePDFLayoutStateOptions {
  initialConfig?: Partial<SimplifiedPDFConfig>;
  autoSave?: boolean;
  autoSaveKey?: string;
  onConfigChange?: (config: SimplifiedPDFConfig) => void;
  onSave?: (config: SimplifiedPDFConfig) => Promise<void>;
}

export function usePDFLayoutState(options: UsePDFLayoutStateOptions = {}) {
  const {
    initialConfig,
    autoSave = true,
    autoSaveKey = 'pdf-layout-config',
    onConfigChange,
    onSave,
  } = options;

  const [state, dispatch] = useReducer(layoutReducer, createInitialState(initialConfig));
  const saveTimeoutRef = useRef<NodeJS.Timeout>();
  const configChangeTimeoutRef = useRef<NodeJS.Timeout>();

  // Load from localStorage on mount
  useEffect(() => {
    if (autoSave && autoSaveKey) {
      try {
        const saved = localStorage.getItem(autoSaveKey);
        if (saved) {
          const savedConfig = JSON.parse(saved) as SimplifiedPDFConfig;
          const errors = validateConfig(savedConfig);
          if (errors.length === 0) {
            dispatch({ type: 'UPDATE_CONFIG', payload: savedConfig });
          }
        }
      } catch (error) {
        console.warn('Failed to load saved PDF layout config:', error);
      }
    }
  }, [autoSave, autoSaveKey]);

  // Auto-save to localStorage
  useEffect(() => {
    if (autoSave && autoSaveKey && state.isDirty) {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      
      saveTimeoutRef.current = setTimeout(() => {
        try {
          localStorage.setItem(autoSaveKey, JSON.stringify(state.config));
        } catch (error) {
          console.warn('Failed to auto-save PDF layout config:', error);
        }
      }, DEBOUNCE_DELAY);
    }
  }, [state.config, state.isDirty, autoSave, autoSaveKey]);

  // Debounced config change callback
  useEffect(() => {
    if (onConfigChange) {
      if (configChangeTimeoutRef.current) {
        clearTimeout(configChangeTimeoutRef.current);
      }
      
      configChangeTimeoutRef.current = setTimeout(() => {
        onConfigChange(state.config);
      }, DEBOUNCE_DELAY);
    }
  }, [state.config, onConfigChange]);

  // Cleanup timeouts
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      if (configChangeTimeoutRef.current) {
        clearTimeout(configChangeTimeoutRef.current);
      }
    };
  }, []);

  const updateConfig = useCallback((updates: Partial<SimplifiedPDFConfig>) => {
    const errors = validateConfig(updates);
    if (errors.length > 0) {
      console.warn('Config validation errors:', errors);
      return false;
    }
    
    dispatch({ type: 'UPDATE_CONFIG', payload: updates });
    return true;
  }, []);

  const applyPreset = useCallback((presetId: string) => {
    const preset = PRESET_TEMPLATES.find(p => p.id === presetId);
    if (preset) {
      dispatch({ type: 'APPLY_PRESET', payload: preset });
      return true;
    }
    return false;
  }, []);

  const undo = useCallback(() => {
    dispatch({ type: 'UNDO' });
  }, []);

  const redo = useCallback(() => {
    dispatch({ type: 'REDO' });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  const save = useCallback(async () => {
    if (onSave) {
      try {
        await onSave(state.config);
        return true;
      } catch (error) {
        console.error('Failed to save config:', error);
        return false;
      }
    }
    return true;
  }, [state.config, onSave]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey) {
        switch (event.key) {
          case 'z':
            event.preventDefault();
            undo();
            break;
          case 'y':
            event.preventDefault();
            redo();
            break;
          case 's':
            event.preventDefault();
            save();
            break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, save]);

  return {
    // State
    config: state.config,
    canUndo: state.canUndo,
    canRedo: state.canRedo,
    isDirty: state.isDirty,
    lastSaved: state.lastSaved,
    
    // Actions
    updateConfig,
    applyPreset,
    undo,
    redo,
    reset,
    save,
    
    // Validation
    validateConfig: (config: Partial<SimplifiedPDFConfig>) => validateConfig(config),
  };
}
