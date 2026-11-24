-- Ajustes que antes estaban en el código y ahora se cambian desde el panel. Sin valor (null), lo de siempre.
--  · Fútbol (Calendario): horario de la pista (de 8 a 18) y día objetivo para cuartos y semifinales (30/11).
--  · Fútbol y mus (Información del torneo): si el sorteo crea el partido por el 3er y 4º puesto.
--  · Póker (Información del torneo): número de mesas y de asientos por mesa (8 × 8).
-- Se puede ejecutar más de una vez.
ALTER TABLE "info_torneos" ADD COLUMN IF NOT EXISTS "reservas_hora_desde" integer;
ALTER TABLE "info_torneos" ADD COLUMN IF NOT EXISTS "reservas_hora_hasta" integer;
ALTER TABLE "info_torneos" ADD COLUMN IF NOT EXISTS "reservas_objetivo" date;
ALTER TABLE "info_torneos" ADD COLUMN IF NOT EXISTS "tercer_puesto" boolean;
ALTER TABLE "info_torneos" ADD COLUMN IF NOT EXISTS "mesas" integer;
ALTER TABLE "info_torneos" ADD COLUMN IF NOT EXISTS "asientos" integer;
