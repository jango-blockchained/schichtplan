"""
Configuration for Conversational AI MCP Service

This module contains configuration settings for the conversational AI system.
"""

import os
from dataclasses import dataclass
from typing import Any, Dict, List, Optional


@dataclass
class AIProviderConfig:
    """Configuration for AI providers."""

    openai_api_key: Optional[str] = None
    openai_base_url: Optional[str] = None
    anthropic_api_key: Optional[str] = None
    gemini_api_key: Optional[str] = None
    preferred_provider: str = "openai"  # "openai", "anthropic", or "gemini"
    default_model: Optional[str] = None
    max_tokens: int = 4096
    temperature: float = 0.7
    timeout: int = 30


@dataclass
class ConversationConfig:
    """Configuration for conversation management."""

    redis_url: str = "redis://localhost:6379"
    conversation_ttl: int = 86400  # 24 hours
    max_context_items: int = 100
    max_concurrent_conversations: int = 100
    cleanup_interval: int = 3600  # 1 hour
    enable_persistence: bool = True


@dataclass
class SecurityConfig:
    """Security configuration."""

    enable_user_auth: bool = False
    api_key_required: bool = False
    rate_limit_per_minute: int = 60
    max_conversation_duration: int = 7200  # 2 hours
    allowed_origins: List[str] = None

    def __post_init__(self):
        if self.allowed_origins is None:
            self.allowed_origins = ["*"]


@dataclass
class LoggingConfig:
    """Logging configuration."""

    level: str = "INFO"
    format: str = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    log_conversations: bool = True
    log_ai_requests: bool = True
    log_tool_calls: bool = True
    max_log_size: int = 10 * 1024 * 1024  # 10MB


@dataclass
class PerformanceConfig:
    """Performance optimization configuration."""

    enable_caching: bool = True
    cache_ttl: int = 300  # 5 minutes
    parallel_tool_execution: bool = True
    max_parallel_tools: int = 5
    request_timeout: int = 30
    retry_attempts: int = 3


@dataclass
class ConversationalAIConfig:
    """Main configuration class for conversational AI system."""

    # Component configurations
    ai_providers: AIProviderConfig
    conversations: ConversationConfig
    security: SecurityConfig
    logging: LoggingConfig
    performance: PerformanceConfig

    # Feature flags
    enable_streaming: bool = True
    enable_tool_calling: bool = True
    enable_multi_turn: bool = True
    enable_context_compression: bool = True
    enable_learning: bool = False

    # Business logic settings
    max_optimization_iterations: int = 5
    default_analysis_depth: str = "standard"  # "basic", "standard", "deep"
    enable_proactive_suggestions: bool = True

    # Integration settings
    flask_app_name: str = "schichtplan"
    mcp_server_port: int = 8001
    websocket_enabled: bool = True

    @classmethod
    def from_environment(cls) -> "ConversationalAIConfig":
        """Create configuration from environment variables."""

        ai_providers = AIProviderConfig(
            openai_api_key=os.getenv("OPENAI_API_KEY"),
            openai_base_url=os.getenv("OPENAI_BASE_URL"),
            anthropic_api_key=os.getenv("ANTHROPIC_API_KEY"),
            gemini_api_key=os.getenv("GEMINI_API_KEY"),
            preferred_provider=os.getenv("AI_PREFERRED_PROVIDER", "openai"),
            default_model=os.getenv("AI_DEFAULT_MODEL"),
            max_tokens=int(os.getenv("AI_MAX_TOKENS", "4096")),
            temperature=float(os.getenv("AI_TEMPERATURE", "0.7")),
            timeout=int(os.getenv("AI_TIMEOUT", "30")),
        )

        conversations = ConversationConfig(
            redis_url=os.getenv("REDIS_URL", "redis://localhost:6379"),
            conversation_ttl=int(os.getenv("CONVERSATION_TTL", "86400")),
            max_context_items=int(os.getenv("MAX_CONTEXT_ITEMS", "100")),
            max_concurrent_conversations=int(
                os.getenv("MAX_CONCURRENT_CONVERSATIONS", "100")
            ),
            cleanup_interval=int(os.getenv("CLEANUP_INTERVAL", "3600")),
            enable_persistence=os.getenv("ENABLE_PERSISTENCE", "true").lower()
            == "true",
        )

        security = SecurityConfig(
            enable_user_auth=os.getenv("ENABLE_USER_AUTH", "false").lower() == "true",
            api_key_required=os.getenv("API_KEY_REQUIRED", "false").lower() == "true",
            rate_limit_per_minute=int(os.getenv("RATE_LIMIT_PER_MINUTE", "60")),
            max_conversation_duration=int(
                os.getenv("MAX_CONVERSATION_DURATION", "7200")
            ),
            allowed_origins=os.getenv("ALLOWED_ORIGINS", "*").split(",")
            if os.getenv("ALLOWED_ORIGINS")
            else ["*"],
        )

        logging_config = LoggingConfig(
            level=os.getenv("LOG_LEVEL", "INFO"),
            format=os.getenv(
                "LOG_FORMAT", "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
            ),
            log_conversations=os.getenv("LOG_CONVERSATIONS", "true").lower() == "true",
            log_ai_requests=os.getenv("LOG_AI_REQUESTS", "true").lower() == "true",
            log_tool_calls=os.getenv("LOG_TOOL_CALLS", "true").lower() == "true",
            max_log_size=int(os.getenv("MAX_LOG_SIZE", str(10 * 1024 * 1024))),
        )

        performance = PerformanceConfig(
            enable_caching=os.getenv("ENABLE_CACHING", "true").lower() == "true",
            cache_ttl=int(os.getenv("CACHE_TTL", "300")),
            parallel_tool_execution=os.getenv("PARALLEL_TOOL_EXECUTION", "true").lower()
            == "true",
            max_parallel_tools=int(os.getenv("MAX_PARALLEL_TOOLS", "5")),
            request_timeout=int(os.getenv("REQUEST_TIMEOUT", "30")),
            retry_attempts=int(os.getenv("RETRY_ATTEMPTS", "3")),
        )

        return cls(
            ai_providers=ai_providers,
            conversations=conversations,
            security=security,
            logging=logging_config,
            performance=performance,
            enable_streaming=os.getenv("ENABLE_STREAMING", "true").lower() == "true",
            enable_tool_calling=os.getenv("ENABLE_TOOL_CALLING", "true").lower()
            == "true",
            enable_multi_turn=os.getenv("ENABLE_MULTI_TURN", "true").lower() == "true",
            enable_context_compression=os.getenv(
                "ENABLE_CONTEXT_COMPRESSION", "true"
            ).lower()
            == "true",
            enable_learning=os.getenv("ENABLE_LEARNING", "false").lower() == "true",
            max_optimization_iterations=int(
                os.getenv("MAX_OPTIMIZATION_ITERATIONS", "5")
            ),
            default_analysis_depth=os.getenv("DEFAULT_ANALYSIS_DEPTH", "standard"),
            enable_proactive_suggestions=os.getenv(
                "ENABLE_PROACTIVE_SUGGESTIONS", "true"
            ).lower()
            == "true",
            flask_app_name=os.getenv("FLASK_APP_NAME", "schichtplan"),
            mcp_server_port=int(os.getenv("MCP_SERVER_PORT", "8001")),
            websocket_enabled=os.getenv("WEBSOCKET_ENABLED", "true").lower() == "true",
        )

    @classmethod
    def from_file(cls, config_path: str) -> "ConversationalAIConfig":
        """Load configuration from a JSON or YAML file."""
        import json

        with open(config_path, "r") as f:
            if config_path.endswith(".json"):
                data = json.load(f)
            elif config_path.endswith((".yml", ".yaml")):
                import yaml

                data = yaml.safe_load(f)
            else:
                raise ValueError("Config file must be JSON or YAML")

        return cls.from_dict(data)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ConversationalAIConfig":
        """Create configuration from dictionary."""

        ai_providers = AIProviderConfig(**data.get("ai_providers", {}))
        conversations = ConversationConfig(**data.get("conversations", {}))
        security = SecurityConfig(**data.get("security", {}))
        logging_config = LoggingConfig(**data.get("logging", {}))
        performance = PerformanceConfig(**data.get("performance", {}))

        # Remove nested configs from main data
        main_data = {
            k: v
            for k, v in data.items()
            if k
            not in [
                "ai_providers",
                "conversations",
                "security",
                "logging",
                "performance",
            ]
        }

        return cls(
            ai_providers=ai_providers,
            conversations=conversations,
            security=security,
            logging=logging_config,
            performance=performance,
            **main_data,
        )

    def to_dict(self) -> Dict[str, Any]:
        """Convert configuration to dictionary."""
        from dataclasses import asdict

        return asdict(self)

    def validate(self) -> List[str]:
        """Validate configuration and return list of errors."""
        errors = []

        # Validate AI providers
        if (
            not self.ai_providers.openai_api_key
            and not self.ai_providers.anthropic_api_key
        ):
            errors.append("At least one AI provider API key must be configured")

        # Validate Redis URL
        if self.conversations.enable_persistence and not self.conversations.redis_url:
            errors.append("Redis URL must be configured when persistence is enabled")

        # Validate timeouts
        if self.performance.request_timeout <= 0:
            errors.append("Request timeout must be positive")

        if self.conversations.conversation_ttl <= 0:
            errors.append("Conversation TTL must be positive")

        # Validate limits
        if self.conversations.max_context_items <= 0:
            errors.append("Max context items must be positive")

        if self.performance.max_parallel_tools <= 0:
            errors.append("Max parallel tools must be positive")

        # Validate analysis depth
        valid_depths = ["basic", "standard", "deep"]
        if self.default_analysis_depth not in valid_depths:
            errors.append(f"Analysis depth must be one of: {valid_depths}")

        return errors

    def setup_logging(self):
        """Set up logging based on configuration."""
        import logging

        # Configure root logger
        logging.basicConfig(
            level=getattr(logging, self.logging.level.upper()),
            format=self.logging.format,
        )

        # Configure specific loggers
        loggers = [
            "conversational_ai",
            "conversation_manager",
            "ai_integration",
            "mcp_service",
        ]

        for logger_name in loggers:
            logger = logging.getLogger(logger_name)
            logger.setLevel(getattr(logging, self.logging.level.upper()))


# Default configuration
DEFAULT_CONFIG = ConversationalAIConfig(
    ai_providers=AIProviderConfig(),
    conversations=ConversationConfig(),
    security=SecurityConfig(),
    logging=LoggingConfig(),
    performance=PerformanceConfig(),
)

# Development configuration
DEVELOPMENT_CONFIG = ConversationalAIConfig(
    ai_providers=AIProviderConfig(temperature=0.8, max_tokens=8192),
    conversations=ConversationConfig(
        conversation_ttl=3600,  # 1 hour for development
        max_context_items=50,
    ),
    security=SecurityConfig(enable_user_auth=False, rate_limit_per_minute=120),
    logging=LoggingConfig(
        level="DEBUG", log_conversations=True, log_ai_requests=True, log_tool_calls=True
    ),
    performance=PerformanceConfig(
        enable_caching=False,  # Disable caching in development
        parallel_tool_execution=False,  # Easier debugging
    ),
    enable_learning=True,  # Enable learning in development
)

# Production configuration
PRODUCTION_CONFIG = ConversationalAIConfig(
    ai_providers=AIProviderConfig(temperature=0.7, max_tokens=4096, timeout=60),
    conversations=ConversationConfig(
        conversation_ttl=86400 * 7,  # 7 days in production
        max_context_items=200,
        max_concurrent_conversations=500,
    ),
    security=SecurityConfig(
        enable_user_auth=True,
        api_key_required=True,
        rate_limit_per_minute=30,
        allowed_origins=[],  # Must be configured per deployment
    ),
    logging=LoggingConfig(
        level="INFO",
        log_conversations=False,  # Privacy concerns in production
        log_ai_requests=True,
        log_tool_calls=False,
    ),
    performance=PerformanceConfig(
        enable_caching=True,
        cache_ttl=600,  # 10 minutes
        parallel_tool_execution=True,
        max_parallel_tools=10,
        retry_attempts=5,
    ),
    max_optimization_iterations=10,
    enable_proactive_suggestions=True,
)


def get_config(environment: str = None) -> ConversationalAIConfig:
    """Get configuration for specified environment."""

    environment = environment or os.getenv("ENVIRONMENT", "development")

    if environment == "production":
        # Try to load with database AI settings first, fallback to environment
        try:
            return create_config_with_database_ai()
        except Exception:
            return PRODUCTION_CONFIG
    elif environment == "development":
        # For development, also try database settings first
        try:
            return create_config_with_database_ai()
        except Exception:
            return DEVELOPMENT_CONFIG
    else:
        # Try to load from environment or use default
        try:
            return ConversationalAIConfig.from_environment()
        except Exception:
            return DEFAULT_CONFIG


def save_example_config(path: str = "conversational_ai_config.json"):
    """Save an example configuration file."""
    import json

    config = DEVELOPMENT_CONFIG.to_dict()

    # Add comments as additional fields
    config["_comments"] = {
        "ai_providers": "Configure your AI provider API keys and preferences",
        "conversations": "Settings for conversation management and persistence",
        "security": "Security and authentication settings",
        "logging": "Logging configuration and privacy settings",
        "performance": "Performance optimization settings",
        "feature_flags": "Enable/disable specific features",
        "environment_variables": "Most settings can be overridden with environment variables",
    }

    with open(path, "w") as f:
        json.dump(config, f, indent=2)

    print(f"Example configuration saved to {path}")
    print("Edit this file and load it with ConversationalAIConfig.from_file()")


if __name__ == "__main__":
    # Save example configuration
    save_example_config()

    # Demonstrate configuration loading
    print("\nLoading configuration from environment...")
    config = get_config()

    print(f"AI Provider: {config.ai_providers.preferred_provider}")
    print(f"Redis URL: {config.conversations.redis_url}")
    print(f"Log Level: {config.logging.level}")

    # Validate configuration
    errors = config.validate()
    if errors:
        print("\nConfiguration errors:")
        for error in errors:
            print(f"- {error}")
    else:
        print("\n✅ Configuration is valid!")


def load_ai_config_from_database() -> AIProviderConfig:
    """Load AI provider configuration from database settings."""
    try:
        # Import here to avoid circular imports
        from src.backend.models.settings import Settings

        # Get the settings from database
        settings = Settings.query.first()
        if not settings or not settings.ai_scheduling:
            return AIProviderConfig()

        ai_settings = settings.ai_scheduling

        # Extract API key from settings
        gemini_api_key = ai_settings.get("api_key", "")

        # Create config with Gemini as preferred if API key is available
        return AIProviderConfig(
            openai_api_key=os.getenv("OPENAI_API_KEY"),
            openai_base_url=os.getenv("OPENAI_BASE_URL"),
            anthropic_api_key=os.getenv("ANTHROPIC_API_KEY"),
            gemini_api_key=gemini_api_key or os.getenv("GEMINI_API_KEY"),
            preferred_provider="gemini"
            if gemini_api_key
            else os.getenv("AI_PREFERRED_PROVIDER", "openai"),
            default_model=os.getenv("AI_DEFAULT_MODEL"),
            max_tokens=int(os.getenv("AI_MAX_TOKENS", "4096")),
            temperature=float(os.getenv("AI_TEMPERATURE", "0.7")),
            timeout=int(os.getenv("AI_TIMEOUT", "30")),
        )
    except Exception as e:
        print(f"Error loading AI config from database: {e}")
        # Fallback to environment variables only
        return AIProviderConfig(
            openai_api_key=os.getenv("OPENAI_API_KEY"),
            openai_base_url=os.getenv("OPENAI_BASE_URL"),
            anthropic_api_key=os.getenv("ANTHROPIC_API_KEY"),
            gemini_api_key=os.getenv("GEMINI_API_KEY"),
            preferred_provider=os.getenv("AI_PREFERRED_PROVIDER", "openai"),
            default_model=os.getenv("AI_DEFAULT_MODEL"),
            max_tokens=int(os.getenv("AI_MAX_TOKENS", "4096")),
            temperature=float(os.getenv("AI_TEMPERATURE", "0.7")),
            timeout=int(os.getenv("AI_TIMEOUT", "30")),
        )


def create_config_with_database_ai() -> ConversationalAIConfig:
    """Create configuration with AI settings loaded from database."""
    # Load base config from environment
    config = ConversationalAIConfig.from_environment()

    # Override AI provider config with database settings
    config.ai_providers = load_ai_config_from_database()

    return config
