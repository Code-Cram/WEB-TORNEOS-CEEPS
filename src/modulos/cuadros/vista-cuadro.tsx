"use client";

import Link from "next/link";
import { createContext, useContext, useMemo, useState } from "react";
import { Modal } from "@/modulos/compartido/modal";
import { TORNEOS } from "@/modulos/torneos/config";
import { describirCuadro, nombreRonda, ordenRonda, RONDA_TERCER_PUESTO, rondasEnOrden } from "@/modulos/cuadros/logica";
import { fechaCorta, fechaLarga } from "@/modulos/compartido/formato";
import type { DatosCuadro, EquipoVista, PartidoVista } from "@/modulos/cuadros/tipos";

export type TipoCuadro = "futbol" | "mus" | "general";

/** Textos y colores de cada tipo de cuadro. Las actividades usan «general» y pueden cambiar los textos (p. ej. por equipos). */
export type Tema = {
  unidad: string;
  Unidades: string;
  unidades: string;
  inscrito: string;
  inscritos: string;
  /** Cómo se llaman las personas de cada participante ("" si es individual: no se cuentan). */
  miembros: string;
  /** Cómo se llama cada enfrentamiento, en singular y plural. */
  partidos: [string, string];
  leyenda: string;
  colA: string;
  colB: string;
  colDif: string;
  cabeceraModal: string;
  ganador: string;
  marca: string;
  trofeo: string;
};

const TEMA: Record<TipoCuadro, Tema> = {
  futbol: {
    unidad: "equipo",
    Unidades: "Equipos",
    unidades: "equipos",
    inscrito: "inscrito",
    inscritos: "inscritos",
    miembros: "jugadores",
    partidos: ["partido", "partidos"],
    leyenda: "PJ jugados · PG ganados · PP perdidos · GF goles a favor · GC en contra (los penaltis no cuentan como goles).",
    colA: "GF",
    colB: "GC",
    colDif: "DG",
    cabeceraModal: "fondo-cesped text-white",
    ganador: "bg-verde/10",
    marca: "bg-verde text-crema",
    trofeo: "🏆",
  },
  mus: {
    unidad: "pareja",
    Unidades: "Parejas",
    unidades: "parejas",
    inscrito: "inscrita",
    inscritos: "inscritas",
    miembros: "integrantes",
    partidos: ["cruce", "cruces"],
    leyenda: "PJ jugados · PG ganados · PP perdidos · P+ partidas ganadas · P− perdidas",
    colA: "P+",
    colB: "P−",
    colDif: "Dif",
    cabeceraModal: "fondo-naipe text-tinta pt-6",
    ganador: "bg-copas/10",
    marca: "bg-copas text-white",
    trofeo: "🏆",
  },
  general: {
    unidad: "participante",
    Unidades: "Participantes",
    unidades: "participantes",
    inscrito: "inscrito",
    inscritos: "inscritos",
    miembros: "",
    partidos: ["partido", "partidos"],
    leyenda: "PJ jugados · PG ganados · PP perdidos · PF puntos a favor · PC en contra.",
    colA: "PF",
    colB: "PC",
    colDif: "Dif",
    cabeceraModal: "bg-verde text-crema",
    ganador: "bg-verde/10",
    marca: "bg-verde text-crema",
    trofeo: "🏆",
  },
};

const TemaCuadro = createContext<Tema>(TEMA.futbol);

// Geometría del cuadro (px). Con 5 rondas (32 parejas) las tarjetas son más estrechas para que quepa en escritorio.
const ALTO = 74;
const RANURA = 92;
const geometria = (rondas: number) => (rondas >= 5 ? { ANCHO: 138, HUECO: 18 } : { ANCHO: 156, HUECO: 28 });

type Vista = { tipo: "partido"; id: number } | { tipo: "equipo"; id: number };

export function VistaCuadro({ tipo, datos, tema }: { tipo: TipoCuadro; datos: DatosCuadro; tema?: Partial<Tema> }) {
  // `tema` solo trae los textos que cambian (p. ej. «equipo» en un torneo por equipos); el resto, del tipo.
  const t = useMemo(() => ({ ...TEMA[tipo], ...tema }) as Tema, [tipo, tema]);
  return (
    <TemaCuadro value={t}>
      <Contenido tipo={tipo} datos={datos} />
    </TemaCuadro>
  );
}

function Contenido({ tipo, datos }: { tipo: TipoCuadro; datos: DatosCuadro }) {
  const [modo, setModo] = useState<"cuadro" | "rondas">("cuadro");
  const [pila, setPila] = useState<Vista[]>([]);
  const vista = pila.at(-1) ?? null;
  const abrir = (v: Vista) => setPila((p) => [...p, v]);
  const cerrar = () => setPila([]);

  const equipos = useMemo(() => new Map(datos.equipos.map((e) => [e.id, e])), [datos.equipos]);
  const rondas = Math.max(0, ...datos.partidos.map((p) => p.ronda));
  const final = datos.partidos.find((p) => p.ronda === rondas);
  const campeon = final?.ganador ? equipos.get(final.ganador) : undefined;

  if (!datos.partidos.length) {
    return (
      <>
        <SinSorteo
          equipos={datos.equipos}
          conTercerPuesto={tipo !== "general" && TORNEOS[tipo].tercerPuesto}
          onEquipo={(id) => abrir({ tipo: "equipo", id })}
        />
        <ModalEquipo tipo={tipo} vista={vista} equipos={equipos} partidos={datos.partidos} rondas={rondas} onCerrar={cerrar} onAbrir={abrir} onVolver={pila.length > 1 ? () => setPila((p) => p.slice(0, -1)) : undefined} />
      </>
    );
  }

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-full border-2 border-tinta bg-papel p-0.5 font-mono text-xs font-bold uppercase">
          {(["cuadro", "rondas"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setModo(m)}
              className={`rounded-full px-3 py-1.5 transition ${modo === m ? "bg-tinta text-crema" : "hover:bg-linea"}`}
            >
              {m === "cuadro" ? "Cuadro" : "Por rondas"}
            </button>
          ))}
        </div>
        <p className="font-mono text-xs text-tinta-suave">
          Toca un cruce para ver hora y lugar
          {modo === "cuadro" && <span className="sm:hidden"> · desliza → para ver todo el cuadro</span>}
        </p>
      </div>

      {modo === "cuadro" ? (
        <Cuadro partidos={datos.partidos} equipos={equipos} rondas={rondas} campeon={campeon} onPartido={(id) => abrir({ tipo: "partido", id })} />
      ) : (
        <PorRondas partidos={datos.partidos} equipos={equipos} rondas={rondas} onPartido={(id) => abrir({ tipo: "partido", id })} />
      )}

      <Clasificacion tipo={tipo} datos={datos} rondas={rondas} equipos={equipos} onEquipo={(id) => abrir({ tipo: "equipo", id })} />
      <Resultados tipo={tipo} partidos={datos.partidos} equipos={equipos} rondas={rondas} onPartido={(id) => abrir({ tipo: "partido", id })} />

      <ModalPartido tipo={tipo} vista={vista} equipos={equipos} partidos={datos.partidos} rondas={rondas} onCerrar={cerrar} onAbrir={abrir} onVolver={pila.length > 1 ? () => setPila((p) => p.slice(0, -1)) : undefined} />
      <ModalEquipo tipo={tipo} vista={vista} equipos={equipos} partidos={datos.partidos} rondas={rondas} onCerrar={cerrar} onAbrir={abrir} onVolver={pila.length > 1 ? () => setPila((p) => p.slice(0, -1)) : undefined} />
    </>
  );
}

/* ───────────────────────────── Cuadro a dos lados ───────────────────────────── */

function Cuadro({
  partidos,
  equipos,
  rondas,
  campeon,
  onPartido,
}: {
  partidos: PartidoVista[];
  equipos: Map<number, EquipoVista>;
  rondas: number;
  campeon?: EquipoVista;
  onPartido: (id: number) => void;
}) {
  const tema = useContext(TemaCuadro);
  const { ANCHO, HUECO } = geometria(rondas);
  const tamano = 2 ** rondas;
  const columnas = 2 * rondas - 1;
  const primeraPorLado = Math.max(1, tamano / 4);
  const alto = primeraPorLado * RANURA;
  // Hueco superior: lo justo para los títulos de ronda y el trofeo encima de la final.
  const ARRIBA = Math.max(28, 28 + 160 - alto / 2);
  // El partido por el 3er puesto va debajo de la final, en la columna central.
  const principales = partidos.filter((p) => p.ronda !== RONDA_TERCER_PUESTO);
  const tercero = partidos.find((p) => p.ronda === RONDA_TERCER_PUESTO);
  const yTercero = ARRIBA + alto / 2 + ALTO + 42;
  const anchoTotal = columnas * ANCHO + (columnas - 1) * HUECO;
  const altoTotal = Math.max(ARRIBA + alto + 16, tercero ? yTercero + ALTO / 2 + 16 : 0);

  /** Columna y centro vertical de cada partido. */
  const posicion = (p: PartidoVista) => {
    const total = tamano / 2 ** p.ronda;
    if (p.ronda === rondas) return { col: rondas - 1, y: ARRIBA + alto / 2, derecha: false };
    const mitad = total / 2;
    const derecha = p.posicion >= mitad;
    const j = derecha ? p.posicion - mitad : p.posicion;
    const y = ARRIBA + ((j + 0.5) * alto) / mitad;
    const col = derecha ? columnas - p.ronda : p.ronda - 1;
    return { col, y, derecha };
  };
  const x = (col: number) => col * (ANCHO + HUECO);

  const porClave = new Map(principales.map((p) => [`${p.ronda}:${p.posicion}`, p]));
  const lineas: { d: string; activa: boolean }[] = [];
  for (const p of principales) {
    if (p.ronda === rondas) continue;
    const siguiente = porClave.get(`${p.ronda + 1}:${Math.floor(p.posicion / 2)}`);
    if (!siguiente) continue;
    const o = posicion(p);
    const d = posicion(siguiente);
    const x1 = o.derecha ? x(o.col) : x(o.col) + ANCHO;
    const x2 = o.derecha ? x(d.col) + ANCHO : x(d.col);
    const xm = (x1 + x2) / 2;
    lineas.push({ d: `M${x1} ${o.y} H${xm} V${d.y} H${x2}`, activa: p.ganador !== null });
  }

  const finalP = principales.find((p) => p.ronda === rondas)!;
  const yFinal = posicion(finalP).y;

  return (
    // Ocupa todo el ancho de la ventana (fuera del contenedor central) y hace scroll si aun así no cabe.
    <div className="scroll-suave mx-[calc(50%-50vw)] overflow-x-auto px-4 pb-4">
      <div className="relative mx-auto" style={{ width: anchoTotal, height: altoTotal }}>
        {/* Nombre de cada ronda */}
        {Array.from({ length: columnas }, (_, col) => {
          const ronda = col < rondas ? col + 1 : columnas - col;
          if (ronda === rondas) return null;
          return (
            <div key={col} className="absolute top-0 text-center font-mono text-[11px] font-bold tracking-widest text-tinta-suave uppercase" style={{ left: x(col), width: ANCHO }}>
              {nombreRonda(ronda, rondas, true)}
            </div>
          );
        })}

        <svg className="pointer-events-none absolute inset-0" width={anchoTotal} height={altoTotal} aria-hidden>
          {lineas.map((l, i) => (
            <path key={i} d={l.d} fill="none" stroke={l.activa ? "var(--tinta)" : "var(--linea)"} strokeWidth={2} strokeLinejoin="round" />
          ))}
        </svg>

        {/* Trofeo y campeón sobre la final */}
        <div className="absolute flex flex-col items-center text-center" style={{ left: x(rondas - 1), width: ANCHO, top: yFinal - ALTO / 2 - 118 }}>
          <span className={`text-5xl ${campeon ? "" : "opacity-40 grayscale"}`} aria-hidden>
            {tema.trofeo}
          </span>
          <span className="mt-1 font-mono text-[11px] font-bold tracking-widest text-naranja uppercase">{campeon ? "Campeón" : "Final"}</span>
          <span className="line-clamp-2 font-display text-base leading-tight text-verde uppercase">{campeon?.nombre ?? "¿Quién ganará?"}</span>
        </div>

        {principales.map((p) => {
          const { col, y } = posicion(p);
          return (
            <div key={p.id} className="absolute" style={{ left: x(col), top: y - ALTO / 2, width: ANCHO, height: ALTO }}>
              <TarjetaPartido p={p} equipos={equipos} esFinal={p.ronda === rondas} compacta={ANCHO < 150} onClick={() => onPartido(p.id)} />
            </div>
          );
        })}

        {tercero && (
          <div className="absolute" style={{ left: x(rondas - 1), top: yTercero - ALTO / 2 - 20, width: ANCHO }}>
            <div className="mb-1 text-center font-mono text-[11px] font-bold tracking-widest text-tinta-suave uppercase">
              {nombreRonda(RONDA_TERCER_PUESTO, rondas, true)}
            </div>
            <div style={{ height: ALTO }}>
              <TarjetaPartido p={tercero} equipos={equipos} compacta={ANCHO < 150} onClick={() => onPartido(tercero.id)} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TarjetaPartido({
  p,
  equipos,
  esFinal,
  etiqueta,
  compacta = false,
  onClick,
}: {
  p: PartidoVista;
  equipos: Map<number, EquipoVista>;
  esFinal?: boolean;
  etiqueta?: string;
  compacta?: boolean;
  onClick: () => void;
}) {
  const bye = p.ronda === 1 && (p.a === null) !== (p.b === null);
  const mio = (p.a !== null && equipos.get(p.a)?.esMio) || (p.b !== null && equipos.get(p.b)?.esMio);
  const fecha = fechaCorta(p.fecha);
  return (
    <button
      onClick={onClick}
      className={`group flex h-full w-full flex-col overflow-hidden rounded-xl border-2 bg-papel text-left transition hover:-translate-y-0.5 hover:shadow-[3px_3px_0_var(--tinta)] focus-visible:outline-3 focus-visible:outline-naranja ${
        bye ? "border-dashed border-linea" : esFinal ? "border-naranja shadow-[3px_3px_0_var(--naranja)]" : mio ? "border-naranja" : "border-tinta"
      }`}
    >
      <div className="flex h-[18px] items-center justify-between gap-1 border-b border-linea px-2 font-mono text-[10px] text-tinta-suave">
        <span className="truncate">{etiqueta ?? (bye ? "Pase directo" : (fecha ?? "Fecha por fijar"))}</span>
        {p.lugar && !bye && !compacta && <span className="truncate">{p.lugar}</span>}
      </div>
      <FilaEquipo p={p} lado="a" equipos={equipos} bye={bye} />
      <div className="h-px bg-linea" />
      <FilaEquipo p={p} lado="b" equipos={equipos} bye={bye} />
    </button>
  );
}

function FilaEquipo({
  p,
  lado,
  equipos,
  bye,
}: {
  p: PartidoVista;
  lado: "a" | "b";
  equipos: Map<number, EquipoVista>;
  bye: boolean;
}) {
  const tema = useContext(TemaCuadro);
  const id = lado === "a" ? p.a : p.b;
  const e = id !== null ? equipos.get(id) : undefined;
  const marcador = lado === "a" ? p.marcadorA : p.marcadorB;
  const extra = lado === "a" ? p.extraA : p.extraB;
  const gana = p.ganador !== null && p.ganador === id;
  const pierde = p.ganador !== null && id !== null && p.ganador !== id;
  return (
    <div className={`flex min-h-0 flex-1 items-center gap-1.5 px-2 ${gana ? tema.ganador : ""}`}>
      {e?.esMio && <span className="size-2 shrink-0 rounded-full bg-naranja" title="Tu equipo" />}
      <span
        className={`min-w-0 flex-1 truncate text-[13px] leading-tight ${gana ? "font-bold" : ""} ${pierde ? "text-tinta-suave line-through decoration-1" : ""} ${!e ? "text-tinta-suave italic" : ""}`}
      >
        {e?.nombre ?? (bye ? "—" : "Por decidir")}
      </span>
      {marcador !== null && (
        <span className={`shrink-0 rounded px-1.5 font-mono text-sm font-bold ${gana ? tema.marca : ""}`}>
          {marcador}
          {extra !== null && <sup className="ml-0.5 text-[9px] font-normal">({extra})</sup>}
        </span>
      )}
      {gana && marcador === null && <span className="text-xs">✓</span>}
    </div>
  );
}

/* ───────────────────────────── Vista por rondas ───────────────────────────── */

function PorRondas({
  partidos,
  equipos,
  rondas,
  onPartido,
}: {
  partidos: PartidoVista[];
  equipos: Map<number, EquipoVista>;
  rondas: number;
  onPartido: (id: number) => void;
}) {
  // Por defecto, la primera ronda (en orden de juego) con partidos por jugar.
  const orden = rondasEnOrden(rondas, partidos.some((p) => p.ronda === RONDA_TERCER_PUESTO));
  const pendiente =
    [...partidos].sort((x, y) => ordenRonda(x.ronda, rondas) - ordenRonda(y.ronda, rondas)).find((p) => p.a !== null && p.b !== null && p.ganador === null)
      ?.ronda ?? 1;
  const [ronda, setRonda] = useState(pendiente);
  const lista = partidos.filter((p) => p.ronda === ronda);
  return (
    <div>
      <div className="scroll-suave -mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1">
        {orden.map((r) => (
          <button
            key={r}
            onClick={() => setRonda(r)}
            className={`shrink-0 rounded-full border-2 border-tinta px-3 py-1.5 font-mono text-xs font-bold uppercase transition ${r === ronda ? "bg-verde text-crema" : "bg-papel hover:bg-linea"}`}
          >
            {nombreRonda(r, rondas, true)}
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {lista.map((p) => (
          <div key={p.id} style={{ height: ALTO + 6 }}>
            <TarjetaPartido p={p} equipos={equipos} esFinal={p.ronda === rondas} onClick={() => onPartido(p.id)} />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ───────────────────────────── Tablas ───────────────────────────── */

type Fila = {
  e: EquipoVista;
  pj: number;
  pg: number;
  pp: number;
  af: number;
  ec: number;
  tf: number;
  tc: number;
  alcanzada: number;
  eliminado: boolean;
  /** 1º y 2º (final) y, si hay partido por el 3er puesto, 3º y 4º. */
  puesto: number | null;
  /** Perdió en semifinales y le queda el partido por el 3er puesto. */
  porTercero: boolean;
};

function estadisticas(datos: DatosCuadro, rondas: number): Fila[] {
  const filas = new Map<number, Fila>(
    datos.equipos.map((e) => [
      e.id,
      { e, pj: 0, pg: 0, pp: 0, af: 0, ec: 0, tf: 0, tc: 0, alcanzada: 0, eliminado: false, puesto: null, porTercero: false },
    ]),
  );
  for (const p of datos.partidos) {
    // El partido por el 3er puesto no hace avanzar a nadie: solo reparte el 3º y el 4º.
    const tercero = p.ronda === RONDA_TERCER_PUESTO;
    for (const [id, mio, suyo, tantos] of [
      [p.a, p.marcadorA, p.marcadorB, 0],
      [p.b, p.marcadorB, p.marcadorA, 1],
    ] as const) {
      if (id === null) continue;
      const f = filas.get(id);
      if (!f) continue;
      if (!tercero) f.alcanzada = Math.max(f.alcanzada, p.ronda);
      if (p.ganador === null) {
        if (tercero) f.porTercero = true;
        continue;
      }
      const rival = id === p.a ? p.b : p.a;
      if (rival === null) {
        if (tercero) f.puesto = 3;
        else f.alcanzada = Math.max(f.alcanzada, p.ronda + 1);
        continue; // bye: no cuenta como partido
      }
      f.pj++;
      if (p.ganador === id) {
        f.pg++;
        if (tercero) f.puesto = 3;
        else f.alcanzada = Math.max(f.alcanzada, p.ronda + 1);
        if (p.ronda === rondas) f.puesto = 1;
      } else {
        f.pp++;
        f.eliminado = true;
        if (p.ronda === rondas) f.puesto = 2;
        if (tercero) f.puesto = 4;
      }
      f.af += mio ?? 0;
      f.ec += suyo ?? 0;
      for (const d of p.detalle) {
        f.tf += d[tantos];
        f.tc += d[1 - tantos];
      }
    }
  }
  return [...filas.values()].sort(
    (a, b) =>
      (a.puesto ?? 99) - (b.puesto ?? 99) ||
      b.alcanzada - a.alcanzada ||
      Number(a.eliminado) - Number(b.eliminado) ||
      b.pg - a.pg ||
      b.af - b.ec - (a.af - a.ec) ||
      b.af - a.af ||
      a.e.nombre.localeCompare(b.e.nombre),
  );
}

function Clasificacion({
  tipo,
  datos,
  rondas,
  onEquipo,
}: {
  tipo: TipoCuadro;
  datos: DatosCuadro;
  rondas: number;
  equipos: Map<number, EquipoVista>;
  onEquipo: (id: number) => void;
}) {
  const tema = useContext(TemaCuadro);
  const filas = estadisticas(datos, rondas);
  const conTantos = filas.some((f) => f.tf + f.tc > 0);
  const estado = (f: Fila) =>
    f.puesto === 1
      ? { txt: "Campeón", cls: "bg-naranja text-white" }
      : f.puesto === 2
        ? { txt: "Subcampeón", cls: "bg-oros/40" }
        : f.puesto
          ? { txt: f.puesto === 3 ? "3er puesto" : `${f.puesto}º puesto`, cls: "bg-oros/20" }
          : f.porTercero
            ? { txt: "Juega por el 3er puesto", cls: "bg-verde/15 text-verde" }
            : f.eliminado
              ? { txt: `Fuera en ${nombreRonda(f.alcanzada, rondas, true)}`, cls: "bg-linea text-tinta-suave" }
              : { txt: f.alcanzada >= 1 ? `En ${nombreRonda(Math.min(f.alcanzada, rondas), rondas, true)}` : "Inscrito", cls: "bg-verde/15 text-verde" };

  return (
    <section className="mt-10">
      <h2 className="font-display text-2xl text-verde uppercase">Clasificación</h2>
      <p className="mb-3 text-sm text-tinta-suave">
        {tipo === "mus" ? tema.leyenda + (conTantos ? " · T± diferencia de tantos." : ".") : tema.leyenda}
      </p>
      <div className="scroll-suave overflow-x-auto rounded-2xl border-2 border-tinta bg-papel">
        <table className="w-full text-sm sm:min-w-[540px]">
          <thead className="bg-tinta font-mono text-[11px] tracking-wider text-crema uppercase">
            <tr>
              <th className="px-2 py-2 text-left sm:px-3">#</th>
              <th className="px-2 py-2 text-left sm:px-3">{tema.unidad}</th>
              <th className="px-2 py-2">PJ</th>
              <th className="hidden px-2 py-2 sm:table-cell">PG</th>
              <th className="hidden px-2 py-2 sm:table-cell">PP</th>
              <th className="hidden px-2 py-2 sm:table-cell">{tema.colA}</th>
              <th className="hidden px-2 py-2 sm:table-cell">{tema.colB}</th>
              <th className="px-2 py-2">{tipo === "mus" && conTantos ? "T±" : tema.colDif}</th>
              <th className="px-2 py-2 text-left sm:px-3">Estado</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f, i) => {
              const s = estado(f);
              const dif = tipo === "mus" && conTantos ? f.tf - f.tc : f.af - f.ec;
              return (
                <tr key={f.e.id} className={`border-t border-linea ${f.e.esMio ? "bg-naranja/10" : ""}`}>
                  <td className="px-2 py-2 font-mono text-tinta-suave sm:px-3">{i + 1}</td>
                  <td className="px-2 py-2 sm:px-3">
                    <button onClick={() => onEquipo(f.e.id)} className="text-left font-semibold wrap-anywhere hover:text-naranja hover:underline">
                      {f.e.nombre}
                    </button>
                    {f.e.esMio && <span className="ml-1.5 rounded bg-naranja px-1 font-mono text-[10px] font-bold text-white">TÚ</span>}
                  </td>
                  <td className="px-2 py-2 text-center font-mono">{f.pj}</td>
                  <td className="hidden px-2 py-2 text-center font-mono sm:table-cell">{f.pg}</td>
                  <td className="hidden px-2 py-2 text-center font-mono sm:table-cell">{f.pp}</td>
                  <td className="hidden px-2 py-2 text-center font-mono sm:table-cell">{f.af}</td>
                  <td className="hidden px-2 py-2 text-center font-mono sm:table-cell">{f.ec}</td>
                  <td className="px-2 py-2 text-center font-mono font-bold">{dif > 0 ? `+${dif}` : dif}</td>
                  <td className="px-2 py-2 sm:px-3">
                    <span className={`inline-block rounded-2xl px-2 py-0.5 text-xs leading-tight font-semibold sm:rounded-full sm:whitespace-nowrap ${s.cls}`}>{s.txt}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Resultados({
  tipo,
  partidos,
  equipos,
  rondas,
  onPartido,
}: {
  tipo: TipoCuadro;
  partidos: PartidoVista[];
  equipos: Map<number, EquipoVista>;
  rondas: number;
  onPartido: (id: number) => void;
}) {
  const jugables = partidos.filter((p) => !(p.ronda === 1 && (p.a === null) !== (p.b === null)));
  const nombre = (id: number | null) => (id !== null ? (equipos.get(id)?.nombre ?? "?") : "Por decidir");
  return (
    <section className="mt-10">
      <h2 className="font-display text-2xl text-verde uppercase">Partidos y resultados</h2>
      <div className="mt-3 overflow-hidden rounded-2xl border-2 border-tinta bg-papel">
        {rondasEnOrden(rondas, partidos.some((p) => p.ronda === RONDA_TERCER_PUESTO)).map((r) => {
          const deRonda = jugables.filter((p) => p.ronda === r);
          if (!deRonda.length) return null;
          return (
            <div key={r}>
              <div className="bg-tinta px-4 py-1.5 font-mono text-[11px] font-bold tracking-widest text-crema uppercase">{nombreRonda(r, rondas)}</div>
              <ul>
                {deRonda.map((p) => (
                  <li key={p.id} className="border-t border-linea first:border-t-0">
                    <button onClick={() => onPartido(p.id)} className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-x-2 gap-y-0.5 px-4 py-2.5 text-left text-sm hover:bg-crema">
                      <span className={`truncate text-right ${p.ganador !== null && p.ganador === p.a ? "font-bold" : ""}`}>{nombre(p.a)}</span>
                      <span className="rounded-md bg-crema px-2 py-0.5 text-center font-mono font-bold whitespace-nowrap">
                        {p.marcadorA !== null && p.marcadorB !== null
                          ? `${p.marcadorA} – ${p.marcadorB}${p.extraA !== null ? ` (${p.extraA}–${p.extraB} pen.)` : ""}`
                          : (
                            <>
                              <span className="sm:hidden">vs</span>
                              <span className="hidden sm:inline">{fechaCorta(p.fecha) ?? "vs"}</span>
                            </>
                          )}
                      </span>
                      <span className={`truncate ${p.ganador !== null && p.ganador === p.b ? "font-bold" : ""}`}>{nombre(p.b)}</span>
                      {(p.marcadorA === null || p.marcadorB === null) && p.fecha && (
                        <span className="col-span-3 text-center font-mono text-[11px] text-tinta-suave sm:hidden">{fechaCorta(p.fecha)}</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
        {!jugables.length && <p className="px-4 py-6 text-center text-sm text-tinta-suave">Todavía no hay partidos.</p>}
      </div>
      {tipo === "mus" && (
        <p className="mt-2 text-xs text-tinta-suave">Marcador en partidas ganadas. Cada partida se juega a 40 tantos; la final, al mejor de 5.</p>
      )}
    </section>
  );
}

/* ───────────────────────────── Modales ───────────────────────────── */

type PropsModal = {
  tipo: TipoCuadro;
  vista: Vista | null;
  equipos: Map<number, EquipoVista>;
  partidos: PartidoVista[];
  rondas: number;
  onCerrar: () => void;
  onAbrir: (v: Vista) => void;
  onVolver?: () => void;
};

function ModalPartido({ tipo, vista, equipos, partidos, rondas, onCerrar, onAbrir, onVolver }: PropsModal) {
  const tema = useContext(TemaCuadro);
  const p = vista?.tipo === "partido" ? partidos.find((x) => x.id === vista.id) : undefined;
  const bye = p && p.ronda === 1 && (p.a === null) !== (p.b === null);
  return (
    <Modal
      abierto={!!p}
      onCerrar={onCerrar}
      onVolver={onVolver}
      cabecera={tema.cabeceraModal}
      subtitulo={p ? (p.ronda === RONDA_TERCER_PUESTO ? "Entre quienes pierden las semifinales" : nombreRonda(p.ronda, rondas)) : ""}
      titulo={p?.ronda === rondas ? "Gran final" : p?.ronda === RONDA_TERCER_PUESTO ? "3er y 4º puesto" : `Partido ${p ? p.posicion + 1 : ""}`}
    >
      {p && (
        <div className="space-y-4">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            {(["a", "b"] as const).map((lado, i) => {
              const id = lado === "a" ? p.a : p.b;
              const e = id !== null ? equipos.get(id) : undefined;
              const marcador = lado === "a" ? p.marcadorA : p.marcadorB;
              const caja = (
                <button
                  key={lado}
                  disabled={!e}
                  onClick={() => e && onAbrir({ tipo: "equipo", id: e.id })}
                  className={`flex flex-col items-center gap-1 rounded-2xl border-2 p-3 text-center transition enabled:hover:-translate-y-0.5 enabled:hover:shadow-[3px_3px_0_var(--tinta)] ${
                    p.ganador !== null && p.ganador === id ? "border-verde bg-verde/10" : "border-tinta bg-white"
                  } ${!e ? "border-dashed opacity-60" : ""}`}
                >
                  <span className="line-clamp-2 font-display text-sm leading-tight uppercase">{e?.nombre ?? (bye ? "Pase directo" : "Por decidir")}</span>
                  {e && <span className="font-mono text-[10px] text-tinta-suave uppercase">Ver {tema.unidad} →</span>}
                  {e?.esMio && <span className="rounded bg-naranja px-1 font-mono text-[10px] font-bold text-white">TÚ</span>}
                  {marcador !== null && <span className="font-display text-4xl text-verde">{marcador}</span>}
                </button>
              );
              return i === 0 ? (
                [caja, <span key="vs" className="font-display text-lg text-tinta-suave">VS</span>]
              ) : (
                caja
              );
            })}
          </div>

          {p.extraA !== null && p.extraB !== null && (
            <p className="text-center font-mono text-sm">
              Penaltis: <strong>{p.extraA} – {p.extraB}</strong>
            </p>
          )}

          {tipo === "mus" && (
            <div className="rounded-2xl border-2 border-linea bg-white p-3">
              <p className="font-mono text-xs font-bold text-tinta-suave uppercase">
                Al mejor de {p.mejorDe ?? 3} partidas · a 40 tantos
              </p>
              {p.detalle.length ? (
                <table className="mt-2 w-full text-sm">
                  <tbody>
                    {p.detalle.map(([a, b], i) => (
                      <tr key={i} className="border-t border-linea first:border-t-0">
                        <td className="py-1 font-mono text-tinta-suave">Partida {i + 1}</td>
                        <td className={`py-1 text-right font-mono ${a > b ? "font-bold text-copas" : ""}`}>{a}</td>
                        <td className="w-6 py-1 text-center text-tinta-suave">–</td>
                        <td className={`py-1 font-mono ${b > a ? "font-bold text-copas" : ""}`}>{b}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="mt-1 text-sm text-tinta-suave">Aún no hay tantos apuntados.</p>
              )}
            </div>
          )}

          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-2xl bg-crema p-4 text-sm">
            <dt className="font-mono text-xs font-bold text-tinta-suave uppercase">Cuándo</dt>
            <dd className="first-letter:uppercase">{fechaLarga(p.fecha) ?? "Por fijar"}</dd>
            <dt className="font-mono text-xs font-bold text-tinta-suave uppercase">Dónde</dt>
            <dd>{p.lugar ?? "Por fijar"}</dd>
            {p.notas && (
              <>
                <dt className="font-mono text-xs font-bold text-tinta-suave uppercase">Notas</dt>
                <dd>{p.notas}</dd>
              </>
            )}
          </dl>
        </div>
      )}
    </Modal>
  );
}

function ModalEquipo({ vista, equipos, partidos, rondas, onCerrar, onAbrir, onVolver }: PropsModal) {
  const tema = useContext(TemaCuadro);
  const e = vista?.tipo === "equipo" ? equipos.get(vista.id) : undefined;
  const suyos = e
    ? partidos
        .filter((p) => (p.a === e.id || p.b === e.id) && !(p.ronda === 1 && (p.a === null || p.b === null)))
        .sort((x, y) => ordenRonda(x.ronda, rondas) - ordenRonda(y.ronda, rondas))
    : [];
  return (
    <Modal
      abierto={!!e}
      onCerrar={onCerrar}
      onVolver={onVolver}
      cabecera={tema.cabeceraModal}
      subtitulo={e ? [tema.miembros && `${e.jugadores.length} ${tema.miembros}`, e.esMio && `tu ${tema.unidad}`].filter(Boolean).join(" · ") : ""}
      titulo={e?.nombre ?? ""}
    >
      {e && (
        <div className="space-y-5">
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {e.jugadores.map((j, i) => {
              const clase = `flex items-center gap-2 rounded-xl border-2 px-3 py-2 ${j.esYo ? "border-naranja bg-naranja/10" : "border-linea bg-white"}`;
              const contenido = (
                <>
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-verde font-mono text-xs font-bold text-crema">
                    {j.nombre
                      .split(" ")
                      .slice(0, 2)
                      .map((w) => w[0])
                      .join("")
                      .toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{j.nombre}</span>
                  {j.esCapitan && (
                    <span className="rounded bg-naranja px-1.5 font-mono text-[10px] font-bold text-white" title="Capitán">
                      C
                    </span>
                  )}
                  {j.esYo && <span className="font-mono text-[10px] font-bold text-naranja">TÚ</span>}
                </>
              );
              // Tocar a alguien abre su perfil (sus torneos, resultados y títulos).
              return (
                <li key={i}>
                  {j.perfil ? (
                    <Link href={`/perfil/${j.perfil}`} className={`${clase} transition hover:border-tinta`} title={`Perfil de ${j.nombre}`}>
                      {contenido}
                      <span aria-hidden className="text-tinta-suave">
                        ›
                      </span>
                    </Link>
                  ) : (
                    <div className={clase}>{contenido}</div>
                  )}
                </li>
              );
            })}
          </ul>

          {suyos.length > 0 && (
            <div>
              <h3 className="mb-2 font-mono text-xs font-bold tracking-wider text-tinta-suave uppercase">Recorrido</h3>
              <ul className="space-y-1.5">
                {suyos.map((p) => {
                  const rival = p.a === e.id ? p.b : p.a;
                  const mio = p.a === e.id ? p.marcadorA : p.marcadorB;
                  const suyo = p.a === e.id ? p.marcadorB : p.marcadorA;
                  const res = p.ganador === null ? null : p.ganador === e.id ? "V" : "D";
                  return (
                    <li key={p.id}>
                      <button
                        onClick={() => onAbrir({ tipo: "partido", id: p.id })}
                        className="flex w-full items-center gap-2 rounded-xl border-2 border-linea bg-white px-3 py-2 text-left text-sm hover:border-tinta"
                      >
                        <span
                          className={`grid size-6 shrink-0 place-items-center rounded-md font-mono text-xs font-bold ${
                            res === "V" ? "bg-verde text-crema" : res === "D" ? "bg-copas text-white" : "bg-linea text-tinta-suave"
                          }`}
                        >
                          {res ?? "·"}
                        </span>
                        <span className="w-16 shrink-0 font-mono text-[11px] text-tinta-suave uppercase">{nombreRonda(p.ronda, rondas, true)}</span>
                        <span className="min-w-0 flex-1 truncate">vs {rival !== null ? equipos.get(rival)?.nombre : "Por decidir"}</span>
                        {mio !== null && suyo !== null && (
                          <span className="font-mono font-bold">
                            {mio}–{suyo}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

/* ───────────────────────────── Antes del sorteo ───────────────────────────── */

function SinSorteo({ equipos, conTercerPuesto, onEquipo }: { equipos: EquipoVista[]; conTercerPuesto: boolean; onEquipo: (id: number) => void }) {
  const tema = useContext(TemaCuadro);
  // Cómo quedará el cuadro con los inscritos de ahora (pases directos si no llenan el cuadro).
  const cuadro = describirCuadro(equipos.length, tema.partidos);
  return (
    <div>
      <div className="rounded-3xl border-2 border-dashed border-tinta/40 bg-papel p-6 text-center">
        <p className="text-4xl" aria-hidden>
          🎲
        </p>
        <h2 className="mt-2 font-display text-xl text-verde uppercase">Cuadro pendiente de sorteo</h2>
        <p className="mt-1 text-sm text-tinta-suave">
          En cuanto el Consejo haga el sorteo verás aquí los cruces. De momento hay {equipos.length} {equipos.length === 1 ? tema.unidad : tema.unidades}{" "}
          {equipos.length === 1 ? tema.inscrito : tema.inscritos}
          {cuadro ? `: ${cuadro}.` : "."}
          {conTercerPuesto && equipos.length >= 4 && " Quienes pierdan en semifinales jugarán por el 3er y 4º puesto."}
        </p>
      </div>
      <h2 className="mt-8 mb-3 font-display text-2xl text-verde uppercase">
        {tema.Unidades} {tema.inscritos}
      </h2>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {equipos.map((e) => (
          <button
            key={e.id}
            onClick={() => onEquipo(e.id)}
            className={`flex items-center justify-between gap-2 rounded-xl border-2 bg-papel px-4 py-3 text-left transition hover:-translate-y-0.5 hover:shadow-[3px_3px_0_var(--tinta)] ${e.esMio ? "border-naranja" : "border-tinta"}`}
          >
            <span className="truncate font-semibold">{e.nombre}</span>
            <span className="shrink-0 font-mono text-xs text-tinta-suave">{e.jugadores.length} 👤</span>
          </button>
        ))}
      </div>
    </div>
  );
}
