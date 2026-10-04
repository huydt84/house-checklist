-- Existing devices sync from events rather than fetching a full snapshot.
-- Publish the new timestamp so their cached rows use the same entry order.
WITH numbered AS (
  SELECT a.*, row_number() OVER (PARTITION BY collection_id ORDER BY created_at, id) AS offset
  FROM apartments a
), advanced AS (
  UPDATE collections c SET sequence=sequence+totals.count
  FROM (SELECT collection_id, count(*) AS count FROM apartments GROUP BY collection_id) totals
  WHERE c.id=totals.collection_id
  RETURNING c.id,c.sequence,totals.count
)
INSERT INTO events(collection_id,sequence,entity,record_id,payload)
SELECT n.collection_id,a.sequence-a.count+n.offset,'apartments',n.id,
  n.data || jsonb_build_object('id',n.id,'collectionId',n.collection_id,
    'revision',n.revision,'scenarioId',null,'createdAt',n.created_at)
FROM numbered n JOIN advanced a ON a.id=n.collection_id;
