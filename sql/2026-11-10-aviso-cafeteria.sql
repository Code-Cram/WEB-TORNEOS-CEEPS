-- Aviso del cambio a la cafetería (mus y póker), pedido por Marc el 10/11 «todo lo posible»:
--  · aviso destacado arriba de la página de cada torneo (en español y en inglés), detrás del que ya hubiera;
--  · mensaje del Consejo «para todos» en el chat de cada torneo (en los dos idiomas);
--  · y su apunte en el registro del panel.
-- Se puede ejecutar más de una vez sin problema: no repite el aviso ni los mensajes.

-- Si un torneo nunca se ha guardado desde el panel, su fila se crea con lo de por defecto (el cierre de inscripción, el de config.ts).
INSERT INTO "info_torneos" ("torneo", "cierre_inscripcion")
VALUES ('mus', '2026-11-01 22:59:00+00'), ('poker', '2026-11-01 22:59:00+00')
ON CONFLICT ("torneo") DO NOTHING;

UPDATE "info_torneos"
SET "aviso" = CASE
      WHEN coalesce(trim("aviso"), '') = '' THEN '📍 Nuevo lugar: todas las partidas son a las 16:00 en la cafetería de la EPS (zona de microondas), no en el comedor.'
      ELSE "aviso" || E'\n' || '📍 Nuevo lugar: todas las partidas son a las 16:00 en la cafetería de la EPS (zona de microondas), no en el comedor.'
    END,
    "en" = jsonb_set(coalesce("en", '{}'::jsonb), '{aviso}', to_jsonb(CASE
      WHEN coalesce(trim("en"->>'aviso'), '') <> '' THEN ("en"->>'aviso') || E'\n' || '📍 New place: all games are at 16:00 in the EPS cafeteria (microwave area), not in the dining hall.'
      WHEN coalesce(trim("aviso"), '') <> '' THEN "aviso" || E'\n' || '📍 New place: all games are at 16:00 in the EPS cafeteria (microwave area), not in the dining hall.'
      ELSE '📍 New place: all games are at 16:00 in the EPS cafeteria (microwave area), not in the dining hall.'
    END))
WHERE "torneo" IN ('mus', 'poker') AND coalesce("aviso", '') NOT LIKE '%Nuevo lugar: todas las partidas son a las 16:00 en la cafetería de la EPS%';

INSERT INTO "mensajes" ("torneo", "actividad_id", "dia", "privado_con", "email", "nombre", "de_consejo", "texto")
SELECT t.torneo, NULL, NULL, NULL, 'consejo.estudiantes.eps@uam.es', 'Consejo', true, t.texto
FROM (VALUES
  ('mus', E'📍 Cambio de lugar: todas las partidas del mus son a las 16:00 en la cafetería de la EPS (zona de microondas), no en el comedor. Lo tenéis también en la página del torneo y en vuestra tarjeta de asistencia.\n🇬🇧 Change of place: all mus games are at 16:00 in the EPS cafeteria (microwave area), not in the dining hall.'),
  ('poker', E'📍 Cambio de lugar: todas las mesas del póker son a las 16:00 en la cafetería de la EPS (zona de microondas), no en el comedor. Lo tenéis también en la página del torneo y en vuestra tarjeta de asistencia.\n🇬🇧 Change of place: all poker tables are at 16:00 in the EPS cafeteria (microwave area), not in the dining hall.')
) AS t(torneo, texto)
WHERE NOT EXISTS (SELECT 1 FROM "mensajes" m WHERE m."torneo" = t.torneo AND m."texto" = t.texto);

INSERT INTO "registro" ("email", "accion")
SELECT 'consejo.estudiantes.eps@uam.es', 'Mus y póker: a las 16:00 en la cafetería de la EPS (zona de microondas) en la ficha y en cada mesa y cruce, con aviso destacado y aviso para todos en el chat · desde la terminal'
WHERE NOT EXISTS (SELECT 1 FROM "registro" WHERE "accion" LIKE 'Mus y póker: a las 16:00 en la cafetería de la EPS%');
