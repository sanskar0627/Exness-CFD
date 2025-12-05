#!/bin/bash

# Diagnostic script to check why charts are not showing data

echo "========================================="
echo "CHART DATA DIAGNOSTIC TOOL"
echo "========================================="
echo ""

# Check 1: PostgreSQL Connection
echo "[1/6] Checking PostgreSQL connection..."
docker exec exness_db psql -U user -d trades_db -c "SELECT 1;" > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo " PostgreSQL is running and accessible"
else
    echo " PostgreSQL is NOT accessible"
    echo "   Run: docker-compose up -d"
    exit 1
fi
echo ""

# Check 2: Trade table exists
echo "[2/6] Checking if Trade table exists..."
TABLE_EXISTS=$(docker exec exness_db psql -U user -d trades_db -t -c "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Trade');")
if [[ "$TABLE_EXISTS" == *"t"* ]]; then
    echo " Trade table exists"
else
    echo " Trade table does NOT exist"
    echo "   Run: bun run prisma migrate dev"
    exit 1
fi
echo ""

# Check 3: Count trades in database
echo "[3/6] Checking trade count in database..."
TRADE_COUNT=$(docker exec exness_db psql -U user -d trades_db -t -c "SELECT COUNT(*) FROM \"Trade\";")
TRADE_COUNT=$(echo $TRADE_COUNT | tr -d ' ')
echo "   Total trades in database: $TRADE_COUNT"

if [ "$TRADE_COUNT" -eq 0 ]; then
    echo " Trade table is EMPTY - this is why charts show no data!"
    echo "   Price_Poller kafka-consumer needs to be running to populate data"
else
    echo "Trade table has data"
fi
echo ""

# Check 4: Check recent trades (last 5 minutes)
echo "[4/6] Checking for recent trades (last 5 minutes)..."
RECENT_TRADES=$(docker exec exness_db psql -U user -d trades_db -t -c "SELECT COUNT(*) FROM \"Trade\" WHERE timestamp >= NOW() - INTERVAL '5 minutes';")
RECENT_TRADES=$(echo $RECENT_TRADES | tr -d ' ')
echo "   Recent trades (last 5 min): $RECENT_TRADES"

if [ "$RECENT_TRADES" -eq 0 ]; then
    echo "  No recent trades - Price_Poller may not be running or writing to DB"
else
    echo " Recent trades are being written"
fi
echo ""

# Check 5: Check trades by symbol
echo "[5/6] Checking trades by symbol..."
docker exec exness_db psql -U user -d trades_db -c "SELECT symbol, COUNT(*) as count, MAX(timestamp) as latest_trade FROM \"Trade\" GROUP BY symbol ORDER BY symbol;"
echo ""

# Check 6: Show sample candle query result
echo "[6/6] Testing candle query (1 minute candles for last hour)..."
docker exec exness_db psql -U user -d trades_db -c "
  SELECT
    time_bucket(INTERVAL '1 minute', timestamp) AS time,
    (array_agg(price ORDER BY timestamp))[1] AS open,
    MAX(price) AS high,
    MIN(price) AS low,
    (array_agg(price ORDER BY timestamp DESC))[1] AS close,
    COUNT(*) AS trade_count
  FROM \"Trade\"
  WHERE symbol = 'BTCUSDT'
    AND timestamp >= NOW() - INTERVAL '1 hour'
  GROUP BY time_bucket(INTERVAL '1 minute', timestamp)
  ORDER BY time DESC
  LIMIT 10;
"
echo ""

echo "========================================="
echo "DIAGNOSIS COMPLETE"
echo "========================================="
echo ""
echo "Next steps to fix:"
echo "1. If Trade table is empty, start Price_Poller:"
echo "   cd apps/Price_Poller && bun run src/index.ts"
echo ""
echo "2. Wait 1-2 minutes for data to accumulate"
echo ""
echo "3. Refresh your browser to see charts populate"
echo ""
