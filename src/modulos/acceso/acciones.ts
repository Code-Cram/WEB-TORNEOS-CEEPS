"use server";

import { redirect } from "next/navigation";
import { esCorreoAdmin } from "@/modulos/acceso/admins";
import { buscarParticipante, enReservaSinAcceso } from "@/modulos/acceso/inscripciones";
import { cerrarSesion, iniciarSesion } from "@/modulos/acceso/sesion";
import { limpiarNombre, normalizarCorreo } from "@/modulos/compartido/texto";

export type EstadoEntrar = { error?: string; nombre?: string; correo?: string };

export async function entrar(_prev: EstadoEntrar, formData: FormData): Promise<EstadoEntrar> {
  const nombre = limpiarNombre(String(formData.get("nombre") ?? "").slice(0, 200)).slice(0, 40);
  const correo = String(formData.get("correo") ?? "")
    .trim()
    .slice(0, 200);
  if (!nombre) return { error: "Dinos cómo quieres que te llamemos.", nombre, correo };
  const email = normalizarCorreo(correo).email;
  if (!email) return { error: "Escribe tu correo institucional (nombre.apellido@estudiante.uam.es).", nombre, correo };

  let encontrado: Awaited<ReturnType<typeof buscarParticipante>>;
  let enReserva = false;
  try {
    encontrado = await buscarParticipante(email);
    if (!encontrado) enReserva = await enReservaSinAcceso(email);
  } catch (e) {
    console.error(e);
    return { error: "No hemos podido comprobar tu correo ahora mismo. Inténtalo de nuevo en un momento.", nombre, correo };
  }
  if (!encontrado && !esCorreoAdmin(email) && enReserva)
    return {
      error: "Estás en la lista de reserva del póker: de momento no tienes plaza. Si se libera alguna, el Consejo te avisará por correo.",
      nombre,
      correo,
    };
  if (!encontrado && !esCorreoAdmin(email))
    return {
      error: "Este correo no aparece en ningún torneo. Revisa que sea el mismo con el que te inscribiste; si te acabas de apuntar, puede tardar un poco en aparecer.",
      nombre,
      correo,
    };

  await iniciarSesion({ email: encontrado?.usuario.email ?? email, nombre });
  redirect("/torneos");
}

export async function salir() {
  await cerrarSesion();
  redirect("/");
}
