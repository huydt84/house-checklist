-- Monetary checks in section H use whole-yen amounts. Retain old descriptions
-- in notes and publish both answers and definitions to cached workspaces.
DO $$
DECLARE
  criterion criteria%ROWTYPE;
  answer answers%ROWTYPE;
  amount jsonb;
  old_value text;
  next_sequence bigint;
BEGIN
  FOR criterion IN
    SELECT * FROM criteria
    WHERE coalesce(data->>'sourceKey', data->>'key') IN
      ('H05','H07','H08','H09','H11','H12','H13','H14','H16','H17','H18')
      AND (data->>'type' = 'text' OR
        (data->>'type' = 'number' AND data->>'unit' IS DISTINCT FROM 'JPY'))
    ORDER BY collection_id, id
  LOOP
    FOR answer IN SELECT * FROM answers WHERE criterion_id = criterion.id ORDER BY id LOOP
      old_value := btrim(answer.data->>'value');
      amount := 'null'::jsonb;
      IF old_value ~ '^[0-9]{1,16}$' THEN
        IF old_value::numeric <= 9007199254740991
          AND answer.data->>'state' = 'answered' THEN
          amount := to_jsonb(old_value::bigint);
        END IF;
      END IF;
      UPDATE answers SET data = data || jsonb_build_object(
        'legacyFeeAnswer', data,
        'value', amount,
        'state', CASE WHEN data->>'state' = 'not_applicable' THEN 'not_applicable'
          WHEN amount <> 'null'::jsonb THEN 'answered' ELSE 'not_checked' END,
        'notes', concat_ws(E'\n', nullif(data->>'notes', ''),
          CASE WHEN jsonb_typeof(data->'value') = 'string' OR amount = 'null'::jsonb
            THEN nullif(data->>'value', '') END)
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
    UPDATE criteria SET data = data || '{"type":"number","unit":"JPY"}'::jsonb,
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
