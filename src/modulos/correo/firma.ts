/* Piezas comunes de los correos que manda la web (sin base de datos: se pueden probar). */

export const FIRMA = "Consejo de Estudiantes de la EPS (UAM)";

/** «Ana García López» → «Ana» (para el saludo). */
export const primerNombre = (nombre: string) => nombre.trim().split(/\s+/)[0];
