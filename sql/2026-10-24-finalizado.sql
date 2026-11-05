-- «Dar por finalizado» un torneo (Torneos CEEPS). Se puede ejecutar más de una vez sin problema.
ALTER TABLE "info_torneos" ADD COLUMN IF NOT EXISTS "finalizado" boolean DEFAULT false NOT NULL;
