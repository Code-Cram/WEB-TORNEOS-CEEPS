/**
 * SOLO DESARROLLO: sortea los tres torneos y apunta resultados de prueba para ver la web con contenido.
 * Se niega a ejecutarse si DATABASE_URL no apunta a localhost.
 * Uso: npm run db:demo
 */
import { asc, eq } from "drizzle-orm";
import { crearDb } from "../src/db/client";
import { futbolPartidos, musPartidas, musPartidos, pokerAsientos, pokerMesas } from "../src/db/schema";
import { enBloque } from "../src/modulos/cuadros/logica";
import { fechaMadrid } from "../src/modulos/importacion/csv";
import { ordenarTurnos } from "../src/modulos/poker/mesas";
import { recalcularFinalPoker, sortearPoker } from "../src/modulos/poker/operaciones";
import { recalcularFutbol, sortearFutbol } from "../src/modulos/futbol/operaciones";
import { recalcularMus, sortearMus } from "../src/modulos/mus/operaciones";

const url = process.env.DATABASE_URL ?? "";
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url)) {
  console.error("demo: DATABASE_URL no es local. No se toca nada.");
  process.exit(1);
}

const { db, client } = crearDb(url);
const azar = (n: number) => Math.floor(Math.random() * n);

try {
  await sortearFutbol(db);
  await sortearMus(db);
  await sortearPoker(db);

  // Fútbol: primera ronda y la mitad de la segunda jugadas.
  await db.transaction(async (tx) => {
    const partidos = await tx.select().from(futbolPartidos).orderBy(asc(futbolPartidos.ronda), asc(futbolPartidos.posicion));
    let hora = 0;
    for (const p of partidos) {
      const dia = p.ronda === 1 ? "2026-11-17" : p.ronda === 2 ? "2026-11-24" : p.ronda === 3 ? "2026-12-01" : "2026-12-15";
      await tx
        .update(futbolPartidos)
        .set({ fecha: fechaMadrid(`${dia}T${String(12 + (hora++ % 6)).padStart(2, "0")}:00:00`), lugar: "Instalaciones deportivas UAM · Pista 1" })
        .where(eq(futbolPartidos.id, p.id));
    }
    await recalcularFutbol(tx);
    for (const ronda of [1, 2]) {
      const deRonda = (await tx.select().from(futbolPartidos).where(eq(futbolPartidos.ronda, ronda))).filter((p) => p.localId && p.visitanteId);
      for (const p of ronda === 1 ? deRonda : deRonda.slice(0, 2)) {
        const [a, b] = [azar(6), azar(6)];
        await tx
          .update(futbolPartidos)
          .set({ golesLocal: a, golesVisitante: b, ...(a === b ? { penaltisLocal: 4, penaltisVisitante: 3 } : {}) })
          .where(eq(futbolPartidos.id, p.id));
      }
      await recalcularFutbol(tx);
    }
  });

  // Mus: cada mitad del cuadro un día (17 y 18 de noviembre) y la final con el 3er puesto el 20.
  await db.transaction(async (tx) => {
    const partidos = await tx.select().from(musPartidos);
    const rondas = Math.max(...partidos.map((p) => p.ronda));
    for (const p of partidos) {
      const dia = enBloque("izquierda", p, rondas) ? "17" : enBloque("derecha", p, rondas) ? "18" : "20";
      await tx.update(musPartidos).set({ fecha: fechaMadrid(`2026-11-${dia}T17:00:00`), lugar: "Comedor EPS (zona microondas)" }).where(eq(musPartidos.id, p.id));
    }
  });
  // Dieciseisavos jugados con tantos, octavos a medias.
  await db.transaction(async (tx) => {
    for (const ronda of [1, 2]) {
      const deRonda = (await tx.select().from(musPartidos).where(eq(musPartidos.ronda, ronda))).filter((p) => p.parejaAId && p.parejaBId);
      for (const p of ronda === 1 ? deRonda : deRonda.slice(0, 4)) {
        const ganaA = Math.random() < 0.5;
        const tantos: [number, number][] = [];
        let [a, b] = [0, 0];
        while (a < 2 && b < 2) {
          const gana = Math.random() < (ganaA ? 0.7 : 0.3);
          tantos.push(gana ? [40, 10 + azar(29)] : [10 + azar(29), 40]);
          if (gana) a++;
          else b++;
        }
        await tx.update(musPartidos).set({ partidasA: a, partidasB: b }).where(eq(musPartidos.id, p.id));
        await tx.insert(musPartidas).values(tantos.map(([x, y], i) => ({ partidoId: p.id, numero: i + 1, tantosA: x, tantosB: y })));
      }
      await recalcularMus(tx);
    }
  });

  // Póker: fecha en las mesas (1er turno el 10 de noviembre, 2º el 12, final el 13) y ganador en tres de ellas.
  await db.transaction(async (tx) => {
    const mesas = await tx.select().from(pokerMesas).orderBy(asc(pokerMesas.numero));
    const turnos = ordenarTurnos([...new Set(mesas.map((m) => m.turno).filter((t): t is string => !!t))]);
    for (const m of mesas) {
      const dia = m.fase === "final" ? "2026-11-13" : turnos.indexOf(m.turno ?? "") > 0 ? "2026-11-12" : "2026-11-10";
      await tx.update(pokerMesas).set({ fecha: fechaMadrid(`${dia}T16:00:00`), lugar: "Comedor EPS · zona microondas" }).where(eq(pokerMesas.id, m.id));
    }
    for (const m of mesas.filter((x) => x.fase === "clasificatoria").slice(0, 3)) {
      const asientos = await tx.select().from(pokerAsientos).where(eq(pokerAsientos.mesaId, m.id));
      const orden = [...asientos].sort(() => Math.random() - 0.5);
      for (const [i, a] of orden.entries())
        await tx.update(pokerAsientos).set({ puesto: orden.length - i }).where(eq(pokerAsientos.jugadorEmail, a.jugadorEmail));
      await tx.update(pokerMesas).set({ ganadorEmail: orden.at(-1)!.jugadorEmail }).where(eq(pokerMesas.id, m.id));
    }
    await recalcularFinalPoker(tx);
  });
  console.log("demo: sorteos y resultados de prueba listos.");
} finally {
  await client.end();
}
