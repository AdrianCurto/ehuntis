-- Tabla principal de usuarios para EHUntis
CREATE TABLE IF NOT EXISTS public.users (
  username TEXT PRIMARY KEY,
  configs JSONB NOT NULL DEFAULT '[]'::jsonb,
  active_config_id TEXT,
  custom_events JSONB NOT NULL DEFAULT '[]'::jsonb,
  custom_categories JSONB NOT NULL DEFAULT '[]'::jsonb,
  lesson_overrides JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Migración segura para bases de datos existentes
ALTER TABLE public.users 
  ADD COLUMN IF NOT EXISTS custom_events JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS custom_categories JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS lesson_overrides JSONB NOT NULL DEFAULT '{}'::jsonb;

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

-- Tabla de feedback, preguntas y reporte de bugs
CREATE TABLE IF NOT EXISTS public.feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('bug', 'suggestion', 'question')),
  message TEXT NOT NULL CHECK (char_length(message) BETWEEN 10 AND 2000),
  contact TEXT CHECK (contact IS NULL OR char_length(contact) <= 200),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'resolved', 'ignored')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Indices para rate limiting por IP y revision por estado
CREATE INDEX IF NOT EXISTS idx_feedback_ip_hash_created_at
  ON public.feedback (ip_hash, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_feedback_status_created_at
  ON public.feedback (status, created_at DESC);

-- Row Level Security: habilitado SIN politicas publicas.
-- Nadie puede leer ni escribir directamente con la anon key;
-- solo el servidor mediante SUPABASE_SERVICE_ROLE_KEY puede operar sobre esta tabla.
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

