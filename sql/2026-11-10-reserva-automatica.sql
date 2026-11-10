-- Póker: plazas que pasan solas a la reserva, y correos que manda la web (Torneos CEEPS). Se puede ejecutar más de una vez sin problema.
ALTER TABLE "info_torneos" ADD COLUMN IF NOT EXISTS "reserva_automatica" boolean DEFAULT true NOT NULL;
ALTER TABLE "info_torneos" ADD COLUMN IF NOT EXISTS "reserva_automatica_desde" timestamp with time zone;

CREATE TABLE IF NOT EXISTS "poker"."relevos" (
	"id" serial PRIMARY KEY NOT NULL,
	"mesa_id" integer NOT NULL,
	"asiento" integer NOT NULL,
	"sale_email" text NOT NULL,
	"entra_email" text NOT NULL,
	"motivo" text NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE "poker"."relevos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "poker"."relevos" DROP CONSTRAINT IF EXISTS "relevos_mesa_id_mesas_id_fk";
ALTER TABLE "poker"."relevos" ADD CONSTRAINT "relevos_mesa_id_mesas_id_fk" FOREIGN KEY ("mesa_id") REFERENCES "poker"."mesas"("id") ON DELETE cascade ON UPDATE no action;

CREATE TABLE IF NOT EXISTS "correos" (
	"id" serial PRIMARY KEY NOT NULL,
	"para" text NOT NULL,
	"asunto" text NOT NULL,
	"texto" text NOT NULL,
	"motivo" text,
	"estado" text DEFAULT 'pendiente' NOT NULL,
	"error" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"enviado_en" timestamp with time zone
);
ALTER TABLE "correos" ENABLE ROW LEVEL SECURITY;
