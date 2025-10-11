# Schichtplan Web App Design Concept

## Overview

This document establishes the unified design language for the Schichtplan employee scheduling system. Our design philosophy emphasizes clarity, efficiency, and professionalism while maintaining accessibility and user-friendliness.

## 1. Core Design Principles

### 1.1 Design Goals
- **Professional & Trustworthy**: Clean, business-appropriate aesthetic suitable for workforce management
- **Efficient & Intuitive**: Streamlined workflows that reduce cognitive load for scheduling tasks
- **Consistent & Predictable**: Uniform patterns across all pages and components
- **Accessible & Inclusive**: WCAG 2.1 AA compliant design for all users
- **Responsive & Adaptive**: Seamless experience across desktop, tablet, and mobile devices

### 1.2 Key Aesthetic Characteristics
- **Clean Lines**: Crisp borders, defined separations, geometric precision
- **Purposeful Whitespace**: Strategic spacing that creates visual hierarchy and reduces clutter
- **Clear Information Hierarchy**: Logical content flow from primary to secondary to tertiary information
- **Subtle Depth**: Minimal shadows and elevation for natural layering
- **Focused Interactions**: Clear visual feedback for all interactive elements

## 2. Design System

### 2.1 Colors
All containers should use normal border color (`border-border`) and standard width (1px). Use semantic colors for states and data visualization.

### 2.2 Typography
Use the system font stack with consistent type scale. Maintain proper heading hierarchy and readable line heights.

### 2.3 Spacing & Layout
Use the 4px-based spacing system for consistent rhythm. Container padding should be consistent across components.

### 2.4 Components
Build from Shadcn UI primitives. Use standard variants and maintain consistent patterns across the application.

## 3. Schedule Page Layout Order

Components should be arranged in this specific order:
1. **Date Selection** - Primary navigation and date range selection
2. **Version Table** - Version management and selection
3. **Statistics** - Schedule metrics and overview data
4. **Actions** - Schedule generation and management actions
5. **Schedule Table** - Main data visualization with axis switch and full-width options
6. **Color Legend** - Moved to under the table for better context

## 4. Interactive Features

### 4.1 Drag and Drop
All schedule assignments should be drag and dropable for intuitive manipulation.

### 4.2 Axis Switching
Add a toggle button to switch between employee-by-date and date-by-employee views.

### 4.3 Full Width Mode
Provide a button to toggle full-width view for better visibility of large schedules.

### 4.4 Sticky Headers
Ensure table headers remain sticky and functional after layout changes.

## 5. Implementation Guidelines

### 5.1 Border Standards
- Use `border-border` for all container borders
- Maintain 1px border width consistently
- Avoid custom border colors unless for semantic purposes

### 5.2 Component Structure
- Follow the prescribed layout order
- Maintain consistent spacing between sections
- Use proper semantic HTML structure

### 5.3 Responsive Behavior
- Ensure all new features work across breakpoints
- Maintain usability on mobile devices
- Progressive enhancement for advanced features

---

**Version**: 2.0  
**Last Updated**: December 2024  
**Focus**: Streamlined for schedule page enhancements 