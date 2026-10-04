ALTER TABLE apartments ADD COLUMN created_at timestamptz;

-- Recover entry time from the first recorded write; seeded rows have no history.
UPDATE apartments a SET created_at = COALESCE(
  (SELECT min(h.created_at) FROM history h
   WHERE h.collection_id=a.collection_id AND h.record_id=a.id AND h.entity='apartments'),
  (SELECT c.created_at FROM collections c WHERE c.id=a.collection_id)
);
ALTER TABLE apartments ALTER COLUMN created_at SET DEFAULT clock_timestamp();
ALTER TABLE apartments ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE collections ADD COLUMN apartment_order jsonb NOT NULL DEFAULT '[]';
ALTER TABLE collections ADD COLUMN apartment_order_revision integer NOT NULL DEFAULT 0;
