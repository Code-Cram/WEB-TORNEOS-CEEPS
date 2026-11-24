/**
 * SOLO DESARROLLO: rellena una base de datos local vacía con participantes inventados (12 equipos de fútbol, 16 parejas
 * de mus y 40 jugadores de póker, con correos @example.com), para probar la web sin los CSV reales. Si ya hay
 * participantes, no hace nada. Se niega a ejecutarse si DATABASE_URL no es local.
 * Uso: npm run db:inventar   (después, npm run db:demo sortea y apunta resultados)
 */
import { crearDb } from "../src/db/client";
import { futbolEquipos, futbolJugadores, musIntegrantes, musParejas, pokerJugadores, usuarios } from "../src/db/schema";
import { esLocal } from "./local";

const url = process.env.DATABASE_URL ?? "";
if (!esLocal(url)) {
  console.error("inventar: DATABASE_URL no es local. No se toca nada.");
  process.exit(1);
}

// Nombres comunes y apellidos que no son de nadie: así nunca se confunden con datos reales.
const NOMBRES = ["Ana", "Luis", "Marta", "Javier", "Lucía", "Pablo", "Sara", "Diego", "Elena", "Hugo", "Carmen", "Álvaro", "Irene", "Mario", "Paula", "Raúl", "Nuria", "Iván", "Claudia", "Óscar"];
const APELLIDOS = ["Prueba", "Ejemplo", "Demo", "Ficticio", "Inventado", "Muestra", "Ensayo", "Simulado"];
const EQUIPOS = [
  "Los Rayos de Prueba",
  "Atlético Ejemplo",
  "Real Demo FC",
  "Deportivo Ficticio",
  "Inventados United",
  "Club Muestra",
  "Ensayo Juniors",
  "Simulados CF",
  "Sporting Maqueta",
  "Racing Borrador",
  "Unión Boceto",
  "Olímpico Prototipo",
];
const DIAS_POKER = ["Martes 10 nov", "Jueves 12 nov"];

let n = 0;
/** Una persona inventada con su correo @example.com (sin tildes ni espacios). */
function persona(): { nombre: string; email: string } {
  const nombre = `${NOMBRES[n % NOMBRES.length]} ${APELLIDOS[Math.floor(n / NOMBRES.length) % APELLIDOS.length]}`;
  const email = `${nombre.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/\s+/g, ".")}${n}@example.com`;
  n++;
  return { nombre, email };
}

const { db, client } = crearDb(url);
try {
  if ((await db.$count(futbolEquipos)) + (await db.$count(musParejas)) + (await db.$count(pokerJugadores)) > 0) {
    console.log("inventar: ya hay participantes; no se añade nada.");
  } else {
    await db.transaction(async (tx) => {
      const ahora = Date.now();
      for (const [i, nombre] of EQUIPOS.entries()) {
        const jugadores = Array.from({ length: 7 }, persona);
        await tx.insert(usuarios).values(jugadores).onConflictDoNothing();
        const [e] = await tx
          .insert(futbolEquipos)
          .values({ clave: `prueba-futbol-${i + 1}`, nombre, capitanEmail: jugadores[0].email, horario: ["Mañana", "Tarde", "Tarde / Mañana"][i % 3], inscritoEn: new Date(ahora + i) })
          .returning({ id: futbolEquipos.id });
        await tx.insert(futbolJugadores).values(jugadores.map((j, k) => ({ equipoId: e.id, nombre: j.nombre, email: j.email, esCapitan: k === 0 })));
      }
      for (let i = 0; i < 16; i++) {
        const pareja = [persona(), persona()];
        await tx.insert(usuarios).values(pareja).onConflictDoNothing();
        const [p] = await tx
          .insert(musParejas)
          .values({ clave: `prueba-mus-${i + 1}`, nombre: `${pareja[0].nombre.split(" ")[0]} y ${pareja[1].nombre.split(" ")[0]} (${i + 1})`, capitanEmail: pareja[0].email, inscritoEn: new Date(ahora + i) })
          .returning({ id: musParejas.id });
        await tx.insert(musIntegrantes).values(pareja.map((j, k) => ({ parejaId: p.id, orden: k + 1, nombre: j.nombre, email: j.email })));
      }
      const jugadores = Array.from({ length: 40 }, persona);
      await tx.insert(usuarios).values(jugadores).onConflictDoNothing();
      await tx.insert(pokerJugadores).values(
        jugadores.map((j, i) => ({
          ...j,
          // Los 32 primeros, inscritos; el resto, a la lista de reserva. Cada uno puede uno de los días o los dos.
          estado: i < 32 ? "inscrito" : "reserva",
          disponibilidad: i % 3 === 2 ? DIAS_POKER : [DIAS_POKER[i % 2]],
          inscritoEn: new Date(ahora + i),
        })),
      );
    });
    console.log(`inventar: ${EQUIPOS.length} equipos de fútbol, 16 parejas de mus y 40 jugadores de póker (correos @example.com).`);
  }
} finally {
  await client.end();
}
