-- Chat de cada torneo y actividad: salas por día de juego y conversaciones privadas con el Consejo (Torneos CEEPS).
-- Se puede ejecutar más de una vez sin problema.
CREATE TABLE IF NOT EXISTS "mensajes" (
	"id" serial PRIMARY KEY NOT NULL,
	"torneo" text NOT NULL,
	"actividad_id" integer,
	"dia" date,
	"privado_con" text,
	"email" text NOT NULL,
	"nombre" text NOT NULL,
	"unidad" text,
	"de_consejo" boolean DEFAULT false NOT NULL,
	"texto" text NOT NULL,
	"leido" boolean DEFAULT false NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"borrado_en" timestamp with time zone
);
ALTER TABLE "mensajes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "mensajes" DROP CONSTRAINT IF EXISTS "mensajes_actividad_id_actividades_id_fk";
ALTER TABLE "mensajes" ADD CONSTRAINT "mensajes_actividad_id_actividades_id_fk" FOREIGN KEY ("actividad_id") REFERENCES "public"."actividades"("id") ON DELETE cascade ON UPDATE no action;
CREATE INDEX IF NOT EXISTS "mensajes_sala_idx" ON "mensajes" USING btree ("torneo","actividad_id","dia","id");
CREATE INDEX IF NOT EXISTS "mensajes_privado_idx" ON "mensajes" USING btree ("privado_con","id");
