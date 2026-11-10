-- Confirmación de asistencia de equipos, parejas y jugadores de póker (Torneos CEEPS). Se puede ejecutar más de una vez sin problema.
CREATE TABLE IF NOT EXISTS "asistencia" (
	"torneo" text NOT NULL,
	"unidad" text NOT NULL,
	"dia" date NOT NULL,
	"viene" boolean NOT NULL,
	"comentario" text,
	"email" text NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "asistencia_torneo_unidad_dia_pk" PRIMARY KEY("torneo","unidad","dia")
);
ALTER TABLE "asistencia" ENABLE ROW LEVEL SECURITY;
