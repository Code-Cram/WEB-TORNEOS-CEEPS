-- La web, editable desde el panel (Panel → 🎨 Web): marca, logos, colores, aviso para todos y cualquier texto de la
-- web de los participantes, en español y en inglés. Sin filas, todo sale como siempre. Se puede ejecutar más de una vez.

-- Ajustes: una fila por apartado (marca, colores, aviso, logos), con su valor en JSON.
CREATE TABLE IF NOT EXISTS "ajustes_web" (
	"clave" text PRIMARY KEY NOT NULL,
	"valor" jsonb NOT NULL,
	"actualizado_por" text,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE "ajustes_web" ENABLE ROW LEVEL SECURITY;

-- Textos cambiados: la clave es el texto en español del código (el mismo que en las traducciones).
CREATE TABLE IF NOT EXISTS "textos_web" (
	"clave" text PRIMARY KEY NOT NULL,
	"es" text,
	"en" text,
	"actualizado_por" text,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE "textos_web" ENABLE ROW LEVEL SECURITY;

-- Logos subidos desde el panel, en base64 (se sirven en /logos/<nombre>).
CREATE TABLE IF NOT EXISTS "imagenes_web" (
	"nombre" text PRIMARY KEY NOT NULL,
	"tipo" text NOT NULL,
	"datos" text NOT NULL,
	"actualizado_por" text,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE "imagenes_web" ENABLE ROW LEVEL SECURITY;
