-- Premios editables en los tres torneos y acceso de la lista de reserva del póker (Torneos CEEPS).
-- Ejecutar ANTES de subir el código nuevo. Se puede ejecutar más de una vez sin problema.
ALTER TABLE "info_torneos" ADD COLUMN IF NOT EXISTS "premios" text;
ALTER TABLE "info_torneos" ADD COLUMN IF NOT EXISTS "reserva_con_acceso" boolean DEFAULT false NOT NULL;
