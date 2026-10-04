-- Archive availability without deleting its answers. Convert the seeded basic
-- details check to one year, preserving old text and support data for reference.
-- Publish every changed row so already-open and cached workspaces refresh.
DO $$
DECLARE
  criterion criteria%ROWTYPE;
  answer answers%ROWTYPE;
  collection collections%ROWTYPE;
  year_value jsonb;
  old_notes text;
  next_sequence bigint;
BEGIN
  FOR criterion IN
    SELECT * FROM criteria
    WHERE (data->>'key' = 'A01' AND coalesce((data->>'archived')::boolean, false) = false)
      OR (data->>'key' = 'A05' AND data->>'type' = 'text'
        AND data->'supportFields' @> '[{"id":"builtYear"}]'::jsonb)
    ORDER BY collection_id, id
  LOOP
    IF criterion.data->>'key' = 'A05' THEN
      FOR answer IN SELECT * FROM answers WHERE criterion_id = criterion.id LOOP
        year_value := CASE
          WHEN jsonb_typeof(answer.data->'support'->'builtYear') = 'number'
            AND answer.data->'support'->>'builtYear' ~ '^[0-9]{1,4}$'
            THEN answer.data->'support'->'builtYear'
          WHEN btrim(answer.data->>'value') ~ '^[0-9]{4}$'
            THEN to_jsonb(btrim(answer.data->>'value')::integer)
          ELSE 'null'::jsonb END;
        old_notes := concat_ws(E'\n',
          nullif(answer.data->>'notes', ''),
          nullif(answer.data->>'value', ''),
          CASE WHEN nullif(answer.data->'support'->>'floor', '') IS NOT NULL
            THEN 'Floor: ' || (answer.data->'support'->>'floor') END,
          CASE WHEN nullif(answer.data->'support'->>'construction', '') IS NOT NULL
            THEN 'Construction: ' || (answer.data->'support'->>'construction') END);
        UPDATE answers SET data = data || jsonb_build_object(
          'legacyBuildingDetails', data,
          'value', CASE WHEN data->>'state' = 'not_applicable' THEN 'null'::jsonb ELSE year_value END,
          'state', CASE WHEN data->>'state' = 'not_applicable' THEN 'not_applicable'
            WHEN year_value <> 'null'::jsonb THEN 'answered' ELSE 'not_checked' END,
          'support', '{}'::jsonb, 'notes', old_notes, 'suitability', 'unassessed'
        ), revision = revision + 1
        WHERE id = answer.id RETURNING * INTO answer;
        UPDATE collections SET sequence = sequence + 1
          WHERE id = answer.collection_id RETURNING sequence INTO next_sequence;
        INSERT INTO events(collection_id, sequence, entity, record_id, payload)
          VALUES(answer.collection_id, next_sequence, 'answers', answer.id,
            answer.data || jsonb_build_object('id', answer.id,
              'collectionId', answer.collection_id, 'apartmentId', answer.apartment_id,
              'criterionId', answer.criterion_id, 'scenarioId', answer.scenario_id,
              'revision', answer.revision));
      END LOOP;
      UPDATE criteria SET data = data || jsonb_build_object(
        'type', 'number', 'unit', 'year', 'supportFields', '[]'::jsonb,
        'labels', '{"en":"Building year","ja":"築年","vi":"Năm xây dựng"}'::jsonb,
        'guidance', '{"en":"Record the year the building was built.","ja":"建物が建てられた年を記録します。","vi":"Ghi năm tòa nhà được xây dựng."}'::jsonb
      ), revision = revision + 1 WHERE id = criterion.id RETURNING * INTO criterion;
    ELSE
      UPDATE criteria SET data = data || '{"archived":true}'::jsonb,
        revision = revision + 1 WHERE id = criterion.id RETURNING * INTO criterion;
    END IF;
    UPDATE collections SET sequence = sequence + 1,
      checklist_revision = checklist_revision + 1
      WHERE id = criterion.collection_id RETURNING * INTO collection;
    INSERT INTO events(collection_id, sequence, entity, record_id, payload)
      VALUES(criterion.collection_id, collection.sequence, 'criteria', criterion.id,
        criterion.data || jsonb_build_object('id', criterion.id,
          'collectionId', criterion.collection_id, 'sectionId', criterion.section_id,
          'scenarioId', null, 'revision', criterion.revision));
  END LOOP;
END $$;
