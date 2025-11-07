"""add_drawings_table

Revision ID: e4209ecb3f09
Revises: 
Create Date: 2025-11-07 12:56:55.886867

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'e4209ecb3f09'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 创建 drawings 表
    op.create_table(
        'drawings',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('drawing_id', sa.String(length=50), nullable=False),
        sa.Column('symbol', sa.String(length=20), nullable=False),
        sa.Column('timeframe', sa.String(length=10), nullable=False),
        sa.Column('drawing_type', sa.String(length=20), nullable=False),
        sa.Column('points', postgresql.JSON(), nullable=False),
        sa.Column('style', postgresql.JSON(), nullable=False),
        sa.Column('label', sa.String(length=200), nullable=True),
        sa.Column('created_at', sa.BigInteger(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    
    # 创建索引
    op.create_index('ix_drawings_drawing_id', 'drawings', ['drawing_id'], unique=True)
    op.create_index('ix_drawings_symbol', 'drawings', ['symbol'], unique=False)
    op.create_index('ix_drawings_timeframe', 'drawings', ['timeframe'], unique=False)
    op.create_index('idx_drawings_lookup', 'drawings', ['symbol', 'timeframe'], unique=False)


def downgrade() -> None:
    # 删除索引
    op.drop_index('idx_drawings_lookup', table_name='drawings')
    op.drop_index('ix_drawings_timeframe', table_name='drawings')
    op.drop_index('ix_drawings_symbol', table_name='drawings')
    op.drop_index('ix_drawings_drawing_id', table_name='drawings')
    
    # 删除表
    op.drop_table('drawings')

