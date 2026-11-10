import assert from "node:assert/strict";
import path from "node:path";
import { describe, test } from "node:test";
import { esDestructiva, ficherosSql } from "../src/db/migraciones";

describe("migraciones", () => {
  test("lo que borra datos o tablas no se aplica solo", () => {
    for (const sql of [
      'DROP TABLE "poker"."premios";',
      "alter table info_torneos drop column premios;",
      "ALTER TABLE info_torneos DROP premios",
      "DELETE FROM asistencia;",
      "TRUNCATE registro;",
      "DO $$ BEGIN IF to_regclass('poker.premios') IS NOT NULL THEN DROP TABLE poker.premios; END IF; END $$;",
    ])
      assert.ok(esDestructiva(sql), sql);
  });

  test("añadir, rellenar o rehacer restricciones sí", () => {
    for (const sql of [
      'ALTER TABLE "info_torneos" ADD COLUMN IF NOT EXISTS "reglas" text;',
      'ALTER TABLE "x" DROP CONSTRAINT IF EXISTS "x_fk"; ALTER TABLE "x" ADD CONSTRAINT "x_fk" FOREIGN KEY ("a") REFERENCES "y"("id");',
      "ALTER TABLE x ALTER COLUMN a DROP DEFAULT;",
      "UPDATE poker.mesas SET fecha = now() WHERE fecha IS NULL;",
      "-- Antes había un DROP TABLE aquí\nUPDATE info_torneos SET aviso = 'Drop-in: delete from la lista' WHERE aviso IS NULL;",
    ])
      assert.ok(!esDestructiva(sql), sql);
  });

  test("las migraciones de sql/ van por fecha y ninguna borra nada", () => {
    const ficheros = ficherosSql(path.join(import.meta.dirname, "..", "sql"));
    assert.ok(ficheros.length > 0);
    assert.deepEqual(
      ficheros.map((f) => f.nombre),
      ficheros.map((f) => f.nombre).toSorted(),
    );
    for (const f of ficheros) {
      assert.match(f.nombre, /^\d{4}-\d{2}-\d{2}-[a-z0-9-]+\.sql$/, f.nombre);
      assert.ok(!esDestructiva(f.sql), `${f.nombre} borra cosas: va en sql/a-mano/`);
    }
  });
});
