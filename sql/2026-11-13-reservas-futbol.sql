-- Fútbol: reservas de pista que proponen los capitanes (Marc, 12/11). Huecos de una hora, de lunes a viernes de 9:00 a
-- 21:00, hasta el 18 de diciembre; un capitán propone y el rival acepta o rechaza; cada partido tiene un horario
-- orientativo que propone el Consejo. Se puede ejecutar más de una vez sin problema.

CREATE TABLE IF NOT EXISTS "futbol"."propuestas" (
	"id" serial PRIMARY KEY NOT NULL,
	"partido_id" integer NOT NULL,
	"equipo_id" integer NOT NULL,
	"fecha" timestamp with time zone NOT NULL,
	"estado" text DEFAULT 'pendiente' NOT NULL,
	"propuesto_por" text NOT NULL,
	"respondido_por" text,
	"respondido_en" timestamp with time zone,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE "futbol"."propuestas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "futbol"."propuestas" DROP CONSTRAINT IF EXISTS "propuestas_partido_id_partidos_id_fk";
ALTER TABLE "futbol"."propuestas" ADD CONSTRAINT "propuestas_partido_id_partidos_id_fk" FOREIGN KEY ("partido_id") REFERENCES "futbol"."partidos"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "futbol"."propuestas" DROP CONSTRAINT IF EXISTS "propuestas_equipo_id_equipos_id_fk";
ALTER TABLE "futbol"."propuestas" ADD CONSTRAINT "propuestas_equipo_id_equipos_id_fk" FOREIGN KEY ("equipo_id") REFERENCES "futbol"."equipos"("id") ON DELETE cascade ON UPDATE no action;
CREATE INDEX IF NOT EXISTS "propuestas_partido_idx" ON "futbol"."propuestas" USING btree ("partido_id", "estado");

ALTER TABLE "futbol"."partidos" ADD COLUMN IF NOT EXISTS "fecha_orientativa" timestamp with time zone;
ALTER TABLE "info_torneos" ADD COLUMN IF NOT EXISTS "reservas_hasta" date;
ALTER TABLE "info_torneos" ADD COLUMN IF NOT EXISTS "reservas_cerradas" text;

-- Lo de esta edición. Solo en la base de los Torneos CEEPS (con equipos): en una base nueva no hace nada.
DO $$
DECLARE
  texto_aviso CONSTANT text := '📅 Ya podéis reservar la pista: el calendario está debajo de la clasificación. El capitán propone un hueco de una hora (de lunes a viernes, de 9:00 a 21:00, hasta el 18 de diciembre) y el capitán rival lo acepta o lo rechaza. Cada partido tiene un horario orientativo.';
  texto_aviso_en CONSTANT text := '📅 You can now book the pitch: the calendar is below the standings. The captain proposes a one-hour slot (Monday to Friday, 9:00–21:00, until 18 December) and the other captain accepts or rejects it. Each match has a suggested time.';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "futbol"."equipos") THEN
    RETURN;
  END IF;

  -- Ajustes: hasta el viernes 18 de diciembre, con el 8 de diciembre (festivo) cerrado.
  INSERT INTO "info_torneos" ("torneo", "cierre_inscripcion") VALUES ('futbol', '2026-11-01 22:59:00+00') ON CONFLICT ("torneo") DO NOTHING;
  UPDATE "info_torneos" SET "reservas_hasta" = '2026-12-18' WHERE "torneo" = 'futbol' AND "reservas_hasta" IS NULL;
  UPDATE "info_torneos" SET "reservas_cerradas" = '2026-12-08 Inmaculada Concepción (festivo)' WHERE "torneo" = 'futbol' AND "reservas_cerradas" IS NULL;
  -- En la ficha, cómo se fija la fecha de cada partido (si el Consejo no había escrito ningún calendario).
  UPDATE "info_torneos" SET "calendario" = 'Cada partido, el día y la hora que reserven los capitanes en el calendario de reservas (debajo de la clasificación): de lunes a viernes, de 9:00 a 21:00, hasta el 18 de diciembre.' WHERE "torneo" = 'futbol' AND coalesce(trim("calendario"), '') = '';

  -- Ya reservado (Marc): jueves 19 de noviembre a las 11:00, La fuerza del amor contra CSV Eindhoven.
  UPDATE "futbol"."partidos" p
  SET "fecha" = '2026-11-19 11:00'::timestamp AT TIME ZONE 'Europe/Madrid'
  FROM "futbol"."equipos" l, "futbol"."equipos" v
  WHERE l."id" = p."local_id" AND v."id" = p."visitante_id" AND p."fecha" IS NULL AND p."ganador_id" IS NULL
    AND ARRAY[lower(trim(l."nombre")), lower(trim(v."nombre"))] @> ARRAY['la fuerza del amor', 'csv eindhoven'];

  -- Horario orientativo (cuadro de 16: octavos, cuartos, semifinales y final), dos partidos por día, sin las tardes del
  -- mus (17, 18 y 20) y según lo que cada equipo prefería en la inscripción (mañana o tarde). Termina el 1 de diciembre:
  -- queda margen hasta el 18 para lo que haya que cambiar.
  IF (SELECT max("ronda") FROM "futbol"."partidos") = 4 THEN
    UPDATE "futbol"."partidos" p
    SET "fecha_orientativa" = h.cuando::timestamp AT TIME ZONE 'Europe/Madrid'
    FROM (VALUES
      (1, 7, '2026-11-18 10:00'), (1, 1, '2026-11-18 12:00'), (1, 3, '2026-11-19 11:00'), (1, 5, '2026-11-19 17:00'),
      (2, 0, '2026-11-23 12:00'), (2, 3, '2026-11-23 13:00'), (2, 1, '2026-11-24 17:00'), (2, 2, '2026-11-24 18:00'),
      (3, 0, '2026-11-26 13:00'), (3, 1, '2026-11-26 17:00'),
      (4, 0, '2026-12-01 17:00')
    ) AS h(ronda, posicion, cuando)
    WHERE p."ronda" = h.ronda AND p."posicion" = h.posicion AND p."fecha_orientativa" IS NULL
      AND NOT (p."ronda" = 1 AND (p."local_id" IS NULL) <> (p."visitante_id" IS NULL));
  END IF;

  -- Aviso destacado (detrás del que ya hubiera) y mensaje para todos en el chat, en español y en inglés.
  UPDATE "info_torneos"
  SET "aviso" = CASE WHEN coalesce(trim("aviso"), '') = '' THEN texto_aviso ELSE "aviso" || E'\n' || texto_aviso END,
      "en" = jsonb_set(coalesce("en", '{}'::jsonb), '{aviso}', to_jsonb(CASE
        WHEN coalesce(trim("en"->>'aviso'), '') <> '' THEN ("en"->>'aviso') || E'\n' || texto_aviso_en
        WHEN coalesce(trim("aviso"), '') <> '' THEN "aviso" || E'\n' || texto_aviso_en
        ELSE texto_aviso_en
      END))
  WHERE "torneo" = 'futbol' AND position(texto_aviso IN coalesce("aviso", '')) = 0;

  INSERT INTO "mensajes" ("torneo", "actividad_id", "dia", "privado_con", "email", "nombre", "de_consejo", "texto")
  SELECT 'futbol', NULL, NULL, NULL, 'consejo.estudiantes.eps@uam.es', 'Consejo', true, t.texto
  FROM (VALUES (E'📅 Ya podéis reservar la pista. En la página del torneo, debajo de la clasificación, está el calendario: el capitán propone un hueco de una hora para su partido (de lunes a viernes, de 9:00 a 21:00, hasta el 18 de diciembre) y el capitán rival lo acepta o lo rechaza. Cada partido tiene un horario orientativo, que se puede proponer con un toque.\n🇬🇧 You can now book the pitch: the calendar is below the standings. The captain proposes a one-hour slot and the other captain accepts or rejects it. Each match has a suggested time.')) AS t(texto)
  WHERE NOT EXISTS (SELECT 1 FROM "mensajes" m WHERE m."torneo" = 'futbol' AND m."texto" = t.texto);

  INSERT INTO "registro" ("email", "accion")
  SELECT 'consejo.estudiantes.eps@uam.es', 'Fútbol: reservas de pista por los capitanes, horario orientativo y partido del 19/11 a las 11:00 (La fuerza del amor – CSV Eindhoven) · desde la terminal'
  WHERE NOT EXISTS (SELECT 1 FROM "registro" WHERE "accion" LIKE 'Fútbol: reservas de pista por los capitanes%');
END $$;
