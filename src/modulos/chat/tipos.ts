
/** Un mensaje del chat tal como lo ve quien lo lee (sin correos). */
export type MensajeVista = {
  id: number;
  /** El nombre de la inscripción, o «Consejo». */
  nombre: string;
  /** Equipo, pareja o mesa de quien lo escribe. */
  unidad: string | null;
  deConsejo: boolean;
  /** Lo ha escrito quien lo lee (puede borrarlo). */
  mio: boolean;
  /** Aviso del Consejo para todos los del torneo, no solo para un día. */
  paraTodos: boolean;
  /** Null si se ha borrado. */
  texto: string | null;
  creadoEn: string;
};

/** Lo que ve un participante en su chat: su sala del día, su conversación con el Consejo y lo que no ha leído. */
export type DatosChat = { publico: MensajeVista[]; privado: MensajeVista[]; noLeidos: number; dia: string | null };
