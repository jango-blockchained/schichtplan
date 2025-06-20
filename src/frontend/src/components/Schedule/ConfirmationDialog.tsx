import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface ConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  details?: string[];
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'destructive';
  isLoading?: boolean;
}

export function ConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  details,
  confirmText = "Bestätigen",
  cancelText = "Abbrechen",
  variant = 'default',
  isLoading = false,
}: ConfirmationDialogProps) {
  const handleConfirm = () => {
    onConfirm();
    if (!isLoading) {
      onClose();
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className={variant === 'destructive' ? 'text-destructive' : ''}>
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription>
            <div className="space-y-2">
              <p>{message}</p>
              {details && details.length > 0 && (
                <div className={`mt-3 text-sm border-l-4 pl-3 py-1 ${
                  variant === 'destructive' 
                    ? 'border-destructive bg-destructive/5' 
                    : 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                }`}>
                  {details.map((detail, i) => (
                    <p key={i}>{detail}</p>
                  ))}
                </div>
              )}
              {variant === 'destructive' && (
                <p className="mt-3 font-medium text-destructive">
                  Wirklich fortsetzen?
                </p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose} disabled={isLoading}>
            {cancelText}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isLoading}
            className={variant === 'destructive' 
              ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' 
              : ''
            }
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Wird verarbeitet...
              </div>
            ) : (
              confirmText
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
