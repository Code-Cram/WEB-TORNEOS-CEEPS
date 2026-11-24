-- Páginas libres creadas desde el panel (Panel → 🎨 Web → Páginas): normas generales, contacto, preguntas frecuentes…
-- Se ven en /p/<slug> y salen enlazadas en la portada y en el inicio de cada participante. Se puede ejecutar más de una vez.
CREATE TABLE IF NOT EXISTS "paginas" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"titulo" text NOT NULL,
	"contenido" text DEFAULT '' NOT NULL,
	"titulo_en" text,
	"contenido_en" text,
	"estado" text DEFAULT 'publica' NOT NULL,
	"orden" integer DEFAULT 0 NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "paginas_slug_unique" UNIQUE("slug")
);
ALTER TABLE "paginas" ENABLE ROW LEVEL SECURITY;
