-- Extend existing kitchen checklists without rewriting apartment answers.
-- Publish changed definitions so open and offline workspaces refresh on sync.
DO $$
DECLARE
  criterion criteria%ROWTYPE;
  section sections%ROWTYPE;
  next_sequence bigint;
  availability jsonb;
BEGIN
  FOR criterion IN
    SELECT * FROM criteria
    WHERE coalesce(data->>'sourceKey', data->>'key') IN ('E04', 'E07')
      AND NOT coalesce(data->'supportFields', '[]'::jsonb) @> '[{"id":"available"}]'::jsonb
    ORDER BY collection_id, id
  LOOP
    availability := jsonb_build_object('id', 'available', 'type', 'boolean',
      'labels', CASE WHEN coalesce(criterion.data->>'sourceKey', criterion.data->>'key') = 'E04'
        THEN '{"en":"Refrigerator","ja":"冷蔵庫","vi":"Tủ lạnh"}'::jsonb
        ELSE '{"en":"Washing machine","ja":"洗濯機","vi":"Máy giặt"}'::jsonb END);
    UPDATE criteria SET data = jsonb_set(data, '{supportFields}',
      jsonb_build_array(availability) || coalesce(data->'supportFields', '[]'::jsonb)),
      revision = revision + 1
      WHERE id = criterion.id RETURNING * INTO criterion;
    UPDATE collections SET sequence = sequence + 1, checklist_revision = checklist_revision + 1
      WHERE id = criterion.collection_id RETURNING sequence INTO next_sequence;
    INSERT INTO events(collection_id, sequence, entity, record_id, payload)
      VALUES(criterion.collection_id, next_sequence, 'criteria', criterion.id,
        criterion.data || jsonb_build_object('id', criterion.id,
          'collectionId', criterion.collection_id, 'sectionId', criterion.section_id,
          'revision', criterion.revision));
  END LOOP;

  FOR section IN
    SELECT * FROM sections WHERE data->>'key' = 'E'
    ORDER BY collection_id, id
  LOOP
    IF EXISTS (SELECT 1 FROM criteria WHERE collection_id = section.collection_id
      AND coalesce(data->>'sourceKey', data->>'key') = 'E10') THEN
      CONTINUE;
    END IF;
    INSERT INTO criteria(id, collection_id, section_id, data)
      VALUES(gen_random_uuid(), section.collection_id, section.id, jsonb_build_object(
        'key', 'E10', 'sourceKey', 'E10', 'section', 'E', 'type', 'select', 'unit', null,
        'labels', '{"en":"Gas provider type","ja":"ガスの種類","vi":"Loại ga provider"}'::jsonb,
        'guidance', '{"en":"Select Toshi (city gas), propane, or other; specify the type when selecting other.","ja":"都市ガス・プロパン・その他から選びます。その他の場合は種類を入力してください。","vi":"Chọn Toshi (ga đô thị), Propane hoặc Other; nhập loại ga khi chọn Other."}'::jsonb,
        'sourceLocale', 'en', 'order', (SELECT coalesce(max((data->>'order')::integer), 0) + 10
          FROM criteria WHERE section_id = section.id),
        'importance', 'information', 'stages', '["V"]'::jsonb,
        'choices', '[{"id":"toshi","labels":{"en":"Toshi (city gas)","ja":"都市ガス","vi":"Toshi (ga đô thị)"}},{"id":"propane","labels":{"en":"Propane","ja":"プロパン","vi":"Propane"}},{"id":"other","labels":{"en":"Other","ja":"その他","vi":"Other (khác)"}}]'::jsonb,
        'supportFields', '[]'::jsonb, 'archived', false, 'scope', 'apartment'
      )) RETURNING * INTO criterion;
    UPDATE collections SET sequence = sequence + 1, checklist_revision = checklist_revision + 1
      WHERE id = section.collection_id RETURNING sequence INTO next_sequence;
    INSERT INTO events(collection_id, sequence, entity, record_id, payload)
      VALUES(criterion.collection_id, next_sequence, 'criteria', criterion.id,
        criterion.data || jsonb_build_object('id', criterion.id,
          'collectionId', criterion.collection_id, 'sectionId', criterion.section_id,
          'revision', criterion.revision));
  END LOOP;
END $$;
