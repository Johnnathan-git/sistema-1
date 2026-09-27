CREATE TABLE public.app_state (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_state TO anon, authenticated;
GRANT ALL ON public.app_state TO service_role;
ALTER TABLE public.app_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "app_state read" ON public.app_state FOR SELECT TO anon, authenticated USING (key LIKE 'uos-%');
CREATE POLICY "app_state insert" ON public.app_state FOR INSERT TO anon, authenticated WITH CHECK (key LIKE 'uos-%');
CREATE POLICY "app_state update" ON public.app_state FOR UPDATE TO anon, authenticated USING (key LIKE 'uos-%') WITH CHECK (key LIKE 'uos-%');
CREATE POLICY "app_state delete" ON public.app_state FOR DELETE TO anon, authenticated USING (key LIKE 'uos-%');
ALTER PUBLICATION supabase_realtime ADD TABLE public.app_state;