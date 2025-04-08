-- Migration number: 0003 	 2025-04-07T12:46:51.136Z
-- Drop the existing tables in correct order to respect foreign key constraints
DELETE FROM subscription;  -- Delete subscriptions first as they reference both stocks and subscribers
DELETE FROM stock;        -- Then delete stocks as they reference publishers
DELETE FROM subscriber;   -- Delete subscribers
DELETE FROM publisher;    -- Finally delete publishers
