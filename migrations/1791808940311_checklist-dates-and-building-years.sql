-- Keep date precision and retain the original imported answer for recovery.
-- Do not turn vacancy or immediate availability into an invented calendar day.
DO $$
DECLARE
  criterion criteria%ROWTYPE;
  answer answers%ROWTYPE;
  original text;
  candidate text;
  dates text[];
  parts text[];
  cleaned_notes text;
  next_sequence bigint;
BEGIN
  FOR criterion IN
    SELECT * FROM criteria
    WHERE coalesce(data->>'sourceKey', data->>'key') = 'A06'
      AND data->>'type' = 'text'
    ORDER BY collection_id, id
  LOOP
    FOR answer IN SELECT * FROM answers WHERE criterion_id = criterion.id ORDER BY id LOOP
      original := btrim(answer.data->>'value');
      candidate := NULL;
      SELECT array_agg(match[1]) INTO dates
        FROM regexp_matches(original, '\m([0-9]{4}-[0-9]{2}(?:-[0-9]{2})?)\M', 'g') AS match;
      IF cardinality(dates) = 1 THEN
        candidate := dates[1];
      ELSIF dates IS NULL THEN
        parts := regexp_match(original,
          '\m(January|February|March|April|May|June|July|August|September|October|November|December)[[:space:]]+([0-9]{4})\M', 'i');
        IF parts IS NOT NULL THEN
          candidate := parts[2] || '-' || lpad(array_position(
            ARRAY['january','february','march','april','may','june','july','august','september','october','november','december'],
            lower(parts[1]))::text, 2, '0');
        END IF;
      END IF;
      BEGIN
        IF candidate IS NOT NULL THEN
          PERFORM (candidate || CASE WHEN length(candidate) = 7 THEN '-01' ELSE '' END)::date;
        END IF;
      EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN
        candidate := NULL;
      END;
      IF answer.data->>'state' IS DISTINCT FROM 'answered' THEN candidate := NULL; END IF;
      UPDATE answers SET data = data || jsonb_build_object(
        'legacyMoveInAnswer', data,
        'value', candidate,
        'state', CASE WHEN data->>'state' = 'not_applicable' THEN 'not_applicable'
          WHEN candidate IS NOT NULL THEN 'answered' ELSE 'not_checked' END,
        'suitability', CASE WHEN candidate IS NULL THEN 'unassessed'
          ELSE coalesce(data->>'suitability', 'unassessed') END
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
      'type', 'date', 'unit', NULL,
      'labels', '{"en":"Move-in date","ja":"入居可能日","vi":"Ngày có thể chuyển vào"}'::jsonb,
      'guidance', '{"en":"Enter the available date, or just the month and year if the day is unknown.","ja":"入居可能な日付を入力します。日が不明な場合は年月のみを入力します。","vi":"Nhập ngày có thể chuyển vào, hoặc chỉ tháng và năm nếu chưa rõ ngày."}'::jsonb
    ), revision = revision + 1 WHERE id = criterion.id RETURNING * INTO criterion;
    UPDATE collections SET sequence = sequence + 1, checklist_revision = checklist_revision + 1
      WHERE id = criterion.collection_id RETURNING sequence INTO next_sequence;
    INSERT INTO events(collection_id, sequence, entity, record_id, payload)
      VALUES(criterion.collection_id, next_sequence, 'criteria', criterion.id,
        criterion.data || jsonb_build_object('id', criterion.id,
          'collectionId', criterion.collection_id, 'sectionId', criterion.section_id,
          'revision', criterion.revision));
  END LOOP;

  FOR answer IN
    SELECT a.* FROM answers a JOIN criteria c ON c.id = a.criterion_id
    WHERE coalesce(c.data->>'sourceKey', c.data->>'key') = 'A05'
      AND a.data->>'notes' ~* '\mBuilt in (January|February|March|April|May|June|July|August|September|October|November|December)\M'
    ORDER BY a.collection_id, a.id
  LOOP
    cleaned_notes := btrim(regexp_replace(answer.data->>'notes',
      '\mBuilt in (January|February|March|April|May|June|July|August|September|October|November|December)\M[.;]?[[:space:]]*', '', 'gi'));
    UPDATE answers SET data = data || jsonb_build_object(
      'legacyBuildingYearAnswer', data, 'notes', cleaned_notes
    ), revision = revision + 1 WHERE id = answer.id RETURNING * INTO answer;
    UPDATE collections SET sequence = sequence + 1
      WHERE id = answer.collection_id RETURNING sequence INTO next_sequence;
    INSERT INTO events(collection_id, sequence, entity, record_id, payload)
      VALUES(answer.collection_id, next_sequence, 'answers', answer.id,
        answer.data || jsonb_build_object('id', answer.id,
          'collectionId', answer.collection_id, 'apartmentId', answer.apartment_id,
          'criterionId', answer.criterion_id, 'scenarioId', answer.scenario_id,
          'revision', answer.revision));
  END LOOP;
END $$;
