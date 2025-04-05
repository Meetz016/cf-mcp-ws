CREATE TABLE subscriber (
  subscriber_id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL
);

CREATE TABLE subscriptions (
  subscription_id TEXT PRIMARY KEY,
  subscriber_id TEXT NOT NULL,
  stock_id TEXT NOT NULL,
  FOREIGN KEY (subscriber_id) REFERENCES subscriber(subscriber_id),
  FOREIGN KEY (stock_id) REFERENCES stock(stock_id)
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_subscriber_id ON subscriptions(subscriber_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stock_id ON subscriptions(stock_id);