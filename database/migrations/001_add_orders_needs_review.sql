-- Flags paid orders where stock ran short after payment was captured (manual follow-up / refund).
-- For databases created before this column existed in schema.sql.
ALTER TABLE orders ADD COLUMN needs_review TINYINT(1) NOT NULL DEFAULT 0 AFTER paid_at;
