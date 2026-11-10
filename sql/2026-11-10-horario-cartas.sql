-- Mus y póker se juegan a las 16:00 de los días del calendario (Torneos CEEPS).
-- Solo rellena lo que está vacío: no toca las fechas ni los textos que ya se hayan cambiado desde el panel.
-- Se puede ejecutar más de una vez sin problema.

-- Póker: cada mesa, el día de su turno; la mesa final, el viernes 13.
UPDATE "poker"."mesas"
SET "fecha" = (CASE
    WHEN "fase" = 'final' OR "turno" = 'Viernes 13 nov' THEN '2026-11-13 16:00'
    WHEN "turno" = 'Martes 10 nov' THEN '2026-11-10 16:00'
    WHEN "turno" = 'Jueves 12 nov' THEN '2026-11-12 16:00'
  END)::timestamp AT TIME ZONE 'Europe/Madrid'
WHERE "fecha" IS NULL AND ("fase" = 'final' OR "turno" IN ('Martes 10 nov', 'Jueves 12 nov', 'Viernes 13 nov'));

-- Mus: cada mitad del cuadro, hasta su semifinal, un día; la final y el 3er puesto, el viernes 20 (como «Fechas por bloques»).
-- Los pases directos no se juegan: no llevan fecha.
UPDATE "mus"."partidos" AS p
SET "fecha" = (CASE
    WHEN p."ronda" = 0 OR p."ronda" = t.total THEN '2026-11-20 16:00'
    WHEN p."posicion" < power(2, t.total - p."ronda") / 2 THEN '2026-11-17 16:00'
    ELSE '2026-11-18 16:00'
  END)::timestamp AT TIME ZONE 'Europe/Madrid'
FROM (SELECT max("ronda") AS total FROM "mus"."partidos") AS t
WHERE p."fecha" IS NULL
  AND t.total >= 2
  AND NOT (p."ronda" = 1 AND (p."pareja_a_id" IS NULL) <> (p."pareja_b_id" IS NULL));

-- La hora también en el calendario de cada torneo, si sigue siendo el texto de siempre (con o sin saltos de línea de Windows).
UPDATE "info_torneos"
SET "calendario" = E'Martes 10 nov, 16:00 · fase clasificatoria, 1.er turno\nJueves 12 nov, 16:00 · fase clasificatoria, 2.º turno\nViernes 13 nov, 16:00 · mesa final'
WHERE "torneo" = 'poker'
  AND replace("calendario", E'\r', '') = E'Martes 10 nov · fase clasificatoria, 1.er turno\nJueves 12 nov · fase clasificatoria, 2.º turno\nViernes 13 nov · mesa final';

UPDATE "info_torneos"
SET "calendario" = E'Martes 17 nov, 16:00 · mitad izquierda del cuadro, hasta su semifinal\nMiércoles 18 nov, 16:00 · mitad derecha del cuadro, hasta su semifinal\nViernes 20 nov, 16:00 · final y partido por el 3er y 4º puesto'
WHERE "torneo" = 'mus'
  AND replace("calendario", E'\r', '') = E'Martes 17 nov · mitad izquierda del cuadro, hasta su semifinal\nMiércoles 18 nov · mitad derecha del cuadro, hasta su semifinal\nViernes 20 nov · final y partido por el 3er y 4º puesto';
