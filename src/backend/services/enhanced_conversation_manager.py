"""
Enhanced Conversation Management with search, filtering, export, and analytics.
"""

import csv
import io
import json
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple

from src.backend.utils.logger import logger


class ConversationStatus(Enum):
    """Conversation status enumeration."""

    ACTIVE = "active"
    ARCHIVED = "archived"
    CLOSED = "closed"
    SUSPENDED = "suspended"


class MessageType(Enum):
    """Message type enumeration."""

    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"
    ERROR = "error"


@dataclass
class ConversationMetadata:
    """Metadata for a conversation."""

    tags: List[str] = field(default_factory=list)
    category: Optional[str] = None
    priority: int = 1  # 1 = high, 5 = low
    assigned_agent: Optional[str] = None
    customer_satisfaction: Optional[float] = None  # 1.0 to 5.0
    resolution_status: Optional[str] = None
    custom_fields: Dict[str, Any] = field(default_factory=dict)


@dataclass
class Message:
    """Enhanced message structure."""

    id: str
    conversation_id: str
    content: str
    message_type: MessageType
    timestamp: datetime
    user_id: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    sentiment_score: Optional[float] = None  # -1.0 to 1.0
    confidence_score: Optional[float] = None  # 0.0 to 1.0
    processing_time: Optional[float] = None
    token_count: Optional[int] = None


@dataclass
class Conversation:
    """Enhanced conversation structure."""

    id: str
    title: str
    user_id: str
    status: ConversationStatus
    created_at: datetime
    updated_at: datetime
    messages: List[Message] = field(default_factory=list)
    metadata: ConversationMetadata = field(default_factory=ConversationMetadata)
    message_count: int = 0
    total_tokens: int = 0
    average_response_time: float = 0.0
    last_activity: Optional[datetime] = None


class ConversationSearchFilter:
    """Filter criteria for conversation search."""

    def __init__(
        self,
        user_id: Optional[str] = None,
        status: Optional[ConversationStatus] = None,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        tags: Optional[List[str]] = None,
        category: Optional[str] = None,
        content_search: Optional[str] = None,
        message_type: Optional[MessageType] = None,
        min_messages: Optional[int] = None,
        max_messages: Optional[int] = None,
        sentiment_range: Optional[Tuple[float, float]] = None,
        assigned_agent: Optional[str] = None,
    ):
        self.user_id = user_id
        self.status = status
        self.date_from = date_from
        self.date_to = date_to
        self.tags = tags or []
        self.category = category
        self.content_search = content_search
        self.message_type = message_type
        self.min_messages = min_messages
        self.max_messages = max_messages
        self.sentiment_range = sentiment_range
        self.assigned_agent = assigned_agent


class ConversationAnalytics:
    """Analytics for conversation data."""

    def __init__(self):
        self.daily_stats: Dict[str, Dict] = defaultdict(
            lambda: {
                "conversations": 0,
                "messages": 0,
                "users": set(),
                "avg_response_time": 0.0,
                "sentiment_scores": [],
            }
        )

    def analyze_conversation(self, conversation: Conversation) -> Dict[str, Any]:
        """Analyze a single conversation."""
        if not conversation.messages:
            return {"analysis": "No messages to analyze"}

        # Message distribution
        message_types = defaultdict(int)
        sentiment_scores = []
        response_times = []

        for message in conversation.messages:
            message_types[message.message_type.value] += 1
            if message.sentiment_score is not None:
                sentiment_scores.append(message.sentiment_score)
            if message.processing_time is not None:
                response_times.append(message.processing_time)

        # Calculate metrics
        avg_sentiment = (
            sum(sentiment_scores) / len(sentiment_scores) if sentiment_scores else None
        )
        avg_response_time = (
            sum(response_times) / len(response_times) if response_times else None
        )

        # Conversation flow analysis
        user_messages = [
            m for m in conversation.messages if m.message_type == MessageType.USER
        ]
        assistant_messages = [
            m for m in conversation.messages if m.message_type == MessageType.ASSISTANT
        ]

        return {
            "conversation_id": conversation.id,
            "duration_minutes": (
                conversation.updated_at - conversation.created_at
            ).total_seconds()
            / 60,
            "message_distribution": dict(message_types),
            "user_message_count": len(user_messages),
            "assistant_message_count": len(assistant_messages),
            "avg_sentiment": avg_sentiment,
            "avg_response_time": avg_response_time,
            "total_tokens": conversation.total_tokens,
            "conversation_rating": self._calculate_conversation_rating(conversation),
            "key_topics": self._extract_key_topics(conversation),
        }

    def _calculate_conversation_rating(self, conversation: Conversation) -> float:
        """Calculate an overall rating for the conversation."""
        factors = []

        # Response time factor (faster is better)
        if conversation.average_response_time > 0:
            time_factor = max(
                0, 1 - (conversation.average_response_time / 10)
            )  # 10s baseline
            factors.append(time_factor)

        # Sentiment factor
        sentiment_scores = [
            m.sentiment_score
            for m in conversation.messages
            if m.sentiment_score is not None
        ]
        if sentiment_scores:
            avg_sentiment = sum(sentiment_scores) / len(sentiment_scores)
            sentiment_factor = (avg_sentiment + 1) / 2  # Convert from [-1,1] to [0,1]
            factors.append(sentiment_factor)

        # Resolution factor
        if conversation.metadata.resolution_status == "resolved":
            factors.append(1.0)
        elif conversation.metadata.resolution_status == "partially_resolved":
            factors.append(0.7)

        # Customer satisfaction factor
        if conversation.metadata.customer_satisfaction:
            satisfaction_factor = conversation.metadata.customer_satisfaction / 5.0
            factors.append(satisfaction_factor)

        return sum(factors) / len(factors) if factors else 0.5

    def _extract_key_topics(self, conversation: Conversation) -> List[str]:
        """Extract key topics from conversation content."""
        # Simple keyword extraction (in production, use NLP)
        all_content = " ".join([m.content for m in conversation.messages])

        # Common scheduling/AI assistant topics
        topic_keywords = {
            "scheduling": ["schedule", "shift", "roster", "timetable", "calendar"],
            "optimization": [
                "optimize",
                "improve",
                "better",
                "efficient",
                "performance",
            ],
            "employees": ["employee", "staff", "worker", "team", "personnel"],
            "conflicts": ["conflict", "overlap", "issue", "problem", "clash"],
            "availability": ["available", "unavailable", "free", "busy", "absence"],
            "coverage": ["coverage", "cover", "gap", "understaffed", "overstaffed"],
        }

        detected_topics = []
        content_lower = all_content.lower()

        for topic, keywords in topic_keywords.items():
            if any(keyword in content_lower for keyword in keywords):
                detected_topics.append(topic)

        return detected_topics[:5]  # Return top 5 topics


class ConversationExporter:
    """Export conversations to various formats."""

    @staticmethod
    def to_json(conversations: List[Conversation]) -> str:
        """Export conversations to JSON format."""
        export_data = []

        for conv in conversations:
            conv_data = {
                "id": conv.id,
                "title": conv.title,
                "user_id": conv.user_id,
                "status": conv.status.value,
                "created_at": conv.created_at.isoformat(),
                "updated_at": conv.updated_at.isoformat(),
                "message_count": conv.message_count,
                "total_tokens": conv.total_tokens,
                "metadata": {
                    "tags": conv.metadata.tags,
                    "category": conv.metadata.category,
                    "priority": conv.metadata.priority,
                    "assigned_agent": conv.metadata.assigned_agent,
                    "customer_satisfaction": conv.metadata.customer_satisfaction,
                    "resolution_status": conv.metadata.resolution_status,
                    "custom_fields": conv.metadata.custom_fields,
                },
                "messages": [
                    {
                        "id": msg.id,
                        "content": msg.content,
                        "type": msg.message_type.value,
                        "timestamp": msg.timestamp.isoformat(),
                        "user_id": msg.user_id,
                        "sentiment_score": msg.sentiment_score,
                        "confidence_score": msg.confidence_score,
                        "processing_time": msg.processing_time,
                        "token_count": msg.token_count,
                        "metadata": msg.metadata,
                    }
                    for msg in conv.messages
                ],
            }
            export_data.append(conv_data)

        return json.dumps(export_data, indent=2)

    @staticmethod
    def to_csv(conversations: List[Conversation]) -> str:
        """Export conversation summary to CSV format."""
        output = io.StringIO()
        writer = csv.writer(output)

        # Header
        writer.writerow(
            [
                "conversation_id",
                "title",
                "user_id",
                "status",
                "created_at",
                "updated_at",
                "message_count",
                "total_tokens",
                "avg_response_time",
                "tags",
                "category",
                "priority",
                "assigned_agent",
                "customer_satisfaction",
                "resolution_status",
            ]
        )

        # Data
        for conv in conversations:
            writer.writerow(
                [
                    conv.id,
                    conv.title,
                    conv.user_id,
                    conv.status.value,
                    conv.created_at.isoformat(),
                    conv.updated_at.isoformat(),
                    conv.message_count,
                    conv.total_tokens,
                    conv.average_response_time,
                    "|".join(conv.metadata.tags),
                    conv.metadata.category or "",
                    conv.metadata.priority,
                    conv.metadata.assigned_agent or "",
                    conv.metadata.customer_satisfaction or "",
                    conv.metadata.resolution_status or "",
                ]
            )

        return output.getvalue()

    @staticmethod
    def to_markdown(conversation: Conversation) -> str:
        """Export single conversation to Markdown format."""
        md_content = f"# Conversation: {conversation.title}\n\n"
        md_content += f"**ID:** {conversation.id}  \n"
        md_content += f"**User:** {conversation.user_id}  \n"
        md_content += f"**Status:** {conversation.status.value}  \n"
        md_content += (
            f"**Created:** {conversation.created_at.strftime('%Y-%m-%d %H:%M:%S')}  \n"
        )
        md_content += (
            f"**Updated:** {conversation.updated_at.strftime('%Y-%m-%d %H:%M:%S')}  \n"
        )

        if conversation.metadata.tags:
            md_content += f"**Tags:** {', '.join(conversation.metadata.tags)}  \n"

        if conversation.metadata.category:
            md_content += f"**Category:** {conversation.metadata.category}  \n"

        md_content += f"\n---\n\n## Messages ({len(conversation.messages)})\n\n"

        for msg in conversation.messages:
            timestamp = msg.timestamp.strftime("%H:%M:%S")
            role = msg.message_type.value.title()

            md_content += f"### {role} - {timestamp}\n\n"
            md_content += f"{msg.content}\n\n"

            if msg.sentiment_score is not None:
                md_content += f"*Sentiment: {msg.sentiment_score:.2f}*  \n"
            if msg.processing_time is not None:
                md_content += f"*Processing time: {msg.processing_time:.2f}s*  \n"

            md_content += "\n---\n\n"

        return md_content


class EnhancedConversationManager:
    """Enhanced conversation manager with search, analytics, and export capabilities."""

    def __init__(self):
        self.conversations: Dict[str, Conversation] = {}
        self.analytics = ConversationAnalytics()
        self.exporter = ConversationExporter()

    def create_conversation(
        self, conversation_id: str, title: str, user_id: str
    ) -> Conversation:
        """Create a new conversation."""
        conversation = Conversation(
            id=conversation_id,
            title=title,
            user_id=user_id,
            status=ConversationStatus.ACTIVE,
            created_at=datetime.now(),
            updated_at=datetime.now(),
            last_activity=datetime.now(),
        )

        self.conversations[conversation_id] = conversation
        logger.info(f"Created conversation {conversation_id} for user {user_id}")
        return conversation

    def add_message(self, conversation_id: str, message: Message) -> bool:
        """Add a message to a conversation."""
        if conversation_id not in self.conversations:
            logger.warning(f"Conversation {conversation_id} not found")
            return False

        conversation = self.conversations[conversation_id]
        conversation.messages.append(message)
        conversation.message_count = len(conversation.messages)
        conversation.updated_at = datetime.now()
        conversation.last_activity = message.timestamp

        # Update token count
        if message.token_count:
            conversation.total_tokens += message.token_count

        # Update average response time
        if message.processing_time and message.message_type == MessageType.ASSISTANT:
            response_times = [
                m.processing_time
                for m in conversation.messages
                if m.processing_time and m.message_type == MessageType.ASSISTANT
            ]
            conversation.average_response_time = sum(response_times) / len(
                response_times
            )

        logger.debug(f"Added message to conversation {conversation_id}")
        return True

    def search_conversations(
        self, filters: ConversationSearchFilter, limit: int = 100, offset: int = 0
    ) -> List[Conversation]:
        """Search conversations with filtering."""
        results = []

        for conversation in self.conversations.values():
            if self._matches_filter(conversation, filters):
                results.append(conversation)

        # Sort by last activity (most recent first)
        results.sort(key=lambda c: c.last_activity or c.updated_at, reverse=True)

        # Apply pagination
        return results[offset : offset + limit]

    def _matches_filter(
        self, conversation: Conversation, filters: ConversationSearchFilter
    ) -> bool:
        """Check if conversation matches the filter criteria."""
        # User ID filter
        if filters.user_id and conversation.user_id != filters.user_id:
            return False

        # Status filter
        if filters.status and conversation.status != filters.status:
            return False

        # Date range filter
        if filters.date_from and conversation.created_at < filters.date_from:
            return False
        if filters.date_to and conversation.created_at > filters.date_to:
            return False

        # Tags filter
        if filters.tags and not any(
            tag in conversation.metadata.tags for tag in filters.tags
        ):
            return False

        # Category filter
        if filters.category and conversation.metadata.category != filters.category:
            return False

        # Content search filter
        if filters.content_search:
            search_text = filters.content_search.lower()
            if not any(
                search_text in msg.content.lower() for msg in conversation.messages
            ):
                return False

        # Message type filter
        if filters.message_type:
            if not any(
                msg.message_type == filters.message_type
                for msg in conversation.messages
            ):
                return False

        # Message count filters
        if filters.min_messages and conversation.message_count < filters.min_messages:
            return False
        if filters.max_messages and conversation.message_count > filters.max_messages:
            return False

        # Sentiment range filter
        if filters.sentiment_range:
            min_sent, max_sent = filters.sentiment_range
            sentiment_scores = [
                m.sentiment_score
                for m in conversation.messages
                if m.sentiment_score is not None
            ]
            if sentiment_scores:
                avg_sentiment = sum(sentiment_scores) / len(sentiment_scores)
                if not (min_sent <= avg_sentiment <= max_sent):
                    return False

        # Assigned agent filter
        if (
            filters.assigned_agent
            and conversation.metadata.assigned_agent != filters.assigned_agent
        ):
            return False

        return True

    def archive_conversation(self, conversation_id: str) -> bool:
        """Archive a conversation."""
        if conversation_id in self.conversations:
            self.conversations[conversation_id].status = ConversationStatus.ARCHIVED
            self.conversations[conversation_id].updated_at = datetime.now()
            logger.info(f"Archived conversation {conversation_id}")
            return True
        return False

    def get_conversation_analytics(self, conversation_id: str) -> Dict[str, Any]:
        """Get analytics for a specific conversation."""
        if conversation_id not in self.conversations:
            return {"error": "Conversation not found"}

        return self.analytics.analyze_conversation(self.conversations[conversation_id])

    def export_conversations(
        self, conversation_ids: List[str], format_type: str = "json"
    ) -> str:
        """Export conversations in specified format."""
        conversations = [
            self.conversations[cid]
            for cid in conversation_ids
            if cid in self.conversations
        ]

        if format_type.lower() == "json":
            return self.exporter.to_json(conversations)
        elif format_type.lower() == "csv":
            return self.exporter.to_csv(conversations)
        elif format_type.lower() == "markdown" and len(conversations) == 1:
            return self.exporter.to_markdown(conversations[0])
        else:
            raise ValueError(f"Unsupported format: {format_type}")

    def get_system_analytics(self, days: int = 30) -> Dict[str, Any]:
        """Get system-wide analytics for the last N days."""
        cutoff = datetime.now() - timedelta(days=days)
        recent_conversations = [
            c for c in self.conversations.values() if c.created_at >= cutoff
        ]

        if not recent_conversations:
            return {"message": f"No conversations found in the last {days} days"}

        # Basic statistics
        total_conversations = len(recent_conversations)
        total_messages = sum(c.message_count for c in recent_conversations)
        unique_users = len(set(c.user_id for c in recent_conversations))

        # Status distribution
        status_counts = defaultdict(int)
        for conv in recent_conversations:
            status_counts[conv.status.value] += 1

        # Average metrics
        avg_messages_per_conv = (
            total_messages / total_conversations if total_conversations > 0 else 0
        )
        avg_response_times = [
            c.average_response_time
            for c in recent_conversations
            if c.average_response_time > 0
        ]
        avg_response_time = (
            sum(avg_response_times) / len(avg_response_times)
            if avg_response_times
            else 0
        )

        # Daily activity
        daily_activity = defaultdict(int)
        for conv in recent_conversations:
            date_key = conv.created_at.strftime("%Y-%m-%d")
            daily_activity[date_key] += 1

        return {
            "period_days": days,
            "total_conversations": total_conversations,
            "total_messages": total_messages,
            "unique_users": unique_users,
            "avg_messages_per_conversation": round(avg_messages_per_conv, 2),
            "avg_response_time": round(avg_response_time, 2),
            "status_distribution": dict(status_counts),
            "daily_activity": dict(daily_activity),
            "busiest_day": max(daily_activity.items(), key=lambda x: x[1])
            if daily_activity
            else None,
        }


# Global enhanced conversation manager instance
enhanced_conversation_manager = EnhancedConversationManager()
