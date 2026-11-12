-- Corrección (Marc, 10/11): el mus y el póker se juegan en el COMEDOR de la EPS (zona de microondas), a las 16:00.
-- Lo de la cafetería fue un error. Vuelve el comedor a la ficha y a cada mesa y cruce; la información dice «Todas las
-- partidas, a las 16:00 (4 de la tarde) en el comedor…»; el aviso destacado pasa a ser la corrección; en el chat se
-- borran los mensajes de la cafetería y se avisa para todos; y queda en el registro.
-- Solo en la base de los Torneos CEEPS (con parejas o jugadores): en una base nueva no hace nada.
-- Se puede ejecutar más de una vez sin problema.
DO $$
DECLARE
  comedor CONSTANT text := 'Comedor de la EPS (zona de microondas)';
  linea CONSTANT text := 'Todas las partidas, a las 16:00 (4 de la tarde) en el comedor de la EPS (zona de microondas).';
  linea_en CONSTANT text := 'All games at 16:00 (4 pm) in the EPS dining hall (microwave area).';
  aviso_cafeteria CONSTANT text := '📍 Nuevo lugar: todas las partidas son a las 16:00 en la cafetería de la EPS (zona de microondas), no en el comedor.';
  aviso_cafeteria_en CONSTANT text := '📍 New place: all games are at 16:00 in the EPS cafeteria (microwave area), not in the dining hall.';
  correccion CONSTANT text := '📍 Corrección: todas las partidas son a las 16:00 en el comedor de la EPS (zona de microondas), como siempre. Lo de la cafetería fue un error.';
  correccion_en CONSTANT text := '📍 Correction: all games are at 16:00 in the EPS dining hall (microwave area), as before. The cafeteria notice was a mistake.';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "mus"."parejas") AND NOT EXISTS (SELECT 1 FROM "poker"."jugadores") THEN
    RETURN;
  END IF;

  -- El lugar: en la ficha de cada torneo y en cada mesa y cruce (los pases directos no se juegan: sin lugar).
  UPDATE "info_torneos" SET "lugar" = comedor WHERE "torneo" IN ('mus', 'poker');
  UPDATE "poker"."mesas" SET "lugar" = comedor;
  UPDATE "mus"."partidos" SET "lugar" = comedor WHERE NOT ("ronda" = 1 AND ("pareja_a_id" IS NULL) <> ("pareja_b_id" IS NULL));

  -- «Todas las partidas, a las 16:00…» al principio del calendario de la ficha. Si nunca se ha guardado, ya lo trae el
  -- calendario por defecto (config.ts); en inglés, igual con su versión en inglés si el Consejo la ha escrito.
  UPDATE "info_torneos" SET "calendario" = linea || E'\n' || "calendario"
  WHERE "torneo" IN ('mus', 'poker') AND "calendario" IS NOT NULL AND position(linea IN "calendario") = 0;
  UPDATE "info_torneos" SET "en" = jsonb_set("en", '{calendario}', to_jsonb(linea_en || E'\n' || ("en"->>'calendario')))
  WHERE "torneo" IN ('mus', 'poker') AND coalesce(trim("en"->>'calendario'), '') <> '' AND position(linea_en IN "en"->>'calendario') = 0;

  -- El aviso destacado: la línea de la cafetería pasa a ser la corrección (en los dos idiomas).
  UPDATE "info_torneos" SET "aviso" = replace("aviso", aviso_cafeteria, correccion)
  WHERE "torneo" IN ('mus', 'poker') AND position(aviso_cafeteria IN coalesce("aviso", '')) > 0;
  UPDATE "info_torneos" SET "en" = jsonb_set("en", '{aviso}', to_jsonb(replace("en"->>'aviso', aviso_cafeteria_en, correccion_en)))
  WHERE "torneo" IN ('mus', 'poker') AND position(aviso_cafeteria_en IN coalesce("en"->>'aviso', '')) > 0;

  -- Chat: los mensajes de la cafetería quedan como «Mensaje borrado» y sale la corrección para todos.
  UPDATE "mensajes" SET "borrado_en" = now()
  WHERE "de_consejo" AND "borrado_en" IS NULL AND "texto" LIKE '📍 Cambio de lugar:%cafetería de la EPS%';
  INSERT INTO "mensajes" ("torneo", "actividad_id", "dia", "privado_con", "email", "nombre", "de_consejo", "texto")
  SELECT t.torneo, NULL, NULL, NULL, 'consejo.estudiantes.eps@uam.es', 'Consejo', true, t.texto
  FROM (VALUES
    ('mus', E'📍 Corrección: las partidas del mus son a las 16:00 en el comedor de la EPS (zona de microondas), como siempre, no en la cafetería. Perdonad el aviso anterior.\n🇬🇧 Correction: mus games are at 16:00 in the EPS dining hall (microwave area), as before, not in the cafeteria. Sorry for the previous notice.'),
    ('poker', E'📍 Corrección: las mesas del póker son a las 16:00 en el comedor de la EPS (zona de microondas), como siempre, no en la cafetería. Perdonad el aviso anterior.\n🇬🇧 Correction: poker tables are at 16:00 in the EPS dining hall (microwave area), as before, not in the cafeteria. Sorry for the previous notice.')
  ) AS t(torneo, texto)
  WHERE NOT EXISTS (SELECT 1 FROM "mensajes" m WHERE m."torneo" = t.torneo AND m."texto" = t.texto);

  INSERT INTO "registro" ("email", "accion")
  SELECT 'consejo.estudiantes.eps@uam.es', 'Corrección: mus y póker a las 16:00 en el comedor de la EPS (zona de microondas), no en la cafetería: ficha, mesas, cruces, información, aviso destacado y chat · desde la terminal'
  WHERE NOT EXISTS (SELECT 1 FROM "registro" WHERE "accion" LIKE 'Corrección: mus y póker a las 16:00 en el comedor%');
END $$;
