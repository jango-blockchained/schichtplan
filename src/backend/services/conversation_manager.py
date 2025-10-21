"""
Conversational AI Management System for Schichtplan MCP Service

This module provides the core infrastructure for managing conversational AI interactions,
maintaining state across multi-turn conversations, and orchestrating tool usage.
"""

import asyncio
import json
import logging
import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import Enum
from typing import Any

import redis.asyncio as redis
from sqlalchemy import JSON, Column, DateTime, String
from sqlalchemy.orm import declarative_base

# Database models for conversation persistence
Base = declarative_base()


class ConversationState(Enum):
    """Conversation state enumeration."""

    INITIALIZED = "initialized"
    ACTIVE = "active"
    WAITING_FOR_INPUT = "waiting_for_input"
    PROCESSING = "processing"
    COMPLETED = "completed"
    ERROR = "error"
    ARCHIVED = "archived"


class ConversationPriority(Enum):
    """Conversation priority levels."""

    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    URGENT = "urgent"


@dataclass
class ContextItem:
    """Individual context item with metadata."""

    id: str
    type: str  # 'tool_result', 'user_input', 'ai_response', 'system_event'
    content: Any
    timestamp: datetime
    relevance_score: float = 1.0
    metadata: dict[str, Any] = None
    expires_at: datetime | None = None

    def __post_init__(self):
        if self.metadata is None:
            self.metadata = {}


@dataclass
class ConversationGoal:
    """Represents a goal or objective for the conversation."""

    id: str
    description: str
    type: str  # 'optimization', 'analysis', 'problem_solving', 'information_gathering'
    priority: ConversationPriority
    status: str  # 'pending', 'in_progress', 'completed', 'failed'
    sub_goals: list["ConversationGoal"] = None
    success_criteria: dict[str, Any] = None

    def __post_init__(self):
        if self.sub_goals is None:
            self.sub_goals = []
        if self.success_criteria is None:
            self.success_criteria = {}


@dataclass
class ConversationContext:
    """Comprehensive conversation context."""

    conversation_id: str
    user_id: str | None
    session_id: str

    # State management
    state: ConversationState
    created_at: datetime
    updated_at: datetime
    expires_at: datetime | None

    # Goals and objectives
    goals: list[ConversationGoal]
    current_goal: str | None  # Goal ID

    # Context items
    context_items: list[ContextItem]

    # Tool usage tracking
    tools_used: list[str]
    tool_results: dict[str, Any]
    pending_tool_calls: list[dict[str, Any]]

    # User preferences
    user_preferences: dict[str, Any]

    # Performance tracking
    metrics: dict[str, Any]

    # Fields with default values must come last
    max_context_items: int = 100
    ai_personality: str = "helpful_scheduler"
    ai_verbosity: str = "normal"  # 'concise', 'normal', 'detailed'
    ai_proactivity: str = "medium"  # 'low', 'medium', 'high'

    def __post_init__(self):
        if not hasattr(self, "tools_used") or self.tools_used is None:
            self.tools_used = []
        if not hasattr(self, "tool_results") or self.tool_results is None:
            self.tool_results = {}
        if not hasattr(self, "pending_tool_calls") or self.pending_tool_calls is None:
            self.pending_tool_calls = []
        if not hasattr(self, "user_preferences") or self.user_preferences is None:
            self.user_preferences = {}
        if not hasattr(self, "metrics") or self.metrics is None:
            self.metrics = {}


class ConversationDB(Base):
    """SQLAlchemy model for conversation persistence."""

    __tablename__ = "conversations"

    id = Column(String, primary_key=True)
    user_id = Column(String, nullable=True)
    session_id = Column(String, nullable=False)
    state = Column(String, nullable=False)
    created_at = Column(DateTime, nullable=False)
    updated_at = Column(DateTime, nullable=False)
    expires_at = Column(DateTime, nullable=True)
    context_data = Column(JSON, nullable=False)
    conversation_metadata = Column(JSON, nullable=True)


class StateStore(ABC):
    """Abstract base class for conversation state storage."""

    @abstractmethod
    async def save_conversation(self, context: ConversationContext) -> bool:
        """Save conversation context."""
        pass

    @abstractmethod
    async def load_conversation(
        self, conversation_id: str
    ) -> ConversationContext | None:
        """Load conversation context."""
        pass

    @abstractmethod
    async def delete_conversation(self, conversation_id: str) -> bool:
        """Delete conversation context."""
        pass

    @abstractmethod
    async def list_conversations(
        self, user_id: str | None = None, limit: int = 50
    ) -> list[ConversationContext]:
        """List conversations."""
        pass


class RedisStateStore(StateStore):
    """Redis-based state storage implementation."""

    def __init__(self, redis_client: redis.Redis, ttl: int = 86400):
        self.redis = redis_client
        self.ttl = ttl
        self.key_prefix = "schichtplan:conversation:"

    async def save_conversation(self, context: ConversationContext) -> bool:
        """Save conversation context to Redis."""
        try:
            key = f"{self.key_prefix}{context.conversation_id}"

            # Update timestamp
            context.updated_at = datetime.now()
            data = self._serialize_context(context)

            await self.redis.setex(key, self.ttl, json.dumps(data))
            return True
        except Exception as e:
            logging.error(
                "Failed to save conversation %s: %s",
                context.conversation_id,
                e,
            )
            return False

    async def load_conversation(
        self, conversation_id: str
    ) -> ConversationContext | None:
        """Load conversation context from Redis."""
        try:
            key = f"{self.key_prefix}{conversation_id}"
            data = await self.redis.get(key)

            if not data:
                return None

            return self._deserialize_context(json.loads(data))
        except Exception as e:
            logging.error(
                "Failed to load conversation %s: %s",
                conversation_id,
                e,
            )
            return None

    async def delete_conversation(self, conversation_id: str) -> bool:
        """Delete conversation from Redis."""
        try:
            key = f"{self.key_prefix}{conversation_id}"
            result = await self.redis.delete(key)
            return result > 0
        except Exception as e:
            logging.error(
                "Failed to delete conversation %s: %s",
                conversation_id,
                e,
            )
            return False

    async def list_conversations(
        self, user_id: str | None = None, limit: int = 50
    ) -> list[ConversationContext]:
        """List conversations from Redis."""
        try:
            pattern = f"{self.key_prefix}*"
            keys = await self.redis.keys(pattern)

            conversations = []
            for key in keys[:limit]:
                data = await self.redis.get(key)
                if data:
                    context = self._deserialize_context(json.loads(data))
                    if user_id is None or context.user_id == user_id:
                        conversations.append(context)

            return sorted(
                conversations,
                key=lambda x: x.updated_at,
                reverse=True,
            )
        except Exception as e:
            logging.error("Failed to list conversations: %s", e)
            return []

    def _serialize_context(self, context: ConversationContext) -> dict[str, Any]:
        """Serialize conversation context to dictionary."""
        return {
            "conversation_id": context.conversation_id,
            "user_id": context.user_id,
            "session_id": context.session_id,
            "state": context.state.value,
            "created_at": context.created_at.isoformat(),
            "updated_at": context.updated_at.isoformat(),
            "expires_at": context.expires_at.isoformat()
            if context.expires_at
            else None,
            "goals": [self._serialize_goal(goal) for goal in context.goals],
            "current_goal": context.current_goal,
            "context_items": [
                self._serialize_context_item(item) for item in context.context_items
            ],
            "tools_used": list(context.tools_used),
            "tool_results": context.tool_results,
            "pending_tool_calls": context.pending_tool_calls,
            "user_preferences": context.user_preferences,
            "metrics": context.metrics,
            "max_context_items": context.max_context_items,
            "ai_personality": context.ai_personality,
            "ai_verbosity": context.ai_verbosity,
            "ai_proactivity": context.ai_proactivity,
        }

    def _serialize_context_item(self, item: ContextItem) -> dict[str, Any]:
        """Serialize a context item."""
        return {
            "id": item.id,
            "type": item.type,
            "content": item.content,
            "timestamp": item.timestamp.isoformat(),
            "relevance_score": item.relevance_score,
            "metadata": item.metadata or {},
            "expires_at": (item.expires_at.isoformat() if item.expires_at else None),
        }

    def _serialize_goal(self, goal: ConversationGoal) -> dict[str, Any]:
        """Serialize a conversation goal."""
        return {
            "id": goal.id,
            "description": goal.description,
            "type": goal.type,
            "priority": goal.priority.value
            if isinstance(goal.priority, ConversationPriority)
            else goal.priority,
            "status": goal.status,
            "sub_goals": [
                self._serialize_goal(sub_goal) for sub_goal in goal.sub_goals or []
            ],
            "success_criteria": goal.success_criteria or {},
        }

    def _deserialize_context(self, data: dict[str, Any]) -> ConversationContext:
        """Deserialize conversation context from dictionary."""
        created_at = datetime.fromisoformat(data["created_at"])
        updated_at = datetime.fromisoformat(data["updated_at"])
        expires_at = (
            datetime.fromisoformat(data["expires_at"])
            if data.get("expires_at")
            else None
        )

        context_items = [
            self._deserialize_context_item(item_data)
            for item_data in data.get("context_items", [])
        ]
        goals = [
            self._deserialize_goal(goal_data) for goal_data in data.get("goals", [])
        ]

        return ConversationContext(
            conversation_id=data["conversation_id"],
            user_id=data.get("user_id"),
            session_id=data["session_id"],
            state=ConversationState(data["state"]),
            created_at=created_at,
            updated_at=updated_at,
            expires_at=expires_at,
            goals=goals,
            current_goal=data.get("current_goal"),
            context_items=context_items,
            tools_used=data.get("tools_used", []),
            tool_results=data.get("tool_results", {}),
            pending_tool_calls=data.get("pending_tool_calls", []),
            user_preferences=data.get("user_preferences", {}),
            metrics=data.get("metrics", {}),
            max_context_items=data.get("max_context_items", 100),
            ai_personality=data.get("ai_personality", "helpful_scheduler"),
            ai_verbosity=data.get("ai_verbosity", "normal"),
            ai_proactivity=data.get("ai_proactivity", "medium"),
        )

    def _deserialize_context_item(self, data: dict[str, Any]) -> ContextItem:
        """Deserialize a context item."""
        timestamp = datetime.fromisoformat(data["timestamp"])
        expires_at = (
            datetime.fromisoformat(data["expires_at"])
            if data.get("expires_at")
            else None
        )

        return ContextItem(
            id=data["id"],
            type=data["type"],
            content=data.get("content"),
            timestamp=timestamp,
            relevance_score=data.get("relevance_score", 1.0),
            metadata=data.get("metadata") or {},
            expires_at=expires_at,
        )

    def _deserialize_goal(self, data: dict[str, Any]) -> ConversationGoal:
        """Deserialize a conversation goal."""
        priority = data.get("priority", ConversationPriority.NORMAL)
        if not isinstance(priority, ConversationPriority):
            try:
                priority = ConversationPriority(priority)
            except ValueError:
                priority = ConversationPriority.NORMAL

        sub_goals = [
            self._deserialize_goal(sub_goal) for sub_goal in data.get("sub_goals", [])
        ]

        return ConversationGoal(
            id=data["id"],
            description=data.get("description", ""),
            type=data.get("type", ""),
            priority=priority,
            status=data.get("status", "pending"),
            sub_goals=sub_goals,
            success_criteria=data.get("success_criteria") or {},
        )


class ConversationManager:
    """Main conversation management system."""

    def __init__(
        self,
        state_store: StateStore,
        default_ttl: int = 86400,
        max_concurrent_conversations: int = 100,
    ):
        self.state_store = state_store
        self.default_ttl = default_ttl
        self.max_concurrent_conversations = max_concurrent_conversations
        self.logger = logging.getLogger(__name__)

        # Active conversations cache
        self._active_conversations: dict[str, ConversationContext] = {}

        # Conversation lifecycle hooks
        self._lifecycle_hooks = {
            "on_create": [],
            "on_update": [],
            "on_complete": [],
            "on_error": [],
            "on_expire": [],
        }

    async def create_conversation(
        self,
        user_id: str | None = None,
        session_id: str | None = None,
        goals: list[ConversationGoal] | None = None,
        ai_personality: str = "helpful_scheduler",
        expires_in: int | None = None,
    ) -> ConversationContext:
        """Create a new conversation."""
        conversation_id = str(uuid.uuid4())
        session_id = session_id or str(uuid.uuid4())

        now = datetime.now()
        expires_at = now + timedelta(seconds=expires_in or self.default_ttl)

        context = ConversationContext(
            conversation_id=conversation_id,
            user_id=user_id,
            session_id=session_id,
            state=ConversationState.INITIALIZED,
            created_at=now,
            updated_at=now,
            expires_at=expires_at,
            goals=goals or [],
            current_goal=None,
            context_items=[],
            tools_used=[],
            tool_results={},
            pending_tool_calls=[],
            ai_personality=ai_personality,
            user_preferences={},
            metrics={},
        )

        # Save to store
        await self.state_store.save_conversation(context)

        # Add to active cache
        self._active_conversations[conversation_id] = context

        # Call lifecycle hooks
        await self._call_hooks("on_create", context)

        self.logger.info(
            "Created conversation %s for user %s",
            conversation_id,
            user_id,
        )
        return context

    async def get_conversation(
        self, conversation_id: str
    ) -> ConversationContext | None:
        """Get conversation by ID."""
        # Check active cache first
        if conversation_id in self._active_conversations:
            return self._active_conversations[conversation_id]

        # Load from store
        context = await self.state_store.load_conversation(conversation_id)
        if context:
            # Check if expired
            if context.expires_at and datetime.now() > context.expires_at:
                await self._expire_conversation(context)
                return None

            # Add to active cache
            self._active_conversations[conversation_id] = context

        return context

    async def update_conversation(self, context: ConversationContext) -> bool:
        """Update conversation context."""
        context.updated_at = datetime.now()

        # Save to store
        success = await self.state_store.save_conversation(context)

        if success:
            # Update active cache
            self._active_conversations[context.conversation_id] = context

            # Call lifecycle hooks
            await self._call_hooks("on_update", context)

        return success

    async def add_context_item(self, conversation_id: str, item: ContextItem) -> bool:
        """Add context item to conversation."""
        context = await self.get_conversation(conversation_id)
        if not context:
            return False

        # Add item
        context.context_items.append(item)

        # Manage context size
        await self._manage_context_size(context)

        return await self.update_conversation(context)

    async def add_goal(self, conversation_id: str, goal: ConversationGoal) -> bool:
        """Add goal to conversation."""
        context = await self.get_conversation(conversation_id)
        if not context:
            return False

        context.goals.append(goal)

        # Set as current goal if none set
        if not context.current_goal:
            context.current_goal = goal.id

        return await self.update_conversation(context)

    async def set_state(self, conversation_id: str, state: ConversationState) -> bool:
        """Set conversation state."""
        context = await self.get_conversation(conversation_id)
        if not context:
            return False

        old_state = context.state
        context.state = state

        success = await self.update_conversation(context)

        if success and state == ConversationState.COMPLETED:
            await self._call_hooks("on_complete", context)
        elif success and state == ConversationState.ERROR:
            await self._call_hooks("on_error", context)

        self.logger.info(
            "Conversation %s state changed: %s -> %s",
            conversation_id,
            old_state,
            state,
        )
        return success

    async def cleanup_expired_conversations(self) -> int:
        """Clean up expired conversations."""
        now = datetime.now()
        expired_count = 0

        # Check active conversations
        expired_ids = []
        for conv_id, context in self._active_conversations.items():
            if context.expires_at and now > context.expires_at:
                expired_ids.append(conv_id)

        # Remove expired conversations
        for conv_id in expired_ids:
            context = self._active_conversations.pop(conv_id, None)
            if context:
                await self._expire_conversation(context)
                expired_count += 1

        self.logger.info(f"Cleaned up {expired_count} expired conversations")
        return expired_count

    async def _manage_context_size(self, context: ConversationContext):
        """Manage conversation context size."""
        if len(context.context_items) <= context.max_context_items:
            return

        # Sort by relevance and timestamp
        context.context_items.sort(
            key=lambda x: (x.relevance_score, x.timestamp), reverse=True
        )

        # Keep only the most relevant items
        context.context_items = context.context_items[: context.max_context_items]

        self.logger.debug(
            "Trimmed context for conversation %s",
            context.conversation_id,
        )

    async def _expire_conversation(self, context: ConversationContext):
        """Handle conversation expiration."""
        context.state = ConversationState.ARCHIVED
        await self.state_store.save_conversation(context)
        await self._call_hooks("on_expire", context)

        # Remove from active cache
        self._active_conversations.pop(context.conversation_id, None)

        self.logger.info(f"Expired conversation {context.conversation_id}")

    async def _call_hooks(self, hook_name: str, context: ConversationContext):
        """Call lifecycle hooks."""
        hooks = self._lifecycle_hooks.get(hook_name, [])
        for hook in hooks:
            try:
                if asyncio.iscoroutinefunction(hook):
                    await hook(context)
                else:
                    hook(context)
            except Exception as e:
                self.logger.error(f"Error in {hook_name} hook: {e}")

    def register_hook(self, hook_name: str, callback):
        """Register lifecycle hook."""
        if hook_name in self._lifecycle_hooks:
            self._lifecycle_hooks[hook_name].append(callback)

    async def get_conversation_metrics(self, conversation_id: str) -> dict[str, Any]:
        """Get conversation performance metrics."""
        context = await self.get_conversation(conversation_id)
        if not context:
            return {}

        duration = (context.updated_at - context.created_at).total_seconds()

        return {
            "conversation_id": conversation_id,
            "duration_seconds": duration,
            "context_items_count": len(context.context_items),
            "tools_used_count": len(context.tools_used),
            "goals_count": len(context.goals),
            "state": context.state.value,
            "user_id": context.user_id,
            **context.metrics,
        }


# Factory function for easy setup
async def create_conversation_manager(
    redis_url: str = "redis://localhost:6379",
) -> ConversationManager:
    """Create a conversation manager with Redis state store."""
    redis_client = redis.from_url(redis_url, decode_responses=True)
    state_store = RedisStateStore(redis_client)
    return ConversationManager(state_store)
