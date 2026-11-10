import Image from "next/image";

/** Fila de logos institucionales: UAM | EPS | Consejo. */
export function Logos({ claro = false }: { claro?: boolean }) {
  const sep = claro ? "bg-crema/40" : "bg-tinta/20";
  return (
    <div className="flex items-center justify-center gap-4">
      <Image src="/marca/uam.svg" alt="Universidad Autónoma de Madrid" width={60} height={33} className={claro ? "brightness-0 invert" : ""} />
      <span aria-hidden className={`h-8 w-px ${sep}`} />
      <Image src="/marca/eps.svg" alt="Escuela Politécnica Superior" width={66} height={32} className={claro ? "brightness-0 invert" : ""} />
      <span aria-hidden className={`h-8 w-px ${sep}`} />
      <Image src="/marca/ceeps.svg" alt="Consejo de Estudiantes EPS" width={34} height={34} />
    </div>
  );
}
