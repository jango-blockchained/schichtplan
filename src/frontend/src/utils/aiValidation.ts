/**
 * Validation utilities for AI requests and responses
 */

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

/**
 * Maximum lengths for various fields
 */
export const VALIDATION_LIMITS = {
  MAX_MESSAGE_LENGTH: 10000,
  MAX_CONVERSATION_ID_LENGTH: 100,
  MAX_CONTEXT_SIZE: 100000, // In characters
  MAX_PROMPT_LENGTH: 50000,
} as const;

/**
 * Validate message content
 */
export function validateMessage(message: unknown): string {
  if (typeof message !== "string") {
    throw new ValidationError("Message must be a string");
  }

  const trimmed = message.trim();

  if (!trimmed) {
    throw new ValidationError("Message cannot be empty");
  }

  if (trimmed.length > VALIDATION_LIMITS.MAX_MESSAGE_LENGTH) {
    throw new ValidationError(
      `Message exceeds maximum length of ${VALIDATION_LIMITS.MAX_MESSAGE_LENGTH} characters`,
    );
  }

  return trimmed;
}

/**
 * Validate conversation ID
 */
export function validateConversationId(
  conversationId: unknown,
): string | undefined {
  if (conversationId === null || conversationId === undefined) {
    return undefined;
  }

  if (typeof conversationId !== "string") {
    throw new ValidationError("Conversation ID must be a string");
  }

  if (conversationId.length > VALIDATION_LIMITS.MAX_CONVERSATION_ID_LENGTH) {
    throw new ValidationError(
      `Conversation ID exceeds maximum length of ${VALIDATION_LIMITS.MAX_CONVERSATION_ID_LENGTH}`,
    );
  }

  // Basic UUID validation if it looks like one
  if (conversationId.includes("-")) {
    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidPattern.test(conversationId)) {
      throw new ValidationError("Invalid UUID format for conversation ID");
    }
  }

  return conversationId;
}

/**
 * Validate context object
 */
export function validateContext(
  context: unknown,
): Record<string, any> | undefined {
  if (context === null || context === undefined) {
    return undefined;
  }

  if (typeof context !== "object" || Array.isArray(context)) {
    throw new ValidationError("Context must be an object");
  }

  // Check serialization size
  try {
    const serialized = JSON.stringify(context);
    if (serialized.length > VALIDATION_LIMITS.MAX_CONTEXT_SIZE) {
      throw new ValidationError(
        `Context size exceeds maximum of ${VALIDATION_LIMITS.MAX_CONTEXT_SIZE} characters`,
      );
    }
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new ValidationError("Context is not JSON serializable");
  }

  return context as Record<string, any>;
}

/**
 * Sanitize HTML content to prevent XSS
 */
export function sanitizeHtml(html: string): string {
  const div = document.createElement("div");
  div.textContent = html;
  return div.innerHTML;
}

/**
 * Validate and sanitize AI response
 */
export function validateAIResponse(response: unknown): {
  content: string;
  metadata?: Record<string, any>;
} {
  if (
    typeof response !== "object" ||
    response === null ||
    Array.isArray(response)
  ) {
    throw new ValidationError("Invalid AI response format");
  }

  const typedResponse = response as Record<string, any>;

  if (!("content" in typedResponse)) {
    throw new ValidationError("AI response missing content field");
  }

  if (typeof typedResponse.content !== "string") {
    throw new ValidationError("AI response content must be a string");
  }

  // Sanitize content - but preserve markdown code blocks
  const content = typedResponse.content;

  return {
    content,
    metadata: typedResponse.metadata as Record<string, any> | undefined,
  };
}

/**
 * Validate complete chat request
 */
export interface ValidatedChatRequest {
  message: string;
  conversation_id?: string;
  context?: Record<string, any>;
}

export function validateChatRequest(request: {
  message: unknown;
  conversation_id?: unknown;
  context?: unknown;
}): ValidatedChatRequest {
  return {
    message: validateMessage(request.message),
    conversation_id: validateConversationId(request.conversation_id),
    context: validateContext(request.context),
  };
}

/**
 * Check if string contains suspicious patterns
 */
export function containsSuspiciousPatterns(text: string): boolean {
  const suspiciousPatterns = [
    /<script/i,
    /javascript:/i,
    /onerror=/i,
    /onload=/i,
    /eval\(/i,
    /<iframe/i,
  ];

  return suspiciousPatterns.some((pattern) => pattern.test(text));
}

/**
 * Remove suspicious patterns from text
 */
export function removeSuspiciousPatterns(text: string): string {
  let cleaned = text;

  const patterns = [
    /<script[^>]*>.*?<\/script>/gi,
    /javascript:[^"']*/gi,
    /onerror\s*=\s*["'][^"']*["']/gi,
    /onload\s*=\s*["'][^"']*["']/gi,
  ];

  patterns.forEach((pattern) => {
    cleaned = cleaned.replace(pattern, "");
  });

  return cleaned;
}

/**
 * Validate stream chunk
 */
export interface StreamChunk {
  type: "content" | "metadata" | "error" | "done";
  content?: string;
  metadata?: Record<string, any>;
  error?: string;
}

export function validateStreamChunk(chunk: unknown): StreamChunk {
  if (
    typeof chunk !== "object" ||
    chunk === null ||
    Array.isArray(chunk)
  ) {
    throw new ValidationError("Invalid stream chunk format");
  }

  const typedChunk = chunk as Record<string, any>;

  if (!("type" in typedChunk)) {
    throw new ValidationError("Stream chunk missing type field");
  }

  const validTypes = ["content", "metadata", "error", "done"];
  if (!validTypes.includes(typedChunk.type)) {
    throw new ValidationError(`Invalid stream chunk type: ${typedChunk.type}`);
  }

  return typedChunk as StreamChunk;
}

/**
 * Validate parameters object
 */
export function validateParameters(
  params: unknown,
  requiredFields?: string[],
): Record<string, any> {
  if (
    typeof params !== "object" ||
    params === null ||
    Array.isArray(params)
  ) {
    throw new ValidationError("Parameters must be an object");
  }

  const typedParams = params as Record<string, any>;

  if (requiredFields) {
    for (const field of requiredFields) {
      if (!(field in typedParams)) {
        throw new ValidationError(`Missing required field: ${field}`);
      }
    }
  }

  return typedParams;
}

/**
 * Validate date string
 */
export function validateDateString(date: unknown): string {
  if (typeof date !== "string") {
    throw new ValidationError("Date must be a string");
  }

  // Basic ISO date validation (YYYY-MM-DD)
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  if (!datePattern.test(date)) {
    throw new ValidationError(
      "Date must be in YYYY-MM-DD format",
    );
  }

  // Check if it's a valid date
  const parsed = new Date(date);
  if (isNaN(parsed.getTime())) {
    throw new ValidationError("Invalid date");
  }

  return date;
}

/**
 * Validate number within range
 */
export function validateNumber(
  value: unknown,
  min?: number,
  max?: number,
): number {
  if (typeof value !== "number" || isNaN(value)) {
    throw new ValidationError("Value must be a number");
  }

  if (min !== undefined && value < min) {
    throw new ValidationError(`Value must be at least ${min}`);
  }

  if (max !== undefined && value > max) {
    throw new ValidationError(`Value must be at most ${max}`);
  }

  return value;
}
