# Frontend Components Instructions

These instructions apply when working with files in `src/frontend/src/components/`.

## Component Architecture

### Component Library Structure
- `ui/` - Shadcn UI components (DO NOT modify directly)
- `layouts/` - Page layout components (PageLayout, ContentCard, ContentGrid)
- `schedule/` - Schedule-specific components
- `employees/` - Employee management components
- `ai/` - AI assistant and chat components

### Design System

Follow the established design system from `src/frontend/DESIGN_SYSTEM.md`:

**Spacing**: Use 4px-based spacing system (multiples of 4 for all margins/padding)
**Colors**: Use semantic color tokens (`border-border`, `bg-muted`, `text-destructive`)
**Layout**: Use layout components for consistency

## Component Patterns

### Standard Component Structure

```typescript
import { PageLayout, ContentCard, ContentGrid } from "@/layouts";
import { Button } from "@/components/ui/button";

interface MyComponentProps {
  title: string;
  data: DataType;
  onAction?: () => void;
}

export function MyComponent({ title, data, onAction }: MyComponentProps) {
  // Hooks at the top
  const { data: apiData, isLoading } = useApiHook();
  const navigate = useNavigate();
  
  // Loading states
  if (isLoading) return <LoadingSpinner />;
  
  // Empty states
  if (!data) return <EmptyState message="No data available" />;
  
  // Main render
  return (
    <PageLayout 
      title={title}
      breadcrumbs={[
        { href: "/", label: "Home" },
        { label: "Current", isCurrentPage: true }
      ]}
      headerActions={
        <Button onClick={onAction}>Action</Button>
      }
    >
      <ContentGrid cols={2}>
        <ContentCard title="Section">
          {/* Content */}
        </ContentCard>
      </ContentGrid>
    </PageLayout>
  );
}
```

### Type Safety

**CRITICAL**: NEVER create duplicate type definitions.

Import types from canonical sources:
```typescript
// API types
import { Employee, Schedule, Shift, Settings } from '@/services/api';

// Component types
import { ButtonProps } from '@/components/ui/button';

// Utility types
import type { ReactNode } from 'react';
```

### State Management

- **Server state**: Use React Query (via hooks in `src/frontend/hooks/`)
- **UI state**: Use React hooks (useState, useReducer)
- **Global state**: Use Context API sparingly

### API Integration

Use the centralized API client:
```typescript
import { api } from '@/services/api';

// The api client has:
// - Automatic request/response logging
// - Timeout handling
// - Error handling with AxiosError type guards
// - Credential support
```

**Check browser console** for detailed API request/response logs during development.

## AI Component Guidelines

When working with AI components (`GlobalAIAssistant.tsx`, `ConversationalAIChat.tsx`):

1. **Always include page context**:
   ```typescript
   import { useAIContext } from '@/contexts/AIContext';
   const { getContextSummary } = useAIContext();
   const context = getContextSummary();
   ```

2. **Use streaming for responses**:
   ```typescript
   import { enhancedAIService } from '@/services/enhancedAIService';
   await enhancedAIService.streamChatResponse(/* ... */);
   ```

3. **Handle AI failures gracefully**:
   - Always provide fallback UI
   - Never block workflows on AI failures
   - Show clear error messages to users

## Component Guidelines

### Layout Components

**PageLayout**: Main page wrapper
- Required: `title`
- Optional: `description`, `breadcrumbs`, `headerActions`

**ContentCard**: Section container
- Required: `title` or `children`
- Use for grouping related content

**ContentGrid**: Responsive grid
- Optional: `cols` (1-4), default is 1
- Automatically responsive on smaller screens

### Styling

- Use Tailwind CSS classes (defined in `tailwind.config.ts`)
- Follow 4px spacing increments: `p-4`, `gap-8`, `mt-12`
- Use semantic color classes: `text-foreground`, `bg-background`
- Prefer composition over prop drilling for variants

### Accessibility

- All interactive elements must be keyboard accessible
- Use semantic HTML (`button`, `nav`, `main`)
- Include ARIA labels for icon-only buttons
- Ensure color contrast meets WCAG AA standards

## Testing Components

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { MyComponent } from './MyComponent';

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent data={mockData} />);
    expect(screen.getByRole('heading')).toBeInTheDocument();
  });
  
  it('handles user interaction', () => {
    const onAction = jest.fn();
    render(<MyComponent onAction={onAction} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onAction).toHaveBeenCalled();
  });
});
```

## Common Pitfalls

1. **Duplicating type definitions** - Always import from canonical sources
2. **Inconsistent spacing** - Use 4px increments only
3. **Bypassing layout components** - Use PageLayout, ContentCard, ContentGrid
4. **Missing loading states** - Always handle loading and error states
5. **Hardcoding API URLs** - Use the api client
6. **Missing AI context** - All AI features need page context

## Performance

- Use React.memo() for expensive renders
- Memoize callbacks with useCallback()
- Memoize computed values with useMemo()
- Lazy load heavy components with React.lazy()

## Documentation

Update component documentation when:
- Adding new props or changing prop interfaces
- Modifying component behavior
- Adding new patterns or best practices
