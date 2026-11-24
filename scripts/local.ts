/** ¿Es una base de datos de desarrollo? En el ordenador (localhost) o en el contenedor de Codespaces («db»). */
export const esLocal = (url: string) => /@(localhost|127\.0\.0\.1|db)[:/]/.test(url);
