// Error types and interfaces
export interface ScheduleError {
  code: string;
  message: string;
  details?: string;
  timestamp: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'validation' | 'network' | 'permission' | 'business' | 'system';
  userMessage: string;
  suggestion?: string;
  retryable: boolean;
}

export interface ErrorContext {
  component?: string;
  action?: string;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, string | number | boolean>;
}

export interface ErrorReportingConfig {
  enabled: boolean;
  endpoint?: string;
  includeStackTrace: boolean;
  includeBrowserInfo: boolean;
  maxRetries: number;
}

// Toast notification function type
interface ToastFunction {
  (options: {
    title: string;
    description?: string;
    variant?: 'default' | 'destructive';
  }): void;
}

// Logging function type
interface LogFunction {
  (level: 'info' | 'warn' | 'error', message: string, details?: Record<string, unknown>): void;
}

/**
 * Centralized error handling service for schedule-related operations
 * Provides standardized error processing, user messaging, and reporting
 */
export class ScheduleErrorHandling {
  private static instance: ScheduleErrorHandling;
  private toast: ToastFunction;
  private logger: LogFunction;
  private reportingConfig: ErrorReportingConfig;
  private errorHistory: ScheduleError[] = [];

  constructor(
    toast: ToastFunction,
    logger: LogFunction,
    reportingConfig: ErrorReportingConfig = {
      enabled: false,
      includeStackTrace: false,
      includeBrowserInfo: false,
      maxRetries: 3
    }
  ) {
    this.toast = toast;
    this.logger = logger;
    this.reportingConfig = reportingConfig;
  }

  /**
   * Get singleton instance
   */
  static getInstance(
    toast?: ToastFunction,
    logger?: LogFunction,
    reportingConfig?: ErrorReportingConfig
  ): ScheduleErrorHandling {
    if (!ScheduleErrorHandling.instance && toast && logger) {
      ScheduleErrorHandling.instance = new ScheduleErrorHandling(toast, logger, reportingConfig);
    }
    return ScheduleErrorHandling.instance;
  }

  /**
   * Main error processing method
   */
  handleError(
    error: Error | unknown,
    context: ErrorContext = {},
    showToast: boolean = true
  ): ScheduleError {
    const scheduleError = this.createScheduleError(error, context);
    
    // Log the error
    this.logError(scheduleError, context);
    
    // Store in history
    this.addToHistory(scheduleError);
    
    // Show user notification if requested
    if (showToast) {
      this.showUserNotification(scheduleError);
    }
    
    // Report if enabled
    if (this.reportingConfig.enabled) {
      this.reportError(scheduleError, context);
    }
    
    return scheduleError;
  }

  /**
   * Create standardized ScheduleError from various error types
   */
  private createScheduleError(error: Error | unknown, _context: ErrorContext): ScheduleError {
    const timestamp = new Date();
    
    // Handle known error types
    if (error instanceof Error) {
      // Network errors
      if (error.name === 'NetworkError' || error.message.includes('fetch')) {
        return {
          code: 'NETWORK_ERROR',
          message: error.message,
          details: error.stack,
          timestamp,
          severity: 'medium',
          category: 'network',
          userMessage: 'Verbindungsfehler. Bitte überprüfen Sie Ihre Internetverbindung.',
          suggestion: 'Versuchen Sie es in einem Moment erneut.',
          retryable: true
        };
      }

      // Validation errors
      if (error.message.includes('validation') || error.message.includes('invalid')) {
        return {
          code: 'VALIDATION_ERROR',
          message: error.message,
          timestamp,
          severity: 'low',
          category: 'validation',
          userMessage: 'Eingabevalidierung fehlgeschlagen.',
          suggestion: 'Überprüfen Sie Ihre Eingaben und versuchen Sie es erneut.',
          retryable: true
        };
      }

      // Permission errors
      if (error.message.includes('permission') || error.message.includes('unauthorized')) {
        return {
          code: 'PERMISSION_ERROR',
          message: error.message,
          timestamp,
          severity: 'medium',
          category: 'permission',
          userMessage: 'Sie haben nicht die erforderlichen Berechtigungen für diese Aktion.',
          suggestion: 'Wenden Sie sich an Ihren Administrator.',
          retryable: false
        };
      }

      // Business logic errors
      if (error.message.includes('conflict') || error.message.includes('business')) {
        return {
          code: 'BUSINESS_ERROR',
          message: error.message,
          timestamp,
          severity: 'medium',
          category: 'business',
          userMessage: 'Geschäftslogik-Konflikt erkannt.',
          suggestion: 'Überprüfen Sie die Daten und Geschäftsregeln.',
          retryable: true
        };
      }

      // Generic error fallback
      return {
        code: 'GENERIC_ERROR',
        message: error.message,
        details: error.stack,
        timestamp,
        severity: 'medium',
        category: 'system',
        userMessage: 'Ein unerwarteter Fehler ist aufgetreten.',
        suggestion: 'Versuchen Sie es erneut oder wenden Sie sich an den Support.',
        retryable: true
      };
    }

    // Handle HTTP response errors
    if (typeof error === 'object' && error !== null && 'status' in error) {
      const httpError = error as { status: number; statusText?: string; message?: string };
      
      return {
        code: `HTTP_${httpError.status}`,
        message: httpError.message || httpError.statusText || `HTTP ${httpError.status}`,
        timestamp,
        severity: httpError.status >= 500 ? 'high' : 'medium',
        category: 'network',
        userMessage: this.getHttpErrorMessage(httpError.status),
        suggestion: this.getHttpErrorSuggestion(httpError.status),
        retryable: httpError.status >= 500 || httpError.status === 429
      };
    }

    // Handle string errors
    if (typeof error === 'string') {
      return {
        code: 'STRING_ERROR',
        message: error,
        timestamp,
        severity: 'medium',
        category: 'system',
        userMessage: error,
        retryable: false
      };
    }

    // Unknown error type
    return {
      code: 'UNKNOWN_ERROR',
      message: 'Unknown error occurred',
      details: JSON.stringify(error),
      timestamp,
      severity: 'medium',
      category: 'system',
      userMessage: 'Ein unbekannter Fehler ist aufgetreten.',
      suggestion: 'Bitte laden Sie die Seite neu und versuchen Sie es erneut.',
      retryable: true
    };
  }

  /**
   * Get user-friendly HTTP error messages
   */
  private getHttpErrorMessage(status: number): string {
    const messages: Record<number, string> = {
      400: 'Ungültige Anfrage. Überprüfen Sie Ihre Eingaben.',
      401: 'Anmeldung erforderlich.',
      403: 'Zugriff verweigert.',
      404: 'Ressource nicht gefunden.',
      409: 'Konflikt mit bestehenden Daten.',
      422: 'Daten konnten nicht verarbeitet werden.',
      429: 'Zu viele Anfragen. Bitte warten Sie einen Moment.',
      500: 'Serverfehler. Bitte versuchen Sie es später erneut.',
      502: 'Gateway-Fehler. Service temporär nicht verfügbar.',
      503: 'Service nicht verfügbar. Bitte versuchen Sie es später erneut.'
    };

    return messages[status] || `HTTP-Fehler ${status}`;
  }

  /**
   * Get HTTP error suggestions
   */
  private getHttpErrorSuggestion(status: number): string {
    const suggestions: Record<number, string> = {
      400: 'Überprüfen Sie Ihre Eingaben und die Formatierung.',
      401: 'Melden Sie sich erneut an.',
      403: 'Wenden Sie sich an Ihren Administrator.',
      404: 'Überprüfen Sie die URL oder den Ressourcenpfad.',
      409: 'Prüfen Sie, ob die Daten bereits existieren.',
      422: 'Korrigieren Sie die Eingabedaten.',
      429: 'Warten Sie einen Moment und versuchen Sie es erneut.',
      500: 'Kontaktieren Sie den Support, falls das Problem anhält.',
      502: 'Versuchen Sie es in einigen Minuten erneut.',
      503: 'Versuchen Sie es später erneut.'
    };

    return suggestions[status] || 'Wenden Sie sich an den Support, falls das Problem anhält.';
  }

  /**
   * Log error with appropriate level
   */
  private logError(error: ScheduleError, context: ErrorContext): void {
    const logLevel = error.severity === 'critical' || error.severity === 'high' ? 'error' : 'warn';
    
    this.logger(logLevel, `[${error.code}] ${error.message}`, {
      error,
      context,
      timestamp: error.timestamp
    });
  }

  /**
   * Show user notification based on error severity
   */
  private showUserNotification(error: ScheduleError): void {
    const variant = error.severity === 'critical' || error.severity === 'high' ? 'destructive' : 'default';
    
    this.toast({
      title: error.userMessage,
      description: error.suggestion,
      variant
    });
  }

  /**
   * Store error in history for analysis
   */
  private addToHistory(error: ScheduleError): void {
    this.errorHistory.push(error);
    
    // Keep only last 100 errors
    if (this.errorHistory.length > 100) {
      this.errorHistory = this.errorHistory.slice(-100);
    }
  }

  /**
   * Report error to external service (if configured)
   */
  private async reportError(error: ScheduleError, context: ErrorContext): Promise<void> {
    if (!this.reportingConfig.endpoint) {
      return;
    }

    try {
      const reportData = {
        error: {
          ...error,
          details: this.reportingConfig.includeStackTrace ? error.details : undefined
        },
        context,
        browser: this.reportingConfig.includeBrowserInfo ? this.getBrowserInfo() : undefined,
        url: window.location.href,
        userAgent: navigator.userAgent
      };

      await fetch(this.reportingConfig.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(reportData)
      });
    } catch (reportingError) {
      this.logger('error', 'Failed to report error', { reportingError, originalError: error });
    }
  }

  /**
   * Get browser information for error reporting
   */
  private getBrowserInfo() {
    return {
      userAgent: navigator.userAgent,
      language: navigator.language,
      platform: navigator.platform,
      cookieEnabled: navigator.cookieEnabled,
      onLine: navigator.onLine,
      screen: {
        width: screen.width,
        height: screen.height,
        colorDepth: screen.colorDepth
      },
      window: {
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight
      }
    };
  }

  /**
   * Get error statistics for analysis
   */
  getErrorStatistics() {
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const recent = this.errorHistory.filter(error => error.timestamp >= last24Hours);
    
    const categories = recent.reduce((acc, error) => {
      acc[error.category] = (acc[error.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const severities = recent.reduce((acc, error) => {
      acc[error.severity] = (acc[error.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      total: this.errorHistory.length,
      last24Hours: recent.length,
      categories,
      severities,
      mostCommon: this.getMostCommonErrors(recent)
    };
  }

  /**
   * Get most common error patterns
   */
  private getMostCommonErrors(errors: ScheduleError[]) {
    const errorCounts = errors.reduce((acc, error) => {
      acc[error.code] = (acc[error.code] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(errorCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([code, count]) => ({ code, count }));
  }

  /**
   * Clear error history
   */
  clearHistory(): void {
    this.errorHistory = [];
  }

  /**
   * Update reporting configuration
   */
  updateReportingConfig(config: Partial<ErrorReportingConfig>): void {
    this.reportingConfig = { ...this.reportingConfig, ...config };
  }

  /**
   * Quick error handling methods for common scenarios
   */
  static handleValidationError(message: string): ScheduleError {
    const error = new Error(message);
    error.name = 'ValidationError';
    const instance = ScheduleErrorHandling.getInstance();
    return instance?.handleError(error, { action: 'validation' }) || {
      code: 'VALIDATION_ERROR',
      message,
      timestamp: new Date(),
      severity: 'low',
      category: 'validation',
      userMessage: message,
      retryable: true
    };
  }

  static handleNetworkError(error: Error): ScheduleError {
    error.name = 'NetworkError';
    const instance = ScheduleErrorHandling.getInstance();
    return instance?.handleError(error, { action: 'network_request' }) || {
      code: 'NETWORK_ERROR',
      message: error.message,
      timestamp: new Date(),
      severity: 'medium',
      category: 'network',
      userMessage: 'Netzwerkfehler aufgetreten.',
      retryable: true
    };
  }

  static handleBusinessError(message: string): ScheduleError {
    const error = new Error(message);
    error.name = 'BusinessError';
    const instance = ScheduleErrorHandling.getInstance();
    return instance?.handleError(error, { action: 'business_logic' }) || {
      code: 'BUSINESS_ERROR',
      message,
      timestamp: new Date(),
      severity: 'medium',
      category: 'business',
      userMessage: message,
      retryable: false
    };
  }
}

export default ScheduleErrorHandling;
