/** Dirección pública de la web (para enlaces en correos y redes). En Vercel la da el propio despliegue. */
export const urlWeb = () => `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL || "web-torneos-ceeps.vercel.app"}`;
