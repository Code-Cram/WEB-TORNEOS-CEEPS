-- Acceso para IA (Panel → 🔑 Acceso): claves con las que el asistente de un admin usa la web por /api/mcp. Solo se
-- guarda la huella (sha256) de cada clave. Se puede ejecutar más de una vez.
CREATE TABLE IF NOT EXISTS "claves_ia" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"email" text NOT NULL,
	"huella" text NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"usada_en" timestamp with time zone,
	"revocada_en" timestamp with time zone,
	CONSTRAINT "claves_ia_huella_unique" UNIQUE("huella")
);
ALTER TABLE "claves_ia" ENABLE ROW LEVEL SECURITY;
