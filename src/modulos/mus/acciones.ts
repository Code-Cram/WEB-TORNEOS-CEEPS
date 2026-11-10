"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { musParejas, musPartidas, musPartidos } from "@/db/schema";
import { AvisoError } from "@/modulos/acceso/clave";
import { exigirAdmin } from "@/modulos/acceso/sesion";
import { parsearTantos } from "@/modulos/cuadros/logica";
import { guardarPareja, recalcularMus } from "@/modulos/mus/operaciones";
import { entero, fecha, hecho, idDe, intentar, texto, textoONull, type Resultado } from "@/modulos/panel/comun";
import { parsearPlantilla } from "@/modulos/personas/plantilla";

export async function guardarPartidoMus(_prev: Resultado, f: FormData): Promise<Resultado> {
  const admin = await exigirAdmin();
  return intentar(async () => {
    const id = idDe(f);
    const tantos = parsearTantos(texto(f, "tantos", 300));
    const mejorDe = entero(f, "mejorDe", 9) ?? 3;
    if (mejorDe % 2 === 0) throw new AvisoError("«Al mejor de» tiene que ser un número impar.");
    let partidasA = entero(f, "partidasA", 9);
    let partidasB = entero(f, "partidasB", 9);
    // Si se apuntan los tantos, mandan ellos: las partidas se cuentan solas.
    if (tantos.length) {
      partidasA = tantos.filter(([a, b]) => a > b).length;
      partidasB = tantos.filter(([a, b]) => b > a).length;
    }
    let detalle = "";
    await db.transaction(async (tx) => {
      const [p] = await tx.select().from(musPartidos).where(eq(musPartidos.id, id));
      if (!p) throw new AvisoError("Cruce no encontrado: recarga la página.");
      detalle = `Mus · ronda ${p.ronda}, cruce ${p.posicion + 1}`;
      const cambios: Partial<typeof musPartidos.$inferInsert> = {
        partidasA,
        partidasB,
        mejorDe,
        fecha: fecha(f, "fecha"),
        lugar: textoONull(f, "lugar", 200),
        notas: textoONull(f, "notas", 500),
      };
      if (p.ronda === 1 && f.has("parejaAId")) {
        const a = entero(f, "parejaAId");
        const b = entero(f, "parejaBId");
        if (a !== null && a === b) throw new AvisoError("Una pareja no puede jugar contra sí misma.");
        if (a !== p.parejaAId || b !== p.parejaBId) Object.assign(cambios, { parejaAId: a, parejaBId: b });
      }
      await tx.update(musPartidos).set(cambios).where(eq(musPartidos.id, id));
      await tx.delete(musPartidas).where(eq(musPartidas.partidoId, id));
      if (tantos.length)
        await tx.insert(musPartidas).values(tantos.map(([a, b], i) => ({ partidoId: id, numero: i + 1, tantosA: a, tantosB: b })));
      await recalcularMus(tx);
    });
    const necesarias = Math.floor(mejorDe / 2) + 1;
    const avisos =
      partidasA !== null && partidasB !== null && Math.max(partidasA, partidasB) < necesarias
        ? [`Nadie ha llegado a ${necesarias} partidas: el cruce sigue abierto.`]
        : undefined;
    return hecho(admin, "Cruce guardado.", avisos, detalle);
  });
}

export async function guardarParejaAdmin(_prev: Resultado, f: FormData): Promise<Resultado> {
  const admin = await exigirAdmin();
  return intentar(async () => {
    const id = entero(f, "id");
    const integrantes = parsearPlantilla(texto(f, "integrantes", 1000));
    const nombre = texto(f, "nombre", 120) || integrantes.map((i) => i.nombre.split(" ")[0]).join(" y ");
    if (!integrantes.length) throw new AvisoError("La pareja necesita al menos un integrante.");
    if (integrantes.length > 2) throw new AvisoError("Una pareja tiene como máximo 2 integrantes.");
    await db.transaction(async (tx) => {
      let parejaId = id;
      if (parejaId) {
        const [p] = await tx.update(musParejas).set({ nombre }).where(eq(musParejas.id, parejaId)).returning({ id: musParejas.id });
        if (!p) throw new AvisoError("Pareja no encontrada: recarga la página.");
      } else
        [{ id: parejaId }] = await tx
          .insert(musParejas)
          .values({ nombre, clave: `manual:${Date.now()}` })
          .returning({ id: musParejas.id });
      await guardarPareja(tx, parejaId!, integrantes);
    });
    return hecho(
      admin,
      id ? "Pareja guardada." : "Pareja creada.",
      integrantes.map((j) => j.aviso).filter((a): a is string => !!a),
      `Mus · ${nombre}`,
    );
  });
}

export async function eliminarPareja(_prev: Resultado, f: FormData): Promise<Resultado> {
  const admin = await exigirAdmin();
  return intentar(async () => {
    const id = idDe(f);
    const [p] = await db.select({ nombre: musParejas.nombre }).from(musParejas).where(eq(musParejas.id, id));
    if (!p) throw new AvisoError("Esa pareja ya no existe.");
    await db.transaction(async (tx) => {
      await tx.delete(musParejas).where(eq(musParejas.id, id));
      await recalcularMus(tx);
    });
    return hecho(admin, "Pareja eliminada.", undefined, `Mus · ${p.nombre}`);
  });
}
