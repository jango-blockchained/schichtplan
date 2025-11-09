# AI Settings Panel Refactoring Implementation Plan

## Goal
Remove redundant save logic from AISettingsPanel and use the unified settings system.

## Current Issues
1. AISettingsPanel has its own `handleSaveSettings` function (lines 284-336)
2. Uses local `isLoading` and `hasChanges` state instead of React Query
3. Manual `useEffect` for loading settings instead of `useQuery`
4. Not integrated with app-wide settings cache

## Required Changes

### Step 1: Update Imports
**File**: `src/frontend/src/components/ai/AISettingsPanel.tsx`

Add:
```typescript
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDebouncedCallback } from "use-debounce";
import type { Settings } from "@/services/api";
```

### Step 2: Replace Data Fetching with React Query

**Remove** (lines 170-245):
```typescript
useEffect(() => {
  const loadSettings = async () => {
    try {
      const settings = await getSettings();
      // ... manual state setting
    } catch (error) {
      console.error("Failed to load AI settings:", error);
      toast.error("Failed to load AI settings");
    }
  };
  loadSettings();
}, []);
```

**Replace with**:
```typescript
const queryClient = useQueryClient();

const { data: settings, isLoading: isLoadingSettings } = useQuery<Settings>({
  queryKey: ["settings"],
  queryFn: getSettings,
  staleTime: 1000 * 60 * 5, // 5 minutes
  refetchOnWindowFocus: false,
});

const aiScheduling = settings?.ai_scheduling || {};
```

### Step 3: Replace Save Logic with Mutation

**Remove** (lines 284-336):
```typescript
const handleSaveSettings = async () => {
  setIsLoading(true);
  try {
    const updatedSettings = { ai_scheduling: { ... } };
    await updateSettings(updatedSettings);
    setHasChanges(false);
    toast.success("AI settings saved successfully");
  } catch (error) {
    console.error("Failed to save settings:", error);
    toast.error("Failed to save AI settings");
  } finally {
    setIsLoading(false);
  }
};
```

**Replace with**:
```typescript
const mutation = useMutation<Settings, Error, Settings>({
  mutationFn: updateSettings,
  onSuccess: (data) => {
    queryClient.setQueryData(["settings"], data);
    toast.success("AI settings saved successfully");
  },
  onError: (error: Error) => {
    toast.error(`Failed to save AI settings: ${error.message}`);
  },
});

const debouncedUpdateSettings = useDebouncedCallback(
  (updatedSettings: Settings) => {
    mutation.mutate(updatedSettings);
  },
  2000 // 2 second debounce like UnifiedSettingsPage
);

const updateAISettings = (updates: Partial<Settings["ai_scheduling"]>) => {
  if (!settings) return;
  
  const updatedSettings: Settings = {
    ...settings,
    ai_scheduling: {
      ...aiScheduling,
      ...updates,
    },
  };
  
  debouncedUpdateSettings(updatedSettings);
};
```

### Step 4: Remove Local State

**Remove**:
```typescript
const [aiSettings, setAISettings] = useState<AISettings>({ ... });
const [agentSettings, setAgentSettings] = useState<AgentSettings>({ ... });
const [systemSettings, setSystemSettings] = useState<SystemSettings>({ ... });
const [isLoading, setIsLoading] = useState(false);
const [hasChanges, setHasChanges] = useState(false);
```

**Keep** (for status polling):
```typescript
const [providerStatus, setProviderStatus] = useState<ProviderStatus[]>([]);
const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
const [isLoadingStatus, setIsLoadingStatus] = useState(false);
```

### Step 5: Update All Input Handlers

**Replace patterns like**:
```typescript
onValueChange={(value) =>
  setAISettings((prev) => ({ ...prev, provider: value }))
}
```

**With**:
```typescript
onValueChange={(value) =>
  updateAISettings({ provider: value })
}
```

**Example for each setting type**:

Select/dropdown:
```typescript
<Select
  value={aiScheduling.provider || "gemini"}
  onValueChange={(value) => updateAISettings({ provider: value })}
>
```

Slider:
```typescript
<Slider
  value={[aiScheduling.temperature || 0.7]}
  onValueChange={([value]) => updateAISettings({ temperature: value })}
/>
```

Input:
```typescript
<Input
  type="number"
  value={aiScheduling.max_tokens || 2048}
  onChange={(e) => updateAISettings({ max_tokens: Number(e.target.value) })}
/>
```

Switch:
```typescript
<Switch
  checked={aiScheduling.fallback_enabled ?? true}
  onCheckedChange={(checked) => updateAISettings({ fallback_enabled: checked })}
/>
```

### Step 6: Update Header Buttons

**Replace**:
```typescript
<div className="flex items-center gap-2">
  {hasChanges && (
    <Badge variant="secondary" className="flex items-center gap-1">
      <AlertTriangle className="h-3 w-3" />
      Unsaved changes
    </Badge>
  )}
  <Button size="sm" variant="outline" onClick={handleResetSettings}>
    <RefreshCw className="h-4 w-4" />
  </Button>
  <Button
    size="sm"
    onClick={handleSaveSettings}
    disabled={isLoading || !hasChanges}
  >
    {isLoading ? (
      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
    ) : (
      <Save className="h-4 w-4 mr-2" />
    )}
    Save
  </Button>
</div>
```

**With**:
```typescript
<div className="flex items-center gap-2">
  {mutation.isPending && (
    <Badge variant="secondary" className="flex items-center gap-1">
      <RefreshCw className="h-3 w-3 animate-spin" />
      Saving...
    </Badge>
  )}
  <Button
    size="sm"
    onClick={() => {
      debouncedUpdateSettings.cancel();
      if (settings) mutation.mutate(settings);
    }}
    disabled={mutation.isPending}
  >
    {mutation.isPending ? (
      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
    ) : (
      <Save className="h-4 w-4 mr-2" />
    )}
    Save Now
  </Button>
</div>
```

### Step 7: Add Loading State

**Add after React Query hooks**:
```typescript
if (isLoadingSettings) {
  return (
    <Card>
      <CardContent className="p-8 flex items-center justify-center">
        <RefreshCw className="h-6 w-6 animate-spin mr-2" />
        <span>Loading AI settings...</span>
      </CardContent>
    </Card>
  );
}
```

### Step 8: Update Agents Tab

For nested settings like agents:
```typescript
const updateAgentSettings = (
  agentKey: keyof Settings["ai_scheduling"]["agents"],
  updates: any
) => {
  if (!settings) return;
  
  const currentAgents = aiScheduling.agents || {};
  const updatedSettings: Settings = {
    ...settings,
    ai_scheduling: {
      ...aiScheduling,
      agents: {
        ...currentAgents,
        [agentKey]: {
          ...(currentAgents[agentKey] || {}),
          ...updates,
        },
      },
    },
  };
  
  debouncedUpdateSettings(updatedSettings);
};

// Usage:
updateAgentSettings("schedule_optimizer", { enabled: true });
```

### Step 9: Update System Tab

Similar helper for system settings:
```typescript
const updateSystemSettings = (updates: Partial<Settings["ai_scheduling"]["system"]>) => {
  if (!settings) return;
  
  const currentSystem = aiScheduling.system || {};
  const updatedSettings: Settings = {
    ...settings,
    ai_scheduling: {
      ...aiScheduling,
      system: {
        ...currentSystem,
        ...updates,
      },
    },
  };
  
  debouncedUpdateSettings(updatedSettings);
};
```

## Testing Checklist

After refactoring:
- [ ] Component loads without errors
- [ ] Settings populate correctly from backend
- [ ] Changing a setting triggers debounced save (2s delay)
- [ ] Manual "Save Now" button works immediately
- [ ] Loading state shows correctly
- [ ] Error states display properly
- [ ] Provider status still polls correctly (30s)
- [ ] System health still polls correctly (30s)
- [ ] All tabs work (AI, Agents, System)
- [ ] Settings persist after page reload
- [ ] React Query cache updates properly

## Estimated Effort
- Code changes: 3-4 hours
- Testing: 1-2 hours
- Documentation: 30 minutes
- **Total**: 4-6 hours

## Benefits
1. **Consistency**: Aligns with UnifiedSettingsPage approach
2. **Performance**: React Query caching reduces API calls
3. **UX**: Auto-save with debounce improves user experience
4. **Maintainability**: Less code, standard patterns
5. **Bug Prevention**: Unified state management reduces inconsistencies

## Risks & Mitigation
- **Risk**: Breaking existing functionality
  - **Mitigation**: Comprehensive testing, backup old file first
- **Risk**: Different behavior from current implementation
  - **Mitigation**: Maintain same debounce delay (2s), same save UX
- **Risk**: Type errors with Settings interface
  - **Mitigation**: Use proper TypeScript types from api.ts

## Follow-up Tasks
After this refactor:
1. Implement or remove non-functional settings
2. Add API key management to AISettingsPanel
3. Add integration tests for settings save
4. Document settings behavior for users
