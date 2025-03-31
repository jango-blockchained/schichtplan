import React from 'react';
import { ShiftTemplate } from '../types';

interface ShiftTemplateFormProps {
  template: ShiftTemplate;
  onSubmit: (template: ShiftTemplate) => void;
}

export const ShiftTemplateForm = ({ template, onSubmit }: ShiftTemplateFormProps) => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(template);
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields for template editing */}
    </form>
  );
};