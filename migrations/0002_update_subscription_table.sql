-- Drop existing subscription table indexes if they exist
DROP INDEX IF EXISTS idx_subscription_stock;
DROP INDEX IF EXISTS idx_subscription_subscriber;

-- Backup existing subscription data
CREATE TABLE IF NOT EXISTS subscription_backup (
  subscription_id TEXT PRIMARY KEY,
  stock_name TEXT NOT NULL,
  subscriber_id TEXT NOT NULL,
  created_at TIMESTAMP
);

INSERT INTO subscription_backup 
SELECT subscription_id, stock_name, subscriber_id, created_at 
FROM subscription;

-- Drop existing subscription table
DROP TABLE IF EXISTS subscription;

-- Create new subscription table with stock_id
CREATE TABLE IF NOT EXISTS subscription (
  subscription_id TEXT PRIMARY KEY,
  stock_id TEXT NOT NULL,
  subscriber_id TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (stock_id) REFERENCES stock(stock_id),
  FOREIGN KEY (subscriber_id) REFERENCES subscriber(subscriber_id)
);

-- Migrate existing data (based on stock name)
INSERT INTO subscription (subscription_id, stock_id, subscriber_id, created_at)
SELECT sb.subscription_id, s.stock_id, sb.subscriber_id, sb.created_at
FROM subscription_backup sb
JOIN stock s ON UPPER(sb.stock_name) = UPPER(s.stock_name);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_subscription_subscriber ON subscription(subscriber_id);
CREATE INDEX IF NOT EXISTS idx_subscription_stock ON subscription(stock_id);

-- Drop backup table
DROP TABLE IF EXISTS subscription_backup; 