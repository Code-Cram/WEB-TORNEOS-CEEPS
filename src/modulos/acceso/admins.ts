

/**
 * Mesa de portavoces: correos separados por comas en la variable de entorno ADMIN_EMAILS.
 * Solo ellos ven el botón «Admin» y pueden entrar al panel (además necesitan la contraseña ADMIN_PASSWORD).
 */
export function esCorreoAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  const admins = (process.env.ADMIN_EMAILS ?? "").split(",").map((c) => c.trim().toLowerCase());
  return admins.includes(email.toLowerCase());
}
