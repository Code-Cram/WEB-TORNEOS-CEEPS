-- Perfiles: cada persona tiene un identificador público que no es su correo (/perfil/<id>), y los ganadores guardan
-- los correos de quienes ganaron, para que el título salga en su perfil. Se puede ejecutar más de una vez sin problema.
ALTER TABLE "usuarios" ADD COLUMN IF NOT EXISTS "perfil" text DEFAULT substr(md5(random()::text || clock_timestamp()::text), 1, 12);
UPDATE "usuarios" SET "perfil" = substr(md5(random()::text || clock_timestamp()::text || "email"), 1, 12) WHERE "perfil" IS NULL;
ALTER TABLE "usuarios" ALTER COLUMN "perfil" SET DEFAULT substr(md5(random()::text || clock_timestamp()::text), 1, 12);
ALTER TABLE "usuarios" ALTER COLUMN "perfil" SET NOT NULL;
ALTER TABLE "usuarios" DROP CONSTRAINT IF EXISTS "usuarios_perfil_unique";
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_perfil_unique" UNIQUE ("perfil");

ALTER TABLE "palmares" ADD COLUMN IF NOT EXISTS "emails" text[] DEFAULT '{}' NOT NULL;
