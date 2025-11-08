"""add_market_type_to_klines

Revision ID: 51fa2931d920
Revises: 40494983073e
Create Date: 2025-11-08 15:30:03.160093

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '51fa2931d920'
down_revision: Union[str, None] = '40494983073e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. 删除旧的唯一索引
    op.drop_index('idx_klines_lookup', table_name='klines')
    
    # 2. 添加 market_type 字段（默认值为 'spot'，兼容现有数据）
    op.add_column('klines', sa.Column('market_type', sa.String(20), nullable=False, server_default='spot'))
    
    # 3. 创建新的唯一索引（包含 market_type）
    op.create_index('idx_klines_lookup', 'klines', ['symbol', 'timeframe', 'timestamp', 'market_type'], unique=True)
    
    # 4. 更新现有数据，将所有数据标记为 'spot'（已通过 server_default 完成）
    # 如果需要将现有数据标记为 'future'，可以执行：
    # op.execute("UPDATE klines SET market_type = 'future' WHERE created_at > '2025-11-08 15:20:00'")


def downgrade() -> None:
    # 1. 删除新索引
    op.drop_index('idx_klines_lookup', table_name='klines')
    
    # 2. 删除 market_type 字段
    op.drop_column('klines', 'market_type')
    
    # 3. 恢复旧索引
    op.create_index('idx_klines_lookup', 'klines', ['symbol', 'timeframe', 'timestamp'], unique=True)

