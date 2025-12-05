-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- Convert Trade table to TimescaleDB Hypertable
-- migrate_data => true migrates existing data into the hypertable
SELECT create_hypertable('"Trade"', 'timestamp', migrate_data => true);