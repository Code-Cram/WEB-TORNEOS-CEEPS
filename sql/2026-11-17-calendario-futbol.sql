-- Fútbol: calendario (Marc, 17/11; horas de Deportes, 23/11). Se juega del lunes 23 de noviembre al viernes 4 de
-- diciembre, de lunes a viernes de 8:00 a 18:00, solo en los huecos que da Deportes (su Excel del 23/11), en huecos de una
-- hora. El capitán de cada equipo marca las mañanas y tardes (o las horas) que le vienen bien y la fecha prevista de cada
-- partido sale sola de lo que marcan los dos; luego un capitán la confirma (o propone otra hora) y el rival la acepta.
-- Además, en el fútbol y en el mus se puede poner a mano a cualquiera en cualquier cruce (también en la final). Se puede
-- ejecutar más de una vez sin problema.

-- Propuestas de horario de los capitanes.
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

-- Lo que marca cada capitán: huecos de una hora que le vienen bien a su equipo.
CREATE TABLE IF NOT EXISTS "futbol"."disponibilidad" (
	"equipo_id" integer NOT NULL,
	"dia" date NOT NULL,
	"hora" integer NOT NULL,
	"marcado_por" text NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "disponibilidad_equipo_id_dia_hora_pk" PRIMARY KEY("equipo_id","dia","hora")
);
ALTER TABLE "futbol"."disponibilidad" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "futbol"."disponibilidad" DROP CONSTRAINT IF EXISTS "disponibilidad_equipo_id_equipos_id_fk";
ALTER TABLE "futbol"."disponibilidad" ADD CONSTRAINT "disponibilidad_equipo_id_equipos_id_fk" FOREIGN KEY ("equipo_id") REFERENCES "futbol"."equipos"("id") ON DELETE cascade ON UPDATE no action;

-- Fecha prevista de cada partido y lados de los cruces puestos a mano.
ALTER TABLE "futbol"."partidos" ADD COLUMN IF NOT EXISTS "fecha_prevista" timestamp with time zone;
ALTER TABLE "futbol"."partidos" ADD COLUMN IF NOT EXISTS "local_fijo" boolean DEFAULT false NOT NULL;
ALTER TABLE "futbol"."partidos" ADD COLUMN IF NOT EXISTS "visitante_fijo" boolean DEFAULT false NOT NULL;
ALTER TABLE "mus"."partidos" ADD COLUMN IF NOT EXISTS "pareja_a_fija" boolean DEFAULT false NOT NULL;
ALTER TABLE "mus"."partidos" ADD COLUMN IF NOT EXISTS "pareja_b_fija" boolean DEFAULT false NOT NULL;

-- Ajustes del calendario (Panel → Fútbol).
ALTER TABLE "info_torneos" ADD COLUMN IF NOT EXISTS "reservas_desde" date;
ALTER TABLE "info_torneos" ADD COLUMN IF NOT EXISTS "reservas_hasta" date;
ALTER TABLE "info_torneos" ADD COLUMN IF NOT EXISTS "reservas_cerradas" text;
ALTER TABLE "info_torneos" ADD COLUMN IF NOT EXISTS "reservas_abiertas" text;

-- Lo de esta edición. Solo en la base de los Torneos CEEPS (con equipos): en una base nueva no hace nada.
DO $$
DECLARE
  texto_aviso CONSTANT text := '📅 Calendario: se juega hasta el viernes 4 de diciembre, de lunes a viernes de 8:00 a 18:00, en los huecos que da Deportes. Capitanes, marcad en el calendario (debajo de la clasificación) las mañanas y tardes que os vienen bien, o una hora concreta: la fecha prevista de cada partido sale sola de lo que marquéis los dos equipos. Después, un capitán la confirma y el otro la acepta. La idea: cuartos antes de que acabe noviembre y la final, como muy tarde, el viernes 4 de diciembre.';
  texto_aviso_en CONSTANT text := '📅 Calendar: matches are played until Friday 4 December, Monday to Friday 8:00–18:00, in the slots given by the Sports Service. Captains, mark in the calendar (below the standings) the mornings and afternoons that suit you, or a specific time: each match''s planned date comes from what both teams mark. Then one captain confirms it and the other accepts it. The plan: quarter-finals before the end of November and the final on Friday 4 December at the latest.';
  -- Los huecos que da Deportes (Excel del 23/11, de lunes a viernes; en blanco, libre). Desde las 18:00, todo ocupado.
  huecos_deportes CONSTANT text := E'2026-11-23 8-18\n2026-11-24 8-12\n2026-11-24 17-18\n2026-11-25 8-17\n2026-11-26 8-13\n2026-11-27 8-11\n2026-11-27 14-18\n2026-11-30 8-13\n2026-11-30 14-18\n2026-12-01 8-12\n2026-12-01 14-18\n2026-12-02 8-17\n2026-12-03 8-14\n2026-12-04 8-11\n2026-12-04 14-18';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "futbol"."equipos") THEN
    RETURN;
  END IF;

  -- Del lunes 23 de noviembre al viernes 4 de diciembre, solo en los huecos de Deportes (el 8 de diciembre, festivo,
  -- queda cerrado por si se alarga).
  INSERT INTO "info_torneos" ("torneo", "cierre_inscripcion") VALUES ('futbol', '2026-11-01 22:59:00+00') ON CONFLICT ("torneo") DO NOTHING;
  UPDATE "info_torneos" SET "reservas_desde" = '2026-11-23' WHERE "torneo" = 'futbol' AND "reservas_desde" IS NULL;
  UPDATE "info_torneos" SET "reservas_hasta" = '2026-12-04' WHERE "torneo" = 'futbol' AND "reservas_hasta" IS NULL;
  UPDATE "info_torneos" SET "reservas_abiertas" = huecos_deportes WHERE "torneo" = 'futbol' AND coalesce(trim("reservas_abiertas"), '') = '';
  UPDATE "info_torneos" SET "reservas_cerradas" = '2026-12-08 Inmaculada Concepción (festivo)' WHERE "torneo" = 'futbol' AND "reservas_cerradas" IS NULL;
  -- En la ficha, cómo se fija la fecha de cada partido (si el Consejo no había escrito ningún calendario).
  UPDATE "info_torneos" SET "calendario" = 'Hasta el viernes 4 de diciembre, de lunes a viernes de 8:00 a 18:00, en los huecos que da Deportes. Cada partido, en el hueco que confirmen los capitanes en el calendario (debajo de la clasificación). La idea: cuartos antes de que acabe noviembre y la final, como muy tarde, el viernes 4 de diciembre.' WHERE "torneo" = 'futbol' AND coalesce(trim("calendario"), '') = '';

  -- Todo empieza la semana que viene: el partido del jueves 19 a las 11:00 (La fuerza del amor – CSV Eindhoven), si
  -- estaba puesto, se quita y entra en las fechas previstas como los demás.
  UPDATE "futbol"."partidos" p
  SET "fecha" = NULL
  FROM "futbol"."equipos" l, "futbol"."equipos" v
  WHERE l."id" = p."local_id" AND v."id" = p."visitante_id" AND p."ganador_id" IS NULL
    AND p."fecha" = '2026-11-19 11:00'::timestamp AT TIME ZONE 'Europe/Madrid'
    AND ARRAY[lower(trim(l."nombre")), lower(trim(v."nombre"))] @> ARRAY['la fuerza del amor', 'csv eindhoven'];

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
  FROM (VALUES (E'📅 Ya está el calendario del fútbol, debajo de la clasificación. Se juega hasta el viernes 4 de diciembre, de lunes a viernes de 8:00 a 18:00, en los huecos que da Deportes. Capitanes: marcad las mañanas y tardes que os vienen bien (o una hora concreta) y la fecha prevista de vuestro partido sale sola de lo que marquéis los dos equipos; después, uno la confirma y el otro la acepta. La idea: cuartos antes de que acabe noviembre y la final, como muy tarde, el viernes 4 de diciembre.\n🇬🇧 The football calendar is up, below the standings. Matches are played until Friday 4 December, Monday to Friday 8:00–18:00, in the slots given by the Sports Service. Captains: mark the mornings and afternoons that suit you (or a specific time) and your match''s planned date comes from what both teams mark; then one captain confirms it and the other accepts it.')) AS t(texto)
  WHERE NOT EXISTS (SELECT 1 FROM "mensajes" m WHERE m."torneo" = 'futbol' AND m."texto" = t.texto);

  INSERT INTO "registro" ("email", "accion")
  SELECT 'consejo.estudiantes.eps@uam.es', 'Fútbol: calendario desde el 23/11 hasta el 4/12 en los huecos de Deportes (los capitanes marcan cuándo pueden y las fechas previstas salen solas) y cruces a mano en fútbol y mus · desde la terminal'
  WHERE NOT EXISTS (SELECT 1 FROM "registro" WHERE "accion" LIKE 'Fútbol: calendario desde el 23/11%');
END $$;
