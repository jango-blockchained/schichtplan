"""
AI System Database Models

Models for AI conversations, messages, metrics, and workflow executions.
"""

from datetime import datetime
from enum import Enum
import uuid

from sqlalchemy import Column, String, Text, Integer, Float, Boolean, DateTime, Date, ForeignKey, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship

from src.backend.models import db


class ConversationStatus(Enum):
    """Status of an AI conversation."""
    ACTIVE = "active"
    ARCHIVED = "archived"


class MessageType(Enum):
    """Type of message in a conversation."""
    USER = "user"
    AI = "ai"
    SYSTEM = "system"


class WorkflowStatus(Enum):
    """Status of a workflow execution."""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    PAUSED = "paused"


class AIConversation(db.Model):
    """AI conversation model."""
    __tablename__ = 'ai_conversations'

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String(255), nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    last_message_at = Column(DateTime, nullable=True)
    message_count = Column(Integer, default=0)
    status = Column(String(20), default=ConversationStatus.ACTIVE.value)
    user_id = Column(String(100), nullable=True)
    session_id = Column(String(100), nullable=True)

    # Relationship to messages
    messages = relationship("AIMessage", back_populates="conversation", cascade="all, delete-orphan")

    def to_dict(self):
        """Convert to dictionary."""
        return {
            'id': self.id,
            'title': self.title,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'last_message_at': self.last_message_at.isoformat() if self.last_message_at else None,
            'message_count': self.message_count,
            'status': self.status,
            'user_id': self.user_id,
            'session_id': self.session_id,
        }


class AIMessage(db.Model):
    """AI message model."""
    __tablename__ = 'ai_messages'

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    conversation_id = Column(String(36), ForeignKey('ai_conversations.id'), nullable=False)
    type = Column(String(20), nullable=False)
    content = Column(Text, nullable=False)
    timestamp = Column(DateTime, nullable=False, default=datetime.utcnow)
    metadata = Column(JSON, nullable=True)

    # Relationship to conversation
    conversation = relationship("AIConversation", back_populates="messages")

    def to_dict(self):
        """Convert to dictionary."""
        return {
            'id': self.id,
            'conversation_id': self.conversation_id,
            'type': self.type,
            'content': self.content,
            'timestamp': self.timestamp.isoformat() if self.timestamp else None,
            'metadata': self.metadata,
        }


class AIAgentMetrics(db.Model):
    """AI agent metrics model."""
    __tablename__ = 'ai_agent_metrics'

    id = Column(Integer, primary_key=True, autoincrement=True)
    agent_id = Column(String(100), nullable=False)
    date = Column(Date, nullable=False)
    requests_count = Column(Integer, default=0)
    success_count = Column(Integer, default=0)
    avg_response_time = Column(Float, default=0.0)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    def to_dict(self):
        """Convert to dictionary."""
        return {
            'id': self.id,
            'agent_id': self.agent_id,
            'date': self.date.isoformat() if self.date else None,
            'requests_count': self.requests_count,
            'success_count': self.success_count,
            'avg_response_time': self.avg_response_time,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class AIWorkflowExecution(db.Model):
    """AI workflow execution model."""
    __tablename__ = 'ai_workflow_executions'

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    template_id = Column(String(100), nullable=False)
    name = Column(String(255), nullable=False)
    status = Column(String(20), default=WorkflowStatus.PENDING.value)
    progress = Column(Integer, default=0)
    start_time = Column(DateTime, nullable=True)
    end_time = Column(DateTime, nullable=True)
    inputs = Column(JSON, nullable=True)
    outputs = Column(JSON, nullable=True)
    error = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    def to_dict(self):
        """Convert to dictionary."""
        return {
            'id': self.id,
            'template_id': self.template_id,
            'name': self.name,
            'status': self.status,
            'progress': self.progress,
            'start_time': self.start_time.isoformat() if self.start_time else None,
            'end_time': self.end_time.isoformat() if self.end_time else None,
            'inputs': self.inputs,
            'outputs': self.outputs,
            'error': self.error,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class MCPToolUsage(db.Model):
    """MCP tool usage tracking model."""
    __tablename__ = 'mcp_tool_usage'

    id = Column(Integer, primary_key=True, autoincrement=True)
    tool_id = Column(String(100), nullable=False)
    executed_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    parameters = Column(JSON, nullable=True)
    result = Column(JSON, nullable=True)
    execution_time = Column(Float, default=0.0)
    success = Column(Boolean, default=True)
    error = Column(Text, nullable=True)

    def to_dict(self):
        """Convert to dictionary."""
        return {
            'id': self.id,
            'tool_id': self.tool_id,
            'executed_at': self.executed_at.isoformat() if self.executed_at else None,
            'parameters': self.parameters,
            'result': self.result,
            'execution_time': self.execution_time,
            'success': self.success,
            'error': self.error,
        }
