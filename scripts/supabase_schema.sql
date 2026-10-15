-- Tabla principal de usuarios para EHUntis
CREATE TABLE IF NOT EXISTS public.users (
  username TEXT PRIMARY KEY,
  configs JSONB NOT NULL DEFAULT '[]'::jsonb,
  active_config_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Índices de consulta rápida
CREATE INDEX IF NOT EXISTS idx_users_updated_at ON public.users(updated_at);

-- Configuración de Row Level Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'users' AND policyname = 'Lectura publica por username'
  ) THEN
    CREATE POLICY "Lectura publica por username" ON public.users FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'users' AND policyname = 'Insercion publica por username'
  ) THEN
    CREATE POLICY "Insercion publica por username" ON public.users FOR INSERT WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'users' AND policyname = 'Actualizacion publica por username'
  ) THEN
    CREATE POLICY "Actualizacion publica por username" ON public.users FOR UPDATE USING (true) WITH CHECK (true);
  END IF;
END $$;
