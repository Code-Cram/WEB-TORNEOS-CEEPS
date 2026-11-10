export type TorneoId = "futbol" | "mus" | "poker";

/**
 * Datos fijos de cada torneo. Nombre, lema, lugar, calendario, formato, premios y reglas son solo los valores por
 * defecto: se pueden cambiar desde el panel (tabla info_torneos).
 */
export const TORNEOS: Record<
  TorneoId,
  {
    nombre: string;
    corto: string;
    ruta: string;
    icono: string;
    lema: string;
    lugar: string;
    calendario: string;
    formato: string;
    premios: string;
    /** Chuleta de reglas de la página del torneo (formato en lib/reglas.ts). */
    reglas: string;
    /** Cuadro con partido por el 3er y 4º puesto entre los perdedores de semifinales (se crea al sortear). */
    tercerPuesto: boolean;
  }
> = {
  futbol: {
    nombre: "II Torneo de Fútbol Sala",
    corto: "Fútbol Sala",
    ruta: "/futbol",
    icono: "⚽",
    tercerPuesto: false,
    lema: "Eliminatorias a partido único · 2 × 30 min",
    lugar: "Instalaciones deportivas UAM",
    calendario: "",
    formato:
      "Eliminatoria directa a partido único de 2 × 30 min.\nSi hay empate, se decide por penaltis.\nSi no hay equipos para llenar el cuadro, el sorteo da pases directos a la segunda ronda.",
    premios:
      "1º 300 € para el equipo campeón, que elige cómo recibirlos:\n- Opción A: 300 € para el conjunto del equipo.\n- Opción B: una tarjeta regalo para cada jugador, repartiendo los 300 € a partes iguales.\n- Ejemplo: un equipo de 10 jugadores elige entre 300 € para el equipo o 10 tarjetas regalo de 30 € (con 12 jugadores serían 12 tarjetas de 25 €).",
    reglas: [
      "El partido:",
      "- 2 partes de 30 minutos.",
      "- 5 en el campo por equipo (4 y el portero). Cambios ilimitados y sin parar el juego.",
      "- Sin fuera de juego. Los saques de banda y de esquina se hacen con el pie.",
      "Arbitraje: lo arbitran los propios jugadores. La falta la pide quien la recibe y, si hay duda, deciden los dos capitanes. Juego limpio ante todo.",
      "Empate: 3 penaltis por equipo. Si sigue el empate, uno cada uno hasta que uno marque y el otro falle.",
      "No presentado: si un equipo no ha llegado 10 minutos después de la hora, pasa el rival.",
      "Balón: cada equipo trae uno.",
      "Capitanes: añadid el correo de cada jugador en «Gestionar mi equipo» para que pueda entrar en la web.",
      "Nota: lo que no esté aquí lo decide la organización.",
    ].join("\n"),
  },
  mus: {
    nombre: "I Torneo de Mus",
    corto: "Mus",
    ruta: "/mus",
    icono: "🂡",
    tercerPuesto: true,
    lema: "Por parejas · al mejor de 3 partidas a 40 tantos",
    lugar: "Comedor de la EPS (zona de microondas)",
    calendario:
      "Martes 17 nov, 16:00 · mitad izquierda del cuadro, hasta su semifinal\nMiércoles 18 nov, 16:00 · mitad derecha del cuadro, hasta su semifinal\nViernes 20 nov, 16:00 · final y partido por el 3er y 4º puesto",
    formato:
      "Por parejas, eliminatoria directa hasta la pareja campeona.\nCada cruce, al mejor de 3 partidas a 40 tantos. La final, al mejor de 5.\nCada mitad del cuadro se juega en un día distinto: así no tienen que venir todas las parejas a la vez.\nLas dos parejas que pierdan en semifinales juegan por el 3er y 4º puesto.",
    premios:
      "1º 2 tarjetas regalo de 50 € y 2 barajas\n2º 2 tarjetas regalo de 20 € y 2 barajas\n3º 2 tarjetas regalo de 10 € y 2 barajas\n4º 2 barajas\nUna tarjeta y una baraja para cada miembro de la pareja (8 barajas en total entre las cuatro primeras parejas).",
    reglas: [
      "Cada mano se juega en cuatro **lances**, por este orden:",
      "1. Grande: gana la jugada más alta (reyes primero).",
      "2. Chica: gana la jugada más baja (ases primero).",
      "3. Pares: pareja (1), medias (2) o duples (3 tantos).",
      "4. Juego / Punto: 31 o más; si nadie tiene juego, se juega al punto (cerca de 30).",
      "Orden del juego: 31 · 32 · 40 · 37 · 36 · 35 · 34 · 33. La 31 vale 3 tantos; el resto de juegos, 2; el punto, 1.",
      "Valores: sota, caballo y rey valen 10; el as, 1; el resto, su número.",
      "Apuestas: «envido» (2 tantos), «quiero», «no quiero» y el **órdago**, que se juega la partida entera de una vez. Los tantos se cuentan con amarracos (5) y piedras (1).",
      "Nota: la variante (4 u 8 reyes) y si se permiten señas las confirma la organización antes de empezar.",
    ].join("\n"),
  },
  poker: {
    nombre: "I Torneo de Póker",
    corto: "Póker",
    ruta: "/poker",
    icono: "♠",
    tercerPuesto: false,
    lema: "8 mesas clasificatorias · mesa final de 8",
    lugar: "Comedor de la EPS (zona de microondas)",
    calendario: "Martes 10 nov, 16:00 · fase clasificatoria, 1.er turno\nJueves 12 nov, 16:00 · fase clasificatoria, 2.º turno\nViernes 13 nov, 16:00 · mesa final",
    formato:
      "8 mesas clasificatorias de 8 jugadores, repartidas entre el martes 10 y el jueves 12 según la disponibilidad de cada uno.\nEl ganador de cada mesa pasa a la mesa final del viernes 13.\nSin crupier en las clasificatorias (el reparto rota entre jugadores); la mesa final tiene crupier del Consejo.\n64 plazas por orden de inscripción; el resto queda en lista de reserva para cubrir bajas.",
    premios:
      "1º Tarjeta regalo de 100 €\n2º Tarjeta regalo de 50 €\n3º Tarjeta regalo de 20 €\nLos 8 jugadores de la mesa final se llevan una baraja de regalo.",
    reglas: [
      "Texas Hold'em sin límite: cada jugador recibe 2 cartas propias y en la mesa se destapan 5 comunes (3 en el flop, 1 en el turn y 1 en el river). Gana la mejor jugada de 5 cartas entre las 7.",
      "Manos, de mejor a peor:",
      "1. Escalera real: A K Q J 10 del mismo palo.",
      "2. Escalera de color: 5 cartas seguidas del mismo palo.",
      "3. Póker: 4 cartas iguales.",
      "4. Full: un trío y una pareja.",
      "5. Color: 5 cartas del mismo palo.",
      "6. Escalera: 5 cartas seguidas.",
      "7. Trío: 3 cartas iguales.",
      "8. Doble pareja: dos parejas.",
      "9. Pareja: 2 cartas iguales.",
      "10. Carta alta: si nadie tiene nada, gana la carta más alta.",
      "Apuestas: hay una ronda antes del flop y otra después de cada carta común. En tu turno puedes pasar, apostar, igualar, subir o retirarte; ir **all-in** es apostar todas tus fichas.",
      "Ciegas: los dos jugadores a la izquierda del botón ponen la ciega pequeña y la grande antes de repartir. El botón pasa al siguiente jugador en cada mano.",
      "Tu mesa: no hay crupier, reparte quien tiene el botón. Gana la mesa quien se queda con todas las fichas y pasa a la mesa final del viernes 13.",
      "Nota: las fichas iniciales y cada cuánto suben las ciegas los explica la organización al empezar. Si puedes, trae fichas.",
    ].join("\n"),
  },
};

/** Cierre de inscripciones por defecto: 1 de noviembre de 2026 a las 23:59 (hora de Madrid). Editable desde el panel. */
export const CIERRE_INSCRIPCIONES = "2026-11-01T22:59:00Z";

/**
 * Mesa de portavoces: correos separados por comas en la variable de entorno ADMIN_EMAILS.
 * Solo ellos ven el botón «Admin» y pueden entrar al panel (además necesitan la contraseña ADMIN_PASSWORD).
 */
export function esCorreoAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  const admins = (process.env.ADMIN_EMAILS ?? "").split(",").map((c) => c.trim().toLowerCase());
  return admins.includes(email.toLowerCase());
}

export const POKER = { mesas: 8, asientos: 8 } as const;
export const CUPO_POKER = POKER.mesas * POKER.asientos;
