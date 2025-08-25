// Predefined badge configurations for common use cases
export const BADGE_CONFIGS = {
  boolean: {
    true: { label: "Yes", variant: "default" },
    false: { label: "No", variant: "secondary" }
  },
  status: {
    active: { label: "Active", variant: "default" },
    inactive: { label: "Inactive", variant: "destructive" }
  },
  keyholder: {
    true: { label: "Keyholder", variant: "secondary" },
    false: { label: "", variant: "outline" }
  }
} as const;
