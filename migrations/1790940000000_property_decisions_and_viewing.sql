-- Keep the original decision for reference; viewing is independent of decisions.
-- Increment revisions and publish events so existing cached workspaces refresh.
WITH updated AS (
  UPDATE apartments
  SET data = data
    || CASE WHEN data->>'status' IN
      ('contacted', 'viewing_scheduled', 'viewed', 'applied', 'selected', 'rejected', 'unavailable')
      THEN jsonb_build_object('legacyStatus', data->>'status') ELSE '{}'::jsonb END
    || jsonb_build_object(
      'status', CASE
        WHEN data->>'status' IN ('rejected', 'unavailable') THEN 'disqualified'
        WHEN data->>'status' IN ('shortlisted', 'applied', 'selected') THEN 'shortlisted'
        WHEN data->>'status' = 'disqualified' THEN 'disqualified'
        ELSE 'considering' END,
      'viewed', CASE WHEN jsonb_typeof(data->'viewed') = 'boolean' THEN data->'viewed'
        ELSE to_jsonb(coalesce(data->>'status' = 'viewed', false)) END,
      'archived', CASE WHEN jsonb_typeof(data->'archived') = 'boolean' THEN data->'archived'
        ELSE 'false'::jsonb END
    ), revision = revision + 1
  WHERE coalesce(data->>'status', '') NOT IN ('considering', 'disqualified', 'shortlisted')
    OR jsonb_typeof(data->'viewed') IS DISTINCT FROM 'boolean'
    OR jsonb_typeof(data->'archived') IS DISTINCT FROM 'boolean'
  RETURNING *
), numbered AS (
  SELECT u.*, row_number() OVER (PARTITION BY collection_id ORDER BY id) AS offset
  FROM updated u
), advanced AS (
  UPDATE collections c
  SET sequence = sequence + totals.count
  FROM (SELECT collection_id, count(*) AS count FROM updated GROUP BY collection_id) totals
  WHERE c.id = totals.collection_id
  RETURNING c.id, c.sequence, totals.count
)
INSERT INTO events(collection_id, sequence, entity, record_id, payload)
SELECT n.collection_id, a.sequence - a.count + n.offset, 'apartments', n.id,
  n.data || jsonb_build_object('id', n.id, 'collectionId', n.collection_id,
    'revision', n.revision, 'scenarioId', null)
FROM numbered n JOIN advanced a ON a.id = n.collection_id;
