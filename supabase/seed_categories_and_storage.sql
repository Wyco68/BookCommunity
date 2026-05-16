DO $$
DECLARE
  v_creator_id uuid;
BEGIN
  SELECT id INTO v_creator_id FROM auth.users LIMIT 1;
  
  IF v_creator_id IS NOT NULL THEN
    INSERT INTO categories (name, description, visibility, creator_id) VALUES
      ('Action', null, 'public', v_creator_id),
      ('Drama', null, 'public', v_creator_id),
      ('Comedy', null, 'public', v_creator_id),
      ('Romance', null, 'public', v_creator_id),
      ('Knowledge', null, 'public', v_creator_id)
    ON CONFLICT (name) DO NOTHING;
  END IF;
END $$;

INSERT INTO storage.buckets (id, name, public)
VALUES ('session-media', 'session-media', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
CREATE POLICY "Allow authenticated uploads"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'session-media');

DROP POLICY IF EXISTS "Allow authenticated reads" ON storage.objects;
CREATE POLICY "Allow authenticated reads"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'session-media');
