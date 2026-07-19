-- 30-day data retention for the Trade hypertable (TimescaleDB).
-- Charts will only show the last 30 days; disk usage stays bounded.
-- Apply once:
--   docker exec -i exness_db psql -U exness_user -d exness_trades < deploy/retention-policy.sql

-- Auto-drop chunks older than 30 days (runs in background daily)
SELECT add_retention_policy('"Trade"', INTERVAL '30 days', if_not_exists => TRUE);

-- Also compress chunks older than 7 days to save ~90% space on recent-but-cold data
ALTER TABLE "Trade" SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'symbol',
  timescaledb.compress_orderby = 'timestamp DESC'
);
SELECT add_compression_policy('"Trade"', INTERVAL '7 days', if_not_exists => TRUE);

-- Verify policies:
--   SELECT * FROM timescaledb_information.jobs;
