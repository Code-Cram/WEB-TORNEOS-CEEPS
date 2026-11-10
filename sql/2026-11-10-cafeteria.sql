-- Mus y póker: todos los días a las 16:00 en la cafetería de la EPS (zona de microondas). Lo pidió Marc el 10/11.
-- Va en la ficha de cada torneo y en cada mesa y cada cruce (antes ponía «Comedor…» y los cruces no llevaban lugar).
-- Se puede ejecutar más de una vez sin problema: siempre deja lo mismo.
UPDATE "info_torneos" SET "lugar" = 'Cafetería de la EPS (zona de microondas)' WHERE "torneo" IN ('mus', 'poker');

UPDATE "poker"."mesas" SET "lugar" = 'Cafetería de la EPS (zona de microondas)';

-- Los pases directos no se juegan: sin lugar.
UPDATE "mus"."partidos"
SET "lugar" = 'Cafetería de la EPS (zona de microondas)'
WHERE NOT ("ronda" = 1 AND ("pareja_a_id" IS NULL) <> ("pareja_b_id" IS NULL));

-- A las 16:00 (hora de Madrid), el mismo día que ya tuvieran.
UPDATE "poker"."mesas"
SET "fecha" = ((("fecha" AT TIME ZONE 'Europe/Madrid')::date + time '16:00') AT TIME ZONE 'Europe/Madrid')
WHERE "fecha" IS NOT NULL AND ("fecha" AT TIME ZONE 'Europe/Madrid')::time <> time '16:00';

UPDATE "mus"."partidos"
SET "fecha" = ((("fecha" AT TIME ZONE 'Europe/Madrid')::date + time '16:00') AT TIME ZONE 'Europe/Madrid')
WHERE "fecha" IS NOT NULL AND ("fecha" AT TIME ZONE 'Europe/Madrid')::time <> time '16:00';
