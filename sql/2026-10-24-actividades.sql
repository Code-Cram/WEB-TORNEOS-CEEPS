-- Tablas de actividades, palmarés y archivo (Torneos CEEPS). Se puede ejecutar más de una vez sin problema.

CREATE TABLE IF NOT EXISTS "actividad_miembros" (
	"participante_id" integer NOT NULL,
	"orden" integer NOT NULL,
	"nombre" text NOT NULL,
	"email" text,
	CONSTRAINT "actividad_miembros_participante_id_orden_pk" PRIMARY KEY("participante_id","orden")
);

CREATE TABLE IF NOT EXISTS "actividad_participantes" (
	"id" serial PRIMARY KEY NOT NULL,
	"actividad_id" integer NOT NULL,
	"nombre" text NOT NULL,
	"nota" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "actividad_partidos" (
	"id" serial PRIMARY KEY NOT NULL,
	"actividad_id" integer NOT NULL,
	"ronda" integer NOT NULL,
	"posicion" integer NOT NULL,
	"a_id" integer,
	"b_id" integer,
	"puntos_a" integer,
	"puntos_b" integer,
	"ganador_id" integer,
	"fecha" timestamp with time zone,
	"lugar" text,
	"notas" text,
	CONSTRAINT "actividad_partidos_actividad_id_ronda_posicion_unique" UNIQUE("actividad_id","ronda","posicion")
);

CREATE TABLE IF NOT EXISTS "actividades" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"nombre" text NOT NULL,
	"icono" text DEFAULT '⭐' NOT NULL,
	"tipo" text DEFAULT 'evento' NOT NULL,
	"por_equipos" boolean DEFAULT false NOT NULL,
	"lema" text,
	"descripcion" text,
	"calendario" text,
	"lugar" text,
	"aviso" text,
	"info_participantes" text,
	"enlace_inscripcion" text,
	"cierre_inscripcion" timestamp with time zone,
	"estado" text DEFAULT 'activa' NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "actividades_slug_unique" UNIQUE("slug")
);

CREATE TABLE IF NOT EXISTS "archivo" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"tipo" text NOT NULL,
	"datos" jsonb NOT NULL,
	"creado_por" text NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "palmares" (
	"id" serial PRIMARY KEY NOT NULL,
	"actividad" text NOT NULL,
	"icono" text,
	"edicion" text,
	"campeon" text NOT NULL,
	"detalle" text,
	"fecha" timestamp with time zone,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "actividad_miembros" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "actividad_participantes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "actividad_partidos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "actividades" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "archivo" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "palmares" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "actividad_miembros" DROP CONSTRAINT IF EXISTS "actividad_miembros_participante_id_actividad_participantes_id_fk";
ALTER TABLE "actividad_miembros" ADD CONSTRAINT "actividad_miembros_participante_id_actividad_participantes_id_fk" FOREIGN KEY ("participante_id") REFERENCES "public"."actividad_participantes"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "actividad_miembros" DROP CONSTRAINT IF EXISTS "actividad_miembros_email_usuarios_email_fk";
ALTER TABLE "actividad_miembros" ADD CONSTRAINT "actividad_miembros_email_usuarios_email_fk" FOREIGN KEY ("email") REFERENCES "public"."usuarios"("email") ON DELETE set null ON UPDATE cascade;
ALTER TABLE "actividad_participantes" DROP CONSTRAINT IF EXISTS "actividad_participantes_actividad_id_actividades_id_fk";
ALTER TABLE "actividad_participantes" ADD CONSTRAINT "actividad_participantes_actividad_id_actividades_id_fk" FOREIGN KEY ("actividad_id") REFERENCES "public"."actividades"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "actividad_partidos" DROP CONSTRAINT IF EXISTS "actividad_partidos_actividad_id_actividades_id_fk";
ALTER TABLE "actividad_partidos" ADD CONSTRAINT "actividad_partidos_actividad_id_actividades_id_fk" FOREIGN KEY ("actividad_id") REFERENCES "public"."actividades"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "actividad_partidos" DROP CONSTRAINT IF EXISTS "actividad_partidos_a_id_actividad_participantes_id_fk";
ALTER TABLE "actividad_partidos" ADD CONSTRAINT "actividad_partidos_a_id_actividad_participantes_id_fk" FOREIGN KEY ("a_id") REFERENCES "public"."actividad_participantes"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "actividad_partidos" DROP CONSTRAINT IF EXISTS "actividad_partidos_b_id_actividad_participantes_id_fk";
ALTER TABLE "actividad_partidos" ADD CONSTRAINT "actividad_partidos_b_id_actividad_participantes_id_fk" FOREIGN KEY ("b_id") REFERENCES "public"."actividad_participantes"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "actividad_partidos" DROP CONSTRAINT IF EXISTS "actividad_partidos_ganador_id_actividad_participantes_id_fk";
ALTER TABLE "actividad_partidos" ADD CONSTRAINT "actividad_partidos_ganador_id_actividad_participantes_id_fk" FOREIGN KEY ("ganador_id") REFERENCES "public"."actividad_participantes"("id") ON DELETE set null ON UPDATE no action;
