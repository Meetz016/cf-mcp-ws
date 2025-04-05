-- Create publisher table
CREATE TABLE IF NOT EXISTS publisher (
  publisher_id TEXT PRIMARY KEY
);

-- Create stock table
CREATE TABLE IF NOT EXISTS stock (
  stock_id TEXT PRIMARY KEY,
  stock_name TEXT NOT NULL,
  stock_symbol TEXT NOT NULL,
  stock_price TEXT NOT NULL,
  publisher_id TEXT,
  FOREIGN KEY (publisher_id) REFERENCES publisher(publisher_id)
);

-- Add index for publisher_id in stock table
CREATE INDEX IF NOT EXISTS idx_stock_publisher ON stock(publisher_id); 