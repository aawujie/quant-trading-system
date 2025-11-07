"""add_beijing_time_to_klines

Revision ID: 40494983073e
Revises: e4209ecb3f09
Create Date: 2025-11-08 00:59:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '40494983073e'
down_revision: Union[str, None] = 'e4209ecb3f09'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add beijing_time column to klines table"""
    # Add the column (nullable first)
    op.add_column('klines', sa.Column('beijing_time', sa.DateTime(timezone=True), nullable=True))
    
    # Create a function to set beijing_time (UTC + 8 hours)
    op.execute("""
        CREATE OR REPLACE FUNCTION set_beijing_time()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.beijing_time = to_timestamp(NEW.timestamp) + interval '8 hours';
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)
    
    # Create a trigger to call the function before insert or update
    op.execute("""
        CREATE TRIGGER klines_set_beijing_time
        BEFORE INSERT OR UPDATE ON klines
        FOR EACH ROW
        EXECUTE FUNCTION set_beijing_time();
    """)
    
    # Populate beijing_time for existing rows (UTC + 8 hours)
    op.execute("""
        UPDATE klines
        SET beijing_time = to_timestamp(timestamp) + interval '8 hours';
    """)
    
    # Make the column non-nullable after populating
    op.alter_column('klines', 'beijing_time', nullable=False)
    
    # Create index on beijing_time for better query performance
    op.create_index('idx_klines_beijing_time', 'klines', ['symbol', 'timeframe', 'beijing_time'])


def downgrade() -> None:
    """Remove beijing_time column from klines table"""
    # Drop trigger and function
    op.execute("DROP TRIGGER IF EXISTS klines_set_beijing_time ON klines;")
    op.execute("DROP FUNCTION IF EXISTS set_beijing_time();")
    
    # Drop index and column
    op.drop_index('idx_klines_beijing_time', table_name='klines')
    op.drop_column('klines', 'beijing_time')
