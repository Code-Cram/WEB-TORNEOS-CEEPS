-- Web en inglés: la versión en inglés de los textos del Consejo (información de cada torneo y de cada actividad).
-- Un campo vacío usa el texto por defecto en inglés o, si no lo hay, el español. Se puede ejecutar más de una vez.
ALTER TABLE "info_torneos" ADD COLUMN IF NOT EXISTS "en" jsonb DEFAULT '{}'::jsonb NOT NULL;
ALTER TABLE "actividades" ADD COLUMN IF NOT EXISTS "en" jsonb DEFAULT '{}'::jsonb NOT NULL;
