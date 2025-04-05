-- Migration number: 0001 	 2025-04-05T08:29:06.761Z
-- Create publisher table
CREATE TABLE IF NOT EXISTS publisher (
  publisher_id TEXT PRIMARY KEY,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create stock table
CREATE TABLE IF NOT EXISTS stock (
  stock_id TEXT PRIMARY KEY,
  stock_name TEXT NOT NULL,
  stock_symbol TEXT NOT NULL,
  stock_price TEXT NOT NULL,
  publisher_id TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (publisher_id) REFERENCES publisher(publisher_id)
);

-- Create subscriber table
CREATE TABLE IF NOT EXISTS subscriber (
  subscriber_id TEXT PRIMARY KEY,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create subscription table
CREATE TABLE IF NOT EXISTS subscription (
  subscription_id TEXT PRIMARY KEY,
  stock_name TEXT NOT NULL,
  subscriber_id TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (subscriber_id) REFERENCES subscriber(subscriber_id)
);

-- Add index for publisher_id in stock table
CREATE INDEX IF NOT EXISTS idx_stock_publisher ON stock(publisher_id);

-- Add index for subscriber_id in subscription table
CREATE INDEX IF NOT EXISTS idx_subscription_subscriber ON subscription(subscriber_id);

-- Add index for stock_name in subscription table
CREATE INDEX IF NOT EXISTS idx_subscription_stock ON subscription(stock_name); 