-- Admins añadidos desde el panel (Panel → 🔑 Acceso), además de los de la variable ADMIN_EMAILS (esos lo son siempre).
-- Para entrar al panel siguen necesitando la contraseña ADMIN_PASSWORD. Se puede ejecutar más de una vez.
CREATE TABLE IF NOT EXISTS "admins" (
	"email" text PRIMARY KEY NOT NULL,
	"anadido_por" text NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE "admins" ENABLE ROW LEVEL SECURITY;
