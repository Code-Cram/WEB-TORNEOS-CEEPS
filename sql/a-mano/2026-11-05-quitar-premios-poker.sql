-- Los premios del póker pasan a info_torneos.premios (Torneos CEEPS).
-- Ejecutar DESPUÉS de desplegar el código nuevo: la versión anterior todavía lee poker.premios.
-- Si había premios guardados, se copian antes de borrar la tabla. Se puede ejecutar más de una vez sin problema.
DO $$
BEGIN
  IF to_regclass('poker.premios') IS NOT NULL THEN
    INSERT INTO "info_torneos" ("torneo", "premios")
    SELECT 'poker', string_agg("puesto" || 'º ' || "descripcion", E'\n' ORDER BY "puesto") FROM "poker"."premios" HAVING count(*) > 0
    ON CONFLICT ("torneo") DO UPDATE SET "premios" = EXCLUDED."premios";
    DROP TABLE "poker"."premios";
  END IF;
END $$;
