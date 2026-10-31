# Atlas · Seguimiento de envíos y análisis logístico

Atlas reúne el seguimiento de envíos por carretera y mar en una red logística 3D. Permite a operaciones gestionar incidencias y detectar cuellos de botella, mientras cada cliente consulta el estado, la llegada prevista y los documentos de sus envíos.

El alcance completo y el reparto del trabajo están en [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md).

## Estado actual

Fases 0 y 1 completadas. El primer recorrido incluye un envío nacional Madrid → Valencia, un selector de dos identidades, listado y detalle conectados con el vehículo de la escena 3D, y un evento reproducible de entrega.

Las vistas tienen un título compacto en la barra superior. La sidebar se puede colapsar desde un control exterior y el logotipo SVG de Atlas se utiliza también como favicon. Los breadcrumbs se incorporarán en páginas con jerarquía, como el detalle de un envío.

La identidad de operaciones puede consultar el envío. El cliente de otra cuenta ve su cartera vacía. El mismo selector de visibilidad limita detalle, escena y contadores, también al abrir un identificador por URL. El histórico, las incidencias, los documentos y los reportes se incorporarán en las fases siguientes.

## Recorrido de la fase 1

1. Entrar como `Operaciones Madrid`. El reloj empieza el 31 de octubre de 2026 a las 11:00 en Madrid.
2. Seleccionar el vehículo `ATL-ES-001` o el envío del listado. Ambos abren su página de detalle, con tarjetas de seguimiento, recorrido y una timeline vertical de eventos del operador. `Volver a envíos` regresa al listado.
3. Pulsar `Confirmar entrega · +2 h`. El reloj avanza a las 13:00 y recibe el evento `DELIVERED`. Cambian a la vez el vehículo, el detalle, el listado y los contadores.
4. Cambiar a `Cliente · Levante Retail`. Desaparecen la selección y el envío ajeno, incluidos ruta y contadores. Volver a operaciones permite consultar la entrega.
5. Pulsar `Reiniciar` para restaurar los datos y el reloj iniciales.

El estado vive en memoria. Recargar restaura el escenario y la identidad iniciales; la persistencia versionada corresponde a la fase 3. El listado tiene la ruta `/shipments` y el detalle `/shipments/shipment-es-001`. Se puede recargar un enlace directo y navegar con Atrás y Adelante. Los enlaces anteriores con `?shipment=shipment-es-001` redirigen a la nueva ruta. Los identificadores no autorizados se descartan con la identidad activa, también desde el historial.

La posición del camión es ilustrativa. La última ubicación confirmada solo cambia con un evento del operador y aparece por separado en el detalle, con fuente y fecha. La fecha comprometida y la ETA también se muestran por separado. Las horas de la interfaz usan `Europe/Madrid`.

## Desarrollo

Requiere Node.js 22.12 o superior y pnpm 12.15.0. La versión de pnpm está fijada en `package.json`.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Vite sirve la aplicación en una dirección local. El puerto predeterminado es 5173.

## Comprobaciones

```sh
pnpm check
pnpm test
pnpm build
pnpm preview
```

Vitest tiene 13 pruebas de dominio y recorrido de interfaz. Comprueban perímetro, selección, códigos desconocidos, orden y duplicados, fecha de corte, antigüedad de información, ETA, entrega y reinicio. Las pruebas de interfaz usan jsdom y sustituyen WebGL por el contrato de entradas y selección de la escena. El renderizado y la selección del vehículo real se han comprobado además en navegador.

## Lint, formato y commits

Oxlint comprueba TypeScript, React y accesibilidad JSX. Los errores y avisos bloquean el chequeo. La configuración usa la transformación JSX automática de React y permite las propiedades y los objetos mutables propios de Three.js únicamente en la escena 3D.

Prettier aplica un formato común al código, estilos, configuración y documentación, con dos espacios, comillas simples en JavaScript y TypeScript y sin punto y coma.

```sh
pnpm lint
pnpm lint:fix
pnpm format
pnpm format:check
```

`pnpm check` ejecuta lint, comprobación de formato y comprobación de tipos. `pnpm install` activa Husky mediante el script `prepare` cuando el proyecto está en un repositorio Git.

El hook `pre-commit` ejecuta `pnpm lint` y `pnpm format:check` sobre el proyecto completo. Si alguno falla, el commit se cancela. El hook comprueba los archivos sin modificarlos; usa `pnpm format` y `pnpm lint:fix` para corregir los problemas antes de volver a preparar el commit.

## Estructura inicial

| Ruta                    | Responsabilidad                                      |
| ----------------------- | ---------------------------------------------------- |
| src/app/                | Composición y navegación del espacio de trabajo      |
| src/components/ui/      | Componentes shadcn/ui sobre Base UI                  |
| src/domain/             | Contratos y reglas compartidas                       |
| src/data/               | Dataset sintético y escenario nacional reproducible  |
| src/simulation/         | Avance del escenario e incorporación de eventos      |
| src/features/shipments/ | Listado, detalle y presentación del seguimiento      |
| src/scene/              | Modelos, cámara y contención de errores de WebGL     |
| src/store/              | Dataset, reloj, identidad y selección con Zustand    |
| src/styles/             | Tokens, estilos globales y utilidades de componentes |

Los tipos compartidos están en `src/domain/contracts.ts`. Las convenciones y reglas de interpretación están en `src/domain/README.md`. Los módulos de dominio no dependerán de React ni de la escena.

## Componentes y estilos

Se ha inicializado el preset Nova de shadcn/ui con Base UI. El código de los componentes vive en el proyecto. La tipografía Geist se sirve desde los recursos locales del build.

La CLI de shadcn se utilizó para generar los componentes y se retiró después con su comando oficial `eject`. Sus utilidades CSS se conservan en `src/styles/globals.css`. Esto mantiene el código generado y evita conservar la CLI y sus dependencias como parte del proyecto.

Para incorporar un componente adicional con la misma versión de la herramienta:

```sh
pnpm dlx shadcn@4.23.0 add dialog
```

La configuración está en `components.json`. Los estilos específicos de producto deben mantener la coherencia entre paneles y escena.

## Vercel

`vercel.json` configura Vite, el directorio `dist` y la recarga de rutas de la aplicación. No hay backend, base de datos ni secretos de aplicación.

No se ha encontrado una sesión local de Vercel ni un proyecto enlazado durante la fase 0. El despliegue y su verificación pública pertenecen a la fase 5 y requieren acceso a la cuenta correspondiente.

## Verificación de la fase 0

- Comprobación de tipos y build de producción correctos.
- Navegación entre vista general, envíos y análisis comprobada sobre el build.
- Escena 3D renderizada en escritorio y móvil.
- Vista móvil de 390 píxeles de ancho sin desbordamiento horizontal.
- Cabeceras compactas revisadas también a 320 píxeles, con un único h1 por vista y título de pestaña según la sección.
- Colapsado de la sidebar comprobado en escritorio y móvil; control accesible desde la cabecera del contenido.
- Configuración de Vitest cargada con `pnpm exec vitest list --passWithNoTests`. Este chequeo confirma la configuración y no sustituye las futuras pruebas de negocio.
- Cero vulnerabilidades en la revisión de dependencias realizada durante la fase 0.
- Consola sin errores de ejecución. Three.js emite un aviso de depreciación de `Clock`, utilizado por React Three Fiber.
- El build informa de un fragmento 3D de unos 925 kB sin comprimir y 245 kB comprimido. La escena ya se carga de forma diferida; se revisará el tamaño durante la fase de rendimiento.

## Verificación de la fase 1

- `pnpm check`, `pnpm test` y `pnpm build` correctos.
- Trece pruebas automatizadas en dos archivos, con fechas fijas y sin esperas de reloj real.
- Build de producción inspeccionado en navegador, con selección desde el vehículo y el listado, entrega sincronizada, cambio de identidad y reinicio.
- Listado y detalle revisados a 320 píxeles; ancho del documento igual al viewport, sin desbordamiento horizontal.
- Sin errores de ejecución observados. Continúa el aviso de depreciación de `THREE.Clock` de la base y el aviso de tamaño del fragmento 3D, ahora de unos 935 kB sin comprimir y 248 kB comprimido.

Los escenarios multimodales, la alternativa sin WebGL y la publicación todavía requieren sus comprobaciones de las fases posteriores.

La revisión de los criterios de cierre está documentada en `IMPLEMENTATION_PLAN.md`. El siguiente trabajo es la fase 2, con los contratos y límites de archivos acordados antes de delegar.
