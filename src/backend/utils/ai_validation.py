"""
Validation utilities for AI requests and responses.

Provides input sanitization, output validation, and security checks
for AI-related operations.
"""

import json
import logging
import re
from typing import Any

logger = logging.getLogger(__name__)


class ValidationError(Exception):
    """Exception raised for validation failures."""

    pass


class AIRequestValidator:
    """Validator for AI requests."""

    # Maximum lengths for various fields
    MAX_PROMPT_LENGTH = 50000
    MAX_CONVERSATION_ID_LENGTH = 100
    MAX_USER_ID_LENGTH = 100
    MAX_MESSAGE_LENGTH = 10000
    MAX_CONTEXT_SIZE = 100000  # In characters

    # Patterns
    UUID_PATTERN = re.compile(
        r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.IGNORECASE
    )
    SAFE_STRING_PATTERN = re.compile(r"^[a-zA-Z0-9_\-]+$")

    @classmethod
    def validate_prompt(cls, prompt: str) -> str:
        """Validate and sanitize AI prompt.

        Args:
            prompt: User prompt to validate

        Returns:
            Sanitized prompt

        Raises:
            ValidationError: If prompt is invalid
        """
        if not prompt or not isinstance(prompt, str):
            raise ValidationError("Prompt must be a non-empty string")

        # Strip whitespace
        prompt = prompt.strip()

        if not prompt:
            raise ValidationError("Prompt cannot be empty after stripping whitespace")

        if len(prompt) > cls.MAX_PROMPT_LENGTH:
            raise ValidationError(
                f"Prompt exceeds maximum length of {cls.MAX_PROMPT_LENGTH} characters"
            )

        # Check for suspicious patterns (basic XSS prevention)
        suspicious_patterns = [
            r"<script",
            r"javascript:",
            r"onerror=",
            r"onload=",
            r"eval\(",
        ]

        for pattern in suspicious_patterns:
            if re.search(pattern, prompt, re.IGNORECASE):
                logger.warning(f"Suspicious pattern detected in prompt: {pattern}")
                # Remove suspicious content
                prompt = re.sub(pattern, "", prompt, flags=re.IGNORECASE)

        return prompt

    @classmethod
    def validate_conversation_id(cls, conversation_id: str | None) -> str | None:
        """Validate conversation ID.

        Args:
            conversation_id: Conversation ID to validate

        Returns:
            Validated conversation ID or None

        Raises:
            ValidationError: If conversation ID is invalid
        """
        if conversation_id is None:
            return None

        if not isinstance(conversation_id, str):
            raise ValidationError("Conversation ID must be a string")

        if len(conversation_id) > cls.MAX_CONVERSATION_ID_LENGTH:
            raise ValidationError(
                f"Conversation ID exceeds maximum length of {cls.MAX_CONVERSATION_ID_LENGTH}"
            )

        # Validate UUID format if it looks like a UUID
        if "-" in conversation_id and not cls.UUID_PATTERN.match(conversation_id):
            raise ValidationError("Invalid UUID format for conversation ID")

        return conversation_id

    @classmethod
    def validate_user_id(cls, user_id: str | None) -> str | None:
        """Validate user ID.

        Args:
            user_id: User ID to validate

        Returns:
            Validated user ID or None

        Raises:
            ValidationError: If user ID is invalid
        """
        if user_id is None:
            return None

        if not isinstance(user_id, str):
            raise ValidationError("User ID must be a string")

        if len(user_id) > cls.MAX_USER_ID_LENGTH:
            raise ValidationError(
                f"User ID exceeds maximum length of {cls.MAX_USER_ID_LENGTH}"
            )

        # Allow alphanumeric, underscore, and hyphen
        if not cls.SAFE_STRING_PATTERN.match(user_id):
            raise ValidationError(
                "User ID contains invalid characters (only alphanumeric, underscore, hyphen allowed)"
            )

        return user_id

    @classmethod
    def validate_message(cls, message: str) -> str:
        """Validate chat message.

        Args:
            message: Message to validate

        Returns:
            Sanitized message

        Raises:
            ValidationError: If message is invalid
        """
        if not message or not isinstance(message, str):
            raise ValidationError("Message must be a non-empty string")

        message = message.strip()

        if not message:
            raise ValidationError("Message cannot be empty")

        if len(message) > cls.MAX_MESSAGE_LENGTH:
            raise ValidationError(
                f"Message exceeds maximum length of {cls.MAX_MESSAGE_LENGTH} characters"
            )

        return message

    @classmethod
    def validate_context(cls, context: dict[str, Any] | None) -> dict[str, Any] | None:
        """Validate context dictionary.

        Args:
            context: Context dictionary to validate

        Returns:
            Validated context or None

        Raises:
            ValidationError: If context is invalid
        """
        if context is None:
            return None

        if not isinstance(context, dict):
            raise ValidationError("Context must be a dictionary")

        # Check serialization size
        try:
            serialized = json.dumps(context)
            if len(serialized) > cls.MAX_CONTEXT_SIZE:
                raise ValidationError(
                    f"Context size exceeds maximum of {cls.MAX_CONTEXT_SIZE} characters"
                )
        except (TypeError, ValueError) as e:
            raise ValidationError(f"Context is not JSON serializable: {e}")

        return context

    @classmethod
    def validate_model_name(cls, model_name: str | None) -> str | None:
        """Validate AI model name.

        Args:
            model_name: Model name to validate

        Returns:
            Validated model name or None

        Raises:
            ValidationError: If model name is invalid
        """
        if model_name is None:
            return None

        if not isinstance(model_name, str):
            raise ValidationError("Model name must be a string")

        # Whitelist known models
        valid_models = {
            "gpt-4o",
            "gpt-4o-mini",
            "gpt-4-turbo",
            "gpt-3.5-turbo",
            "claude-3-5-sonnet-20241022",
            "claude-3-opus-20240229",
            "claude-3-sonnet-20240229",
            "claude-3-haiku-20240307",
            "gemini-1.5-pro",
            "gemini-1.5-flash",
        }

        if model_name not in valid_models:
            logger.warning(f"Unknown model name: {model_name}")
            # Allow it but log warning
            return model_name

        return model_name


class AIResponseValidator:
    """Validator for AI responses."""

    MAX_RESPONSE_LENGTH = 100000
    MAX_TOOL_CALLS = 20

    @classmethod
    def validate_response(cls, response: dict[str, Any]) -> dict[str, Any]:
        """Validate AI response structure.

        Args:
            response: Response to validate

        Returns:
            Validated response

        Raises:
            ValidationError: If response is invalid
        """
        if not isinstance(response, dict):
            raise ValidationError("Response must be a dictionary")

        # Check required fields
        if "content" not in response:
            raise ValidationError("Response must contain 'content' field")

        content = response["content"]
        if not isinstance(content, str):
            raise ValidationError("Response content must be a string")

        if len(content) > cls.MAX_RESPONSE_LENGTH:
            raise ValidationError(
                f"Response content exceeds maximum length of {cls.MAX_RESPONSE_LENGTH}"
            )

        # Validate tool calls if present
        if "tool_calls" in response:
            tool_calls = response["tool_calls"]
            if not isinstance(tool_calls, list):
                raise ValidationError("Tool calls must be a list")

            if len(tool_calls) > cls.MAX_TOOL_CALLS:
                raise ValidationError(
                    f"Number of tool calls exceeds maximum of {cls.MAX_TOOL_CALLS}"
                )

            for i, tool_call in enumerate(tool_calls):
                if not isinstance(tool_call, dict):
                    raise ValidationError(f"Tool call {i} must be a dictionary")

                if "name" not in tool_call:
                    raise ValidationError(f"Tool call {i} missing 'name' field")

        return response

    @classmethod
    def sanitize_response_content(cls, content: str) -> str:
        """Sanitize AI response content.

        Args:
            content: Content to sanitize

        Returns:
            Sanitized content
        """
        if not content:
            return content

        # Remove potential code injection
        content = content.replace("```python\nimport os", "```python\n# import os")
        content = content.replace("```python\nimport sys", "```python\n# import sys")

        # Basic HTML escaping for display
        html_chars = {
            "<": "&lt;",
            ">": "&gt;",
            "&": "&amp;",
            '"': "&quot;",
            "'": "&#x27;",
        }

        # Only escape HTML in non-code blocks
        lines = content.split("\n")
        in_code_block = False
        sanitized_lines = []

        for line in lines:
            if line.startswith("```"):
                in_code_block = not in_code_block
                sanitized_lines.append(line)
            elif not in_code_block:
                # Escape HTML outside code blocks
                for char, escaped in html_chars.items():
                    line = line.replace(char, escaped)
                sanitized_lines.append(line)
            else:
                sanitized_lines.append(line)

        return "\n".join(sanitized_lines)


def validate_ai_request(
    message: str,
    conversation_id: str | None = None,
    user_id: str | None = None,
    context: dict[str, Any] | None = None,
    model: str | None = None,
) -> dict[str, Any]:
    """Validate complete AI request.

    Args:
        message: User message
        conversation_id: Optional conversation ID
        user_id: Optional user ID
        context: Optional context
        model: Optional model name

    Returns:
        Dictionary of validated parameters

    Raises:
        ValidationError: If validation fails
    """
    return {
        "message": AIRequestValidator.validate_message(message),
        "conversation_id": AIRequestValidator.validate_conversation_id(conversation_id),
        "user_id": AIRequestValidator.validate_user_id(user_id),
        "context": AIRequestValidator.validate_context(context),
        "model": AIRequestValidator.validate_model_name(model),
    }


def validate_ai_response(response: dict[str, Any]) -> dict[str, Any]:
    """Validate AI response.

    Args:
        response: AI response to validate

    Returns:
        Validated response with sanitized content

    Raises:
        ValidationError: If validation fails
    """
    validated = AIResponseValidator.validate_response(response)

    # Sanitize content
    if "content" in validated:
        validated["content"] = AIResponseValidator.sanitize_response_content(
            validated["content"]
        )

    return validated
