# Schichtplan Design System

This document provides practical guidance for developers working with the Schichtplan unified design system.

## Quick Start

### Using Layout Components

```typescript
import { PageLayout, ContentCard, ContentGrid } from "@/layouts";

function MyPage() {
  return (
    <PageLayout
      title="My Page"
      description="Page description"
      breadcrumbs={[
        { href: "/", label: "Home" },
        { label: "Current Page", isCurrentPage: true }
      ]}
      headerActions={<Button>Action</Button>}
    >
      <ContentGrid cols={2}>
        <ContentCard title="Card 1">
          Content here
        </ContentCard>
        <ContentCard title="Card 2">
          Content here
        </ContentCard>
      </ContentGrid>
    </PageLayout>
  );
}
```

### Using Settings Layout

```typescript
import { SettingsLayout } from "@/layouts";

function SettingsPage() {
  const tabs = [
    {
      id: "general",
      label: "General",
      sections: [
        {
          id: "basic",
          title: "Basic Settings",
          description: "Configure basic options",
          children: <YourFormComponents />
        }
      ]
    }
  ];

  return (
    <SettingsLayout
      title="Settings"
      description="Configure your application"
      tabs={tabs}
    />
  );
}
```

## Component Guidelines

### Buttons

Use semantic button variants:

```typescript
// Primary actions
<Button variant="default">Save</Button>

// Secondary actions
<Button variant="outline">Cancel</Button>

// Subtle actions
<Button variant="ghost">Edit</Button>

// Destructive actions
<Button variant="destructive">Delete</Button>
```

### Cards

Always use structured card components:

```typescript
<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <CardDescription>Description</CardDescription>
  </CardHeader>
  <CardContent>
    {/* Content */}
  </CardContent>
  <CardFooter>
    {/* Actions */}
  </CardFooter>
</Card>
```

### Forms

Use consistent form patterns:

```typescript
<Form {...form}>
  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
    <FormField
      control={form.control}
      name="fieldName"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Label</FormLabel>
          <FormControl>
            <Input {...field} />
          </FormControl>
          <FormDescription>Help text</FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  </form>
</Form>
```

## Spacing & Layout

### Consistent Spacing

Use the spacing scale for consistent layouts:

```typescript
// Component spacing
<div className="space-y-6"> {/* 24px vertical spacing */}
<div className="space-x-4"> {/* 16px horizontal spacing */}
<div className="gap-3">     {/* 12px grid gap */}

// Padding & margins
<div className="p-4">       {/* 16px padding */}
<div className="px-6 py-4"> {/* 24px horizontal, 16px vertical */}
<div className="mb-8">      {/* 32px bottom margin */}
```

### Grid Layouts

Use the ContentGrid component for consistent grids:

```typescript
// 2-column grid (responsive)
<ContentGrid cols={2}>
  {items.map(item => <ContentCard key={item.id} />)}
</ContentGrid>

// 3-column grid
<ContentGrid cols={3}>
  {items.map(item => <ContentCard key={item.id} />)}
</ContentGrid>
```

## Typography

### Heading Hierarchy

```typescript
<h1 className="text-3xl font-semibold tracking-tight">Page Title</h1>
<h2 className="text-2xl font-semibold tracking-tight">Section Header</h2>
<h3 className="text-xl font-medium">Subsection Header</h3>
<h4 className="text-lg font-medium">Card Title</h4>
```

### Text Styles

```typescript
<p className="text-base">Body text</p>
<p className="text-sm text-muted-foreground">Secondary text</p>
<p className="text-xs text-muted-foreground">Caption text</p>
```

## Color Usage

### Semantic Colors

```typescript
// Status indicators
<Badge variant="default">Active</Badge>
<Badge variant="secondary">Pending</Badge>
<Badge variant="destructive">Error</Badge>

// Alerts
<Alert>
  <AlertCircle className="h-4 w-4" />
  <AlertTitle>Info</AlertTitle>
  <AlertDescription>Message</AlertDescription>
</Alert>
```

### Custom Color Classes

```typescript
// Background colors
className="bg-background"    // Main background
className="bg-card"          // Card background
className="bg-muted"         // Subtle background

// Text colors
className="text-foreground"        // Primary text
className="text-muted-foreground"  // Secondary text

// Border colors
className="border-border"    // Standard borders
className="border-input"     // Input borders
```

## Responsive Design

### Breakpoints

```typescript
// Mobile-first approach
className="text-sm md:text-base lg:text-lg"
className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
className="p-4 md:p-6 lg:p-8"
```

### Common Responsive Patterns

```typescript
// Navigation
className="hidden md:flex"           // Hide on mobile
className="md:hidden"                // Show only on mobile

// Spacing
className="space-y-4 md:space-y-6"   // Smaller spacing on mobile
className="px-4 md:px-6 lg:px-8"     // Progressive padding
```

## Animations

### Available Animation Classes

```typescript
className="animate-fade-in"          // Fade in from bottom
className="animate-slide-in-left"    // Slide in from left
className="animate-slide-in-right"   // Slide in from right
className="animate-scale-in"         // Scale in

className="transition-smooth"        // Smooth transitions
className="transition-fast"          // Fast transitions
className="hover-lift"               // Hover lift effect
```

### Custom Animations

```typescript
// Using CSS variables
style={{
  animationDuration: 'var(--duration-normal)',
  animationTimingFunction: 'var(--ease-out)'
}}
```

## Accessibility

### Focus Management

```typescript
// Always include focus styles
className="focus-ring"  // Standard focus ring

// Keyboard navigation
<Button onKeyDown={handleKeyDown}>
```

### ARIA Labels

```typescript
<Button aria-label="Close dialog">
  <X className="h-4 w-4" />
</Button>

<Input aria-describedby="help-text" />
<div id="help-text">Help text</div>
```

## Common Patterns

### Loading States

```typescript
{isLoading ? (
  <div className="space-y-2">
    <Skeleton className="h-4 w-full" />
    <Skeleton className="h-4 w-3/4" />
  </div>
) : (
  <div>Content</div>
)}
```

### Error States

```typescript
{error && (
  <Alert variant="destructive">
    <AlertCircle className="h-4 w-4" />
    <AlertTitle>Error</AlertTitle>
    <AlertDescription>{error.message}</AlertDescription>
  </Alert>
)}
```

### Empty States

```typescript
<div className="text-center py-8">
  <div className="text-muted-foreground mb-4">
    <Icon className="h-12 w-12 mx-auto" />
  </div>
  <h3 className="text-lg font-medium mb-2">No items found</h3>
  <p className="text-sm text-muted-foreground mb-4">
    Get started by creating your first item.
  </p>
  <Button>Create Item</Button>
</div>
```

## Best Practices

### Component Composition

- Build complex components from shadcn-ui primitives
- Use layout components for consistent structure
- Prefer composition over customization

### Performance

- Use skeleton loaders for better perceived performance
- Implement proper loading states
- Optimize image usage with appropriate formats

### Consistency

- Always use the design system components
- Follow the established spacing scale
- Maintain consistent interaction patterns

## Demo and Documentation

Visit `/design-system` in the application to see live examples of all components and patterns in action.

## Support

For questions about the design system or to suggest improvements, please refer to the design concept document at `docs/design_concept.md` or reach out to the development team. 