-- Póker: cuántos de cada mesa clasificatoria pasan a la mesa final (1, el ganador; 2, también el segundo).
-- Se puede ejecutar más de una vez sin problema.
ALTER TABLE "info_torneos" ADD COLUMN IF NOT EXISTS "clasifican_por_mesa" integer DEFAULT 1 NOT NULL;

-- En esta edición (Marc, 12/11) vinieron 32 jugadores y se jugaron 4 mesas: a la mesa final del viernes 13 pasan los dos
-- primeros de cada una. Los textos de la ficha que decían «8 mesas» y «el ganador de cada mesa» se ponen al día si
-- siguen siendo los de siempre (lo que el Consejo haya cambiado a mano no se toca).
-- Solo en la base de los Torneos CEEPS (con jugadores de póker): en una base nueva no hace nada.
DO $$
DECLARE
  formato_viejo CONSTANT text := E'8 mesas clasificatorias de 8 jugadores, repartidas entre el martes 10 y el jueves 12 según la disponibilidad de cada uno.\nEl ganador de cada mesa pasa a la mesa final del viernes 13.\nSin crupier en las clasificatorias (el reparto rota entre jugadores); la mesa final tiene crupier del Consejo.\n64 plazas por orden de inscripción; el resto queda en lista de reserva para cubrir bajas.';
  formato_nuevo CONSTANT text := E'Fase clasificatoria (martes 10 y jueves 12): se han jugado 4 mesas, con 32 jugadores.\nLos dos primeros de cada mesa pasan a la mesa final del viernes 13 (8 jugadores).\nSin crupier en las clasificatorias (el reparto rota entre jugadores); la mesa final tiene crupier del Consejo.';
  regla_vieja CONSTANT text := 'Tu mesa: no hay crupier, reparte quien tiene el botón. Gana la mesa quien se queda con todas las fichas y pasa a la mesa final del viernes 13.';
  regla_nueva CONSTANT text := 'Tu mesa: no hay crupier, reparte quien tiene el botón. Los dos últimos que quedan con fichas pasan a la mesa final del viernes 13.';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "poker"."jugadores") THEN
    RETURN;
  END IF;

  INSERT INTO "info_torneos" ("torneo", "cierre_inscripcion") VALUES ('poker', '2026-11-01 22:59:00+00') ON CONFLICT ("torneo") DO NOTHING;
  UPDATE "info_torneos" SET "clasifican_por_mesa" = 2 WHERE "torneo" = 'poker';

  UPDATE "info_torneos" SET "lema" = '4 mesas clasificatorias · mesa final de 8'
  WHERE "torneo" = 'poker' AND "lema" = '8 mesas clasificatorias · mesa final de 8';
  UPDATE "info_torneos" SET "formato" = formato_nuevo
  WHERE "torneo" = 'poker' AND trim(replace("formato", E'\r', '')) = formato_viejo;
  UPDATE "info_torneos" SET "reglas" = replace("reglas", regla_vieja, regla_nueva)
  WHERE "torneo" = 'poker' AND position(regla_vieja IN coalesce("reglas", '')) > 0;

  INSERT INTO "registro" ("email", "accion")
  SELECT 'consejo.estudiantes.eps@uam.es', 'Póker: a la mesa final pasan los dos primeros de cada mesa (se jugaron 4 mesas) · desde la terminal'
  WHERE NOT EXISTS (SELECT 1 FROM "registro" WHERE "accion" LIKE 'Póker: a la mesa final pasan los dos primeros de cada mesa%');
END $$;
