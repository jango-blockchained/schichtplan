"""
AI System Database Migration

Create tables for AI conversations, messages, agent metrics, and workflow executions.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

# revision identifiers
revision = 'ai_system_tables'
down_revision = None  # Set this to the latest migration
branch_labels = None
depends_on = None


def upgrade():
    """Create AI system tables."""
    
    # AI Conversations table
    op.create_table(
        'ai_conversations',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('title', sa.String(255), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP, nullable=False, server_default=sa.func.current_timestamp()),
        sa.Column('last_message_at', sa.TIMESTAMP, nullable=True),
        sa.Column('message_count', sa.Integer, default=0),
        sa.Column('status', sa.Enum('active', 'archived', name='conversation_status'), default='active'),
        sa.Column('user_id', sa.String(100), nullable=True),
        sa.Column('session_id', sa.String(100), nullable=True),
    )

    # AI Messages table
    op.create_table(
        'ai_messages',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('conversation_id', sa.String(36), nullable=False),
        sa.Column('type', sa.Enum('user', 'ai', 'system', name='message_type'), nullable=False),
        sa.Column('content', sa.Text, nullable=False),
        sa.Column('timestamp', sa.TIMESTAMP, nullable=False, server_default=sa.func.current_timestamp()),
        sa.Column('metadata', sa.JSON, nullable=True),
        sa.ForeignKeyConstraint(['conversation_id'], ['ai_conversations.id'], ondelete='CASCADE'),
    )

    # AI Agent Metrics table
    op.create_table(
        'ai_agent_metrics',
        sa.Column('id', sa.Integer, primary_key=True, autoincrement=True),
        sa.Column('agent_id', sa.String(100), nullable=False),
        sa.Column('date', sa.Date, nullable=False),
        sa.Column('requests_count', sa.Integer, default=0),
        sa.Column('success_count', sa.Integer, default=0),
        sa.Column('avg_response_time', sa.Float, default=0.0),
        sa.Column('created_at', sa.TIMESTAMP, nullable=False, server_default=sa.func.current_timestamp()),
        sa.Index('idx_agent_date', 'agent_id', 'date'),
    )

    # AI Workflow Executions table
    op.create_table(
        'ai_workflow_executions',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('template_id', sa.String(100), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('status', sa.Enum('pending', 'running', 'completed', 'failed', 'paused', name='workflow_status'), default='pending'),
        sa.Column('progress', sa.Integer, default=0),
        sa.Column('start_time', sa.TIMESTAMP, nullable=True),
        sa.Column('end_time', sa.TIMESTAMP, nullable=True),
        sa.Column('inputs', sa.JSON, nullable=True),
        sa.Column('outputs', sa.JSON, nullable=True),
        sa.Column('error', sa.Text, nullable=True),
        sa.Column('created_at', sa.TIMESTAMP, nullable=False, server_default=sa.func.current_timestamp()),
        sa.Index('idx_template_status', 'template_id', 'status'),
    )

    # MCP Tool Usage table
    op.create_table(
        'mcp_tool_usage',
        sa.Column('id', sa.Integer, primary_key=True, autoincrement=True),
        sa.Column('tool_id', sa.String(100), nullable=False),
        sa.Column('executed_at', sa.TIMESTAMP, nullable=False, server_default=sa.func.current_timestamp()),
        sa.Column('parameters', sa.JSON, nullable=True),
        sa.Column('result', sa.JSON, nullable=True),
        sa.Column('execution_time', sa.Float, default=0.0),
        sa.Column('success', sa.Boolean, default=True),
        sa.Column('error', sa.Text, nullable=True),
        sa.Index('idx_tool_executed', 'tool_id', 'executed_at'),
    )


def downgrade():
    """Drop AI system tables."""
    op.drop_table('mcp_tool_usage')
    op.drop_table('ai_workflow_executions')
    op.drop_table('ai_agent_metrics')
    op.drop_table('ai_messages')
    op.drop_table('ai_conversations')
    
    # Drop custom enums
    op.execute('DROP TYPE IF EXISTS conversation_status')
    op.execute('DROP TYPE IF EXISTS message_type')
    op.execute('DROP TYPE IF EXISTS workflow_status')
