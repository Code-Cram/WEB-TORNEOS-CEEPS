-- Fecha y hora de los eventos, para que sus participantes confirmen si vienen (Torneos CEEPS). Se puede ejecutar más de una vez sin problema.
ALTER TABLE "actividades" ADD COLUMN IF NOT EXISTS "fecha" timestamp with time zone;
