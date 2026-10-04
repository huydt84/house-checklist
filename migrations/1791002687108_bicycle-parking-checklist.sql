-- Keep bicycle availability and its monthly fee together in the viewing checklist.
-- Publish definition changes so offline clients refresh, without touching answers.
DO $$
DECLARE
  section record;
  criterion record;
  definition jsonb;
  revised jsonb;
  locale text;
  old_label text;
  next_sequence bigint;
BEGIN
  FOR section IN SELECT * FROM sections WHERE data->>'key' = 'G'
    ORDER BY collection_id, id
  LOOP
    FOR definition IN SELECT value FROM jsonb_array_elements($definitions$[{"key":"G05","section":"G","type":"boolean","unit":null,"guidance":{"en":"availability of spaces and registration conditions.","ja":"空き区画と登録条件を確認します。","vi":"Kiểm tra còn chỗ và điều kiện đăng ký."},"sourceKey":"G05","labels":{"en":"Bicycle parking available","ja":"駐輪場の有無","vi":"Chỗ đỗ xe đạp"},"sourceLocale":"en","order":640,"importance":"information","stages":["A","V","S"],"choices":[],"supportFields":[],"archived":false,"scope":"apartment"},{"key":"G06","section":"G","type":"number","unit":"JPY/month","guidance":{"en":"distinguish parking at home from parking at a station.","ja":"自宅の駐輪場と駅の駐輪場を区別します。","vi":"Phân biệt chỗ đỗ tại nhà với chỗ đỗ ở ga."},"sourceKey":"G06","labels":{"en":"Monthly bicycle parking fee","ja":"駐輪場の月額料金","vi":"Phí đỗ xe đạp hằng tháng"},"sourceLocale":"en","order":650,"importance":"information","stages":["A","V","S"],"choices":[],"supportFields":[{"id":"station","type":"number","unit":"JPY/month","labels":{"en":"Station bicycle parking","ja":"駅の駐輪場","vi":"Đỗ xe đạp ở ga"}}],"archived":false,"scope":"apartment"}]$definitions$::jsonb)
    LOOP
      SELECT * INTO criterion FROM criteria WHERE collection_id = section.collection_id
        AND coalesce(data->>'sourceKey', data->>'key') = definition->>'key'
        ORDER BY id LIMIT 1;
      IF NOT FOUND THEN
        INSERT INTO criteria(id, collection_id, section_id, data)
          VALUES(gen_random_uuid(), section.collection_id, section.id, definition)
          RETURNING * INTO criterion;
      ELSE
        revised := criterion.data;
        FOR locale, old_label IN SELECT language, label FROM (VALUES
          ('G05', 'en', 'Suitable bicycle parking'),
          ('G05', 'ja', '使える駐輪場'),
          ('G05', 'vi', 'Chỗ đỗ xe đạp phù hợp'),
          ('G06', 'en', 'Bicycle-parking cost')
        ) AS defaults(key, language, label) WHERE key = definition->>'key'
        LOOP
          IF revised->'labels'->>locale = old_label THEN
            revised := jsonb_set(revised, ARRAY['labels', locale], definition->'labels'->locale);
          END IF;
        END LOOP;
        IF NOT coalesce(revised->'stages', '[]'::jsonb) @> '["V"]'::jsonb THEN
          revised := jsonb_set(revised, '{stages}', coalesce(revised->'stages', '[]'::jsonb) || '["V"]'::jsonb);
        END IF;
        IF revised = criterion.data THEN CONTINUE; END IF;
        UPDATE criteria SET data = revised, revision = revision + 1
          WHERE id = criterion.id RETURNING * INTO criterion;
      END IF;
      UPDATE collections SET sequence = sequence + 1, checklist_revision = checklist_revision + 1
        WHERE id = section.collection_id RETURNING sequence INTO next_sequence;
      INSERT INTO events(collection_id, sequence, entity, record_id, payload)
        VALUES(criterion.collection_id, next_sequence, 'criteria', criterion.id,
          criterion.data || jsonb_build_object('id', criterion.id,
            'collectionId', criterion.collection_id, 'sectionId', criterion.section_id,
            'revision', criterion.revision));
    END LOOP;
  END LOOP;
END $$;
