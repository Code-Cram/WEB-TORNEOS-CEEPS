# Colaborar en la web de torneos

Esta guía es para quien quiere cambiar la web: arreglar algo, añadir una función o adaptarla a otra asociación. Lo que no necesita código (avisos, textos, páginas, logos, colores, horarios, admins) se cambia desde el propio panel (**🎨 Web**, **🔑 Acceso** y la página de cada torneo): mira el [README](README.md).

## 1. Ponerla en marcha

Todo con **datos inventados**: los datos reales de los participantes nunca están en el repositorio.

### Sin instalar nada (GitHub Codespaces)

1. En GitHub, **Code → Codespaces → Create codespace on main**.
2. Espera a que termine de prepararse: instala todo, crea la base de datos y la llena con participantes inventados (`npm run preparar`).
3. Escribe `npm run dev` en la terminal y abre el puerto 3000 cuando te lo ofrezca.

### En tu ordenador

Necesitas [Node.js](https://nodejs.org) 22 o superior y PostgreSQL (con [Docker](https://www.docker.com) basta: `npm run db:up`).

```bash
git clone <dirección del repositorio>
cd <carpeta>
npm install
npm run db:up      # solo con Docker: PostgreSQL en el puerto 5433
npm run preparar   # crea .env.local, las tablas, las migraciones y los datos inventados
npm run dev        # http://localhost:3000
```

`preparar` usa el PostgreSQL que encuentre (el del sistema o el de Docker). Con el del sistema, antes hay que crear el usuario y la base de datos: mira [Probarla en tu ordenador](README.md#probarla-en-tu-ordenador).

### Entrar

- Como admin: `admin@example.com` y, al pulsar «Admin», la contraseña del panel `demo`.
- Como participante: cualquier correo inventado, por ejemplo `ana.prueba0@example.com` (capitana de «Los Rayos de Prueba»). Los demás salen en el panel, en **Personas**.

`npm run preparar` se puede repetir sin miedo: lo que ya existe se queda. Para empezar de cero, vacía la base de datos (con Docker: `docker compose down -v` y otra vez `npm run db:up`).

## 2. Hacer un cambio

1. Crea una rama: `git switch -c mi-cambio`.
2. Haz el cambio. El código está organizado por apartados (`src/modulos/<apartado>/`), cada fichero con un papel fijo: está explicado en [Cómo está organizado el código](README.md#cómo-está-organizado-el-código).
3. Comprueba que todo sigue bien: `npm run comprobar` (lint, tipos y pruebas) y pruébalo con `npm run dev`.
4. Sube la rama y abre un **pull request** en GitHub. Las comprobaciones se pasan solas (lint, tipos, pruebas, una base de datos desde cero con todas las migraciones, y el build): espera a que salgan en verde.
5. Quien mantiene la web lo revisa y lo fusiona. Al fusionarlo, se publica solo en Vercel (y Vercel aplica las migraciones nuevas en la base de datos de producción).

## 3. Reglas del proyecto

- **Nada de datos reales** en el repositorio: ni nombres, ni correos, ni teléfonos de participantes (tampoco en pruebas, capturas ni ejemplos). Para ejemplos, `@example.com`.
- **Cambios en la base de datos**: un fichero nuevo en `sql/`, con nombre `AAAA-MM-DD-que-cambia.sql`, que se pueda ejecutar más de una vez (`IF NOT EXISTS`, rellenar solo lo vacío…) y que no borre nada (lo que borra va en `sql/a-mano/` y se aplica a mano). El mismo cambio, también en `src/db/schema.ts`.
- **Textos para los participantes**: en español, con `t("…")`, y su traducción en `src/modulos/idioma/en.ts` (`npm test` avisa si falta alguna). El panel va solo en español.
- **Lógica sin base de datos** en `logica.ts` (o parecidos), con su prueba en `tests/`; las consultas, en `datos.ts`; las acciones del panel comprueban siempre `exigirAdmin()`.
- Al navegador nunca le llegan correos ni teléfonos (ver `tipos.ts` de cada apartado).
- Código y comentarios en español, explicando el porqué. Mira cómo está hecho lo de alrededor y sigue igual.

## 4. Acceso a la web publicada

- **Al panel**: pídele a un admin que te añada en **🔑 Acceso** y que te dé la contraseña del panel (por un canal privado).
- **Con tu asistente de IA**: en **🔑 Acceso → Acceso para IA**, crea tu clave y conecta tu asistente a la web (las instrucciones están allí).
- La base de datos de producción y Vercel no hacen falta para colaborar: con los datos inventados tienes la web entera.

## 5. Para quien mantiene el repositorio (una sola vez)

- **Colaboradores**: GitHub → *Settings → Collaborators* → *Add people*.
- **Proteger `main`**: *Settings → Branches → Add rule* para `main`: pedir pull request y que pase la comprobación **Comprobar**.
- **Fusionar siempre con «Create a merge commit»** (en *Settings → General*, desactiva *squash* y *rebase*). En el plan gratis de Vercel solo se publican los commits de quien es dueño de la cuenta: el commit de la fusión es suyo y se publica; los de otras personas, no. Si alguna vez no se publica, basta con un commit suyo: `git commit --allow-empty -m "Publicar" && git push`.
- **Vistas previas de Vercel** (una por pull request): no les pongas la `DATABASE_URL` de producción. O no pongas variables de *Preview* (no se generan), o apúntalas a otra base de datos de Supabase.
