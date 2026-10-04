-- Retire the duplicate agency/broker fee check while preserving its answers.
-- Publish the change so cached workspaces also remove it from active checklists.
DO $$
DECLARE
  criterion criteria%ROWTYPE;
  next_sequence bigint;
BEGIN
  FOR criterion IN
    SELECT * FROM criteria
    WHERE coalesce(data->>'sourceKey', data->>'key') = 'H06'
      AND coalesce((data->>'archived')::boolean, false) = false
    ORDER BY collection_id, id
  LOOP
    UPDATE criteria SET data = data || '{"archived":true}'::jsonb,
      revision = revision + 1
      WHERE id = criterion.id RETURNING * INTO criterion;
    UPDATE collections SET sequence = sequence + 1,
      checklist_revision = checklist_revision + 1
      WHERE id = criterion.collection_id RETURNING sequence INTO next_sequence;
    INSERT INTO events(collection_id, sequence, entity, record_id, payload)
      VALUES(criterion.collection_id, next_sequence, 'criteria', criterion.id,
        criterion.data || jsonb_build_object('id', criterion.id,
          'collectionId', criterion.collection_id, 'sectionId', criterion.section_id,
          'revision', criterion.revision));
  END LOOP;
END $$;
