-- Quick SQL diagnostics for chart data issues

-- 1. Check total trades in database
SELECT
    'Total Trades' as metric,
    COUNT(*) as value
FROM "Trade";

-- 2. Check trades by symbol
SELECT
    symbol,
    COUNT(*) as trade_count,
    MIN(timestamp) as first_trade,
    MAX(timestamp) as latest_trade
FROM "Trade"
GROUP BY symbol
ORDER BY symbol;

-- 3. Check recent trades (last 10 minutes)
SELECT
    symbol,
    COUNT(*) as recent_trades
FROM "Trade"
WHERE timestamp >= NOW() - INTERVAL '10 minutes'
GROUP BY symbol;

-- 4. Show sample trades from each symbol
(SELECT * FROM "Trade" WHERE symbol = 'BTCUSDT' ORDER BY timestamp DESC LIMIT 3)
UNION ALL
(SELECT * FROM "Trade" WHERE symbol = 'ETHUSDT' ORDER BY timestamp DESC LIMIT 3)
UNION ALL
(SELECT * FROM "Trade" WHERE symbol = 'SOLUSDT' ORDER BY timestamp DESC LIMIT 3)
ORDER BY timestamp DESC;

-- 5. Test candle aggregation (1 minute candles for last hour)
SELECT
    symbol,
    time_bucket(INTERVAL '1 minute', timestamp) AS minute,
    (array_agg(price ORDER BY timestamp))[1] AS open,
    MAX(price) AS high,
    MIN(price) AS low,
    (array_agg(price ORDER BY timestamp DESC))[1] AS close,
    COUNT(*) AS trade_count
FROM "Trade"
WHERE timestamp >= NOW() - INTERVAL '1 hour'
GROUP BY symbol, time_bucket(INTERVAL '1 minute', timestamp)
ORDER BY minute DESC
LIMIT 20;
