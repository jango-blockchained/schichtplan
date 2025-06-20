"""
Simple Conversation Manager

Basic implementation of conversation persistence using database models.
This serves as a simple alternative to the complex conversation manager
until the full AI orchestrator is ready.
"""

import logging
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from src.backend.models import (
    AIConversation,
    AIMessage,
    ConversationStatus,
    MessageType,
    db,
)


class SimpleConversationManager:
    """Simple conversation manager with database persistence."""

    def __init__(self, logger: Optional[logging.Logger] = None):
        self.logger = logger or logging.getLogger(__name__)

    def create_conversation(
        self, user_id: str = None, session_id: str = None, title: str = None
    ) -> AIConversation:
        """Create a new conversation."""
        try:
            conversation = AIConversation(
                id=str(uuid.uuid4()),
                title=title
                or f"Conversation {datetime.now().strftime('%Y-%m-%d %H:%M')}",
                user_id=user_id,
                session_id=session_id,
                status=ConversationStatus.ACTIVE.value,
                created_at=datetime.utcnow(),
                message_count=0,
            )

            db.session.add(conversation)
            db.session.commit()

            self.logger.info(f"Created conversation {conversation.id}")
            return conversation

        except Exception as e:
            self.logger.error(f"Failed to create conversation: {str(e)}")
            db.session.rollback()
            raise

    def get_conversation(self, conversation_id: str) -> Optional[AIConversation]:
        """Get a conversation by ID."""
        try:
            return AIConversation.query.filter_by(id=conversation_id).first()
        except Exception as e:
            self.logger.error(f"Failed to get conversation {conversation_id}: {str(e)}")
            return None

    def get_conversations(
        self, user_id: str = None, session_id: str = None, limit: int = 50
    ) -> List[AIConversation]:
        """Get conversations, optionally filtered by user or session."""
        try:
            query = AIConversation.query

            if user_id:
                query = query.filter_by(user_id=user_id)
            if session_id:
                query = query.filter_by(session_id=session_id)

            return (
                query.order_by(AIConversation.last_message_at.desc()).limit(limit).all()
            )

        except Exception as e:
            self.logger.error(f"Failed to get conversations: {str(e)}")
            return []

    def add_message(
        self,
        conversation_id: str,
        content: str,
        message_type: str,
        metadata: Dict[str, Any] = None,
    ) -> Optional[AIMessage]:
        """Add a message to a conversation."""
        try:
            # Validate message type
            if message_type not in [
                MessageType.USER.value,
                MessageType.AI.value,
                MessageType.SYSTEM.value,
            ]:
                raise ValueError(f"Invalid message type: {message_type}")

            # Get conversation
            conversation = self.get_conversation(conversation_id)
            if not conversation:
                raise ValueError(f"Conversation {conversation_id} not found")

            # Create message
            message = AIMessage(
                id=str(uuid.uuid4()),
                conversation_id=conversation_id,
                type=message_type,
                content=content,
                message_metadata=metadata
                or {},  # Use message_metadata instead of metadata
                timestamp=datetime.utcnow(),
            )

            db.session.add(message)

            # Update conversation
            conversation.message_count += 1
            conversation.last_message_at = datetime.utcnow()

            db.session.commit()

            self.logger.info(f"Added message to conversation {conversation_id}")
            return message

        except Exception as e:
            self.logger.error(
                f"Failed to add message to conversation {conversation_id}: {str(e)}"
            )
            db.session.rollback()
            return None

    def get_conversation_history(
        self, conversation_id: str, limit: int = 50
    ) -> List[AIMessage]:
        """Get conversation message history."""
        try:
            return (
                AIMessage.query.filter_by(conversation_id=conversation_id)
                .order_by(AIMessage.timestamp.asc())
                .limit(limit)
                .all()
            )
        except Exception as e:
            self.logger.error(
                f"Failed to get conversation history {conversation_id}: {str(e)}"
            )
            return []

    def archive_conversation(self, conversation_id: str) -> bool:
        """Archive a conversation."""
        try:
            conversation = self.get_conversation(conversation_id)
            if not conversation:
                return False

            conversation.status = ConversationStatus.ARCHIVED.value
            db.session.commit()

            self.logger.info(f"Archived conversation {conversation_id}")
            return True

        except Exception as e:
            self.logger.error(
                f"Failed to archive conversation {conversation_id}: {str(e)}"
            )
            db.session.rollback()
            return False

    def delete_conversation(self, conversation_id: str) -> bool:
        """Delete a conversation and all its messages."""
        try:
            conversation = self.get_conversation(conversation_id)
            if not conversation:
                return False

            # Messages will be deleted automatically due to cascade delete
            db.session.delete(conversation)
            db.session.commit()

            self.logger.info(f"Deleted conversation {conversation_id}")
            return True

        except Exception as e:
            self.logger.error(
                f"Failed to delete conversation {conversation_id}: {str(e)}"
            )
            db.session.rollback()
            return False

    def get_conversation_stats(self) -> Dict[str, Any]:
        """Get conversation statistics."""
        try:
            total_conversations = AIConversation.query.count()
            active_conversations = AIConversation.query.filter_by(
                status=ConversationStatus.ACTIVE.value
            ).count()
            total_messages = AIMessage.query.count()

            return {
                "total_conversations": total_conversations,
                "active_conversations": active_conversations,
                "archived_conversations": total_conversations - active_conversations,
                "total_messages": total_messages,
            }

        except Exception as e:
            self.logger.error(f"Failed to get conversation stats: {str(e)}")
            return {
                "total_conversations": 0,
                "active_conversations": 0,
                "archived_conversations": 0,
                "total_messages": 0,
            }
