import type { Idioma } from "./config";

/*
 * Días y meses dentro de textos escritos a mano («Martes 10 nov», «jueves 12 de noviembre»): en inglés se traducen
 * para que una etiqueta de turno o de calendario no salga a medias en español.
 */

const DIAS: Record<string, string> = {
  lunes: "Monday",
  martes: "Tuesday",
  miercoles: "Wednesday",
  miércoles: "Wednesday",
  jueves: "Thursday",
  viernes: "Friday",
  sabado: "Saturday",
  sábado: "Saturday",
  domingo: "Sunday",
};
const MESES: Record<string, string> = {
  ene: "Jan", enero: "January", feb: "Feb", febrero: "February", mar: "Mar", marzo: "March", abr: "Apr", abril: "April",
  may: "May", mayo: "May", jun: "Jun", junio: "June", jul: "Jul", julio: "July", ago: "Aug", agosto: "August",
  sep: "Sep", sept: "Sep", septiembre: "September", oct: "Oct", octubre: "October", nov: "Nov", noviembre: "November",
  dic: "Dec", diciembre: "December",
};

export function fechasEnIngles(texto: string): string {
  return texto
    .replace(/\b(\d{1,2})\s+de\s+([a-záéíóú]+)\b/gi, (todo, dia: string, mes: string) => (MESES[mes.toLowerCase()] ? `${dia} ${MESES[mes.toLowerCase()]}` : todo))
    .replace(/(\d{1,2})\s+([a-záéíóú]+)\.?(?![a-záéíóú])/gi, (todo, dia: string, mes: string) => (MESES[mes.toLowerCase()] ? `${dia} ${MESES[mes.toLowerCase()]}` : todo))
    .replace(/(^|[^a-záéíóúñ])(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)(?![a-záéíóúñ])/gi, (_, antes: string, dia: string) => `${antes}${DIAS[dia.toLowerCase()]}`);
}

export const fechasEn = (texto: string, idioma: Idioma) => (idioma === "en" ? fechasEnIngles(texto) : texto);
