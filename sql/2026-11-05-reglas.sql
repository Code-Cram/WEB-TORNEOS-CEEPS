-- Chuleta de reglas de cada torneo, editable desde el panel (Torneos CEEPS).
-- Ejecutar ANTES de subir el código nuevo. Se puede ejecutar más de una vez sin problema.
ALTER TABLE "info_torneos" ADD COLUMN IF NOT EXISTS "reglas" text;
