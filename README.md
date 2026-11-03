# Atlas · Seguimiento de envíos y análisis logístico

Atlas reúne el seguimiento de envíos por carretera y mar en un mapa operativo. Permite a operaciones gestionar incidencias y detectar cuellos de botella, mientras cada cliente consulta el estado, la llegada prevista y los documentos de sus envíos.

El alcance completo y el reparto del trabajo están en [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md).

## Estado actual

Fases 0, 1 y 2 completadas. La fase 2 incorpora 174 envíos sintéticos (24 activos), cinco escenarios multimodales, incidencias, documentos, vistas de cliente y la estructura del reporte; el detalle está en `IMPLEMENTATION_PLAN.md`. Las pruebas del recorrido de la fase 1 usan `nationalSeed`.

Fase 1: El primer recorrido incluye un envío nacional Madrid → Valencia, un selector de dos identidades, listado y detalle conectados con el mapa de ubicaciones confirmadas, y un evento reproducible de entrega.

Las vistas tienen un título compacto en la barra superior. La sidebar se puede colapsar desde un control exterior y el logotipo SVG de Atlas se utiliza también como favicon. Los breadcrumbs se incorporarán en páginas con jerarquía, como el detalle de un envío.

La identidad de operaciones puede consultar el envío. El cliente de otra cuenta ve su cartera vacía. El mismo selector de visibilidad limita detalle, mapa y contadores, también al abrir un identificador por URL. El histórico, las incidencias, los documentos y los reportes se incorporarán en las fases siguientes.

## Recorrido de la fase 1

1. Entrar como `Operaciones Madrid`. El reloj empieza el 31 de octubre de 2026 a las 11:00 en Madrid.
2. Seleccionar el marcador `ATL-ES-001` o su fila bajo el mapa y pulsar `Abrir detalle`, o abrir el envío desde el listado. Se abre su página de detalle, con tarjetas de seguimiento, recorrido y una timeline vertical de eventos del operador. `Volver a envíos` regresa al listado.
3. Pulsar `Entrega de ATL-ES-001` en el escenario de la fase 1 (en la demo completa, los pasos se describen en `IMPLEMENTATION_PLAN.md`). El reloj avanza a las 13:00 y recibe el evento `DELIVERED`. Cambian a la vez el mapa, el detalle, el listado y los contadores. El envío sale del mapa de envíos en curso y sigue disponible en el listado y el detalle.
4. Cambiar a `Cliente · Levante Retail`. Desaparecen la selección y el envío ajeno, incluidos ruta y contadores. Volver a operaciones permite consultar la entrega desde el listado.
5. Pulsar `Reiniciar` para restaurar los datos y el reloj iniciales.

El estado vive en memoria. Recargar restaura el escenario y la identidad iniciales; la persistencia versionada corresponde a la fase 3. El listado tiene la ruta `/shipments` y el detalle `/shipments/shipment-es-001`. Se puede recargar un enlace directo y navegar con Atrás y Adelante. Los enlaces anteriores con `?shipment=shipment-es-001` redirigen a la nueva ruta. Los identificadores no autorizados se descartan con la identidad activa, también desde el historial.

El mapa muestra la última ubicación confirmada por un evento del operador, sin interpolar una posición del vehículo. ATL-ES-001 empieza en la A-3, a la altura de Perales de Tajuña, con una posición sintética incluida en su evento `ON_ROUTE`. Mapa, lista y detalle consumen esa misma ubicación y conservan su fuente y fecha. Las coordenadas del escenario son referencias de la demo, no un seguimiento GPS real. La fecha comprometida y la ETA también se muestran por separado. Las horas de la interfaz usan `Europe/Madrid`.

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

Vitest ejecuta las pruebas de `tests/`: reglas de dominio, store, datos del mapa y recorridos de interfaz. Comprueban perímetro, selección, códigos desconocidos, orden y duplicados, fecha de corte, antigüedad de información, ETA, entrega y reinicio. Las pruebas de interfaz usan jsdom y sustituyen el renderizador WebGL por el contrato de entradas y selección del mapa. El renderizado y la selección del vehículo real se han comprobado además en navegador.

## Lint, formato y commits

Oxlint comprueba TypeScript, React y accesibilidad JSX. Los errores y avisos bloquean el chequeo. La configuración usa la transformación JSX automática de React.

Prettier aplica un formato común al código, estilos, configuración y documentación, con dos espacios, comillas simples en JavaScript y TypeScript y sin punto y coma.

```sh
pnpm lint
pnpm lint:fix
pnpm format
pnpm format:check
```

`pnpm check` ejecuta lint, comprobación de formato y comprobación de tipos. `pnpm install` activa Husky mediante el script `prepare` cuando el proyecto está en un repositorio Git.

El hook `pre-commit` ejecuta `pnpm lint` y `pnpm format:check` sobre el proyecto completo. Si alguno falla, el commit se cancela. El hook comprueba los archivos sin modificarlos; usa `pnpm format` y `pnpm lint:fix` para corregir los problemas antes de volver a preparar el commit.

## Estructura

| Ruta                    | Responsabilidad                                                     |
| ----------------------- | ------------------------------------------------------------------- |
| src/app/                | Composición, layout (sidebar y barra superior) y navegación         |
| src/domain/             | Contratos y reglas: visibilidad, eventos, proyección y atención     |
| src/data/scenarios/     | Dataset sintético, escenario nacional y trazados de rutas           |
| src/simulation/         | Avance del escenario e incorporación de eventos                     |
| src/store/              | Dataset, reloj, identidad y selección con Zustand                   |
| src/features/overview/  | Métricas, mapa operativo, selección y panel de atención             |
| src/features/shipments/ | Listado, detalle y presentación del seguimiento                     |
| src/shared/             | Componentes shadcn/ui, formato de fechas y estados, utilidades      |
| src/styles/             | Tema, tokens y estilos base comunes                                 |
| tests/unit/             | Pruebas de dominio, store, funcionalidades y utilidades compartidas |
| tests/integration/      | Recorridos de la aplicación con jsdom                               |
| tests/support/          | Fixtures y sustitutos compartidos por las pruebas                   |

Convenciones:

- Los archivos usan kebab-case; los componentes exportados, PascalCase.
- Cada funcionalidad agrupa `components/`, `lib/` y sus estilos, y expone su API pública en `index.ts`. Fuera de la funcionalidad solo se importa ese `index.ts`.
- Las dependencias van en un sentido: `app → features → shared/store → domain`. `domain`, `data` y `simulation` no importan React, Zustand, MapLibre ni capas superiores; `shared` no importa funcionalidades, store ni app. Oxlint hace cumplir estas reglas con `no-restricted-imports`.
- Las pruebas viven en `tests/` y replican la ruta del código que comprueban. Importan el código con `@/` y el soporte con `@tests/`. `tsconfig.test.json` incluye las pruebas en `pnpm typecheck`.

Los tipos compartidos están en `src/domain/contracts.ts`. Las convenciones y reglas de interpretación están en `src/domain/README.md`.

## Componentes y estilos

Se ha inicializado el preset Nova de shadcn/ui con Base UI. El código de los componentes vive en el proyecto. La tipografía Geist se sirve desde los recursos locales del build.

La CLI de shadcn se utilizó para generar los componentes y se retiró después con su comando oficial `eject`. Sus utilidades CSS se conservan en `src/styles/globals.css`. Esto mantiene el código generado y evita conservar la CLI y sus dependencias como parte del proyecto.

Para incorporar un componente adicional con la misma versión de la herramienta:

```sh
pnpm dlx shadcn@4.23.0 add dialog
```

La configuración está en `components.json`. Los estilos específicos de producto deben mantener la coherencia entre paneles y mapa.

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

Revisión del 2 de noviembre de 2026, con el mapa de MapLibre y la estructura actual:

- `pnpm check`, `pnpm test` (22 pruebas en 6 archivos) y `pnpm build` correctos.
- Build de producción revisado en escritorio y a 390 píxeles: selección desde el marcador real y desde el listado, entrega sincronizada, cambio de identidad, enlace directo ajeno rechazado y reinicio. Sin desbordamiento horizontal ni errores de consola.
- Los avisos de Three.js ya no aplican. El build avisa del tamaño del fragmento diferido de MapLibre, de unos 1,08 MB sin comprimir.

Los escenarios multimodales, la alternativa sin WebGL y la publicación todavía requieren sus comprobaciones de las fases posteriores.

La revisión de los criterios de cierre está documentada en `IMPLEMENTATION_PLAN.md`. El siguiente trabajo es la fase 2, con los contratos y límites de archivos acordados antes de delegar.

## Mapa operativo de la vista general

La vista general utiliza MapLibre GL JS y muestra solo envíos pendientes de entrega, con su número junto al título. Cada envío aparece como un punto del color de la leyenda en su última ubicación confirmada. Las rutas de los envíos activos se dibujan desde el inicio; al seleccionar un punto, una fila o una incidencia, su ruta destaca y aparece una ficha con llegada prevista, fuente, fecha y antigüedad. El control de pantalla completa amplía el mapa con su leyenda y atribución; se cierra con su botón o Escape y devuelve el foco al control. Si el navegador no admite pantalla completa nativa, MapLibre amplía el mapa al viewport.

Las agrupaciones de marcadores muestran el número de envíos y cuántos necesitan atención. Al abrirlas, el mapa amplía la zona y la lista muestra los envíos del grupo. Los envíos sin coordenadas conservan su acceso desde la lista. El contador de atención, sus tarjetas y los marcadores comparten los mismos criterios: incidencias, información antigua o ausente, eventos sin clasificar y entregas fuera de plazo. El contador de llegadas de hoy usa el día natural de Europe/Madrid.

La cartografía detallada utiliza las teselas públicas de OpenStreetMap, con atribución visible y sin clave de acceso. Su servicio público está sujeto a su [política de uso](https://operations.osmfoundation.org/policies/tiles/); antes de una publicación con tráfico se debe configurar un proveedor adecuado. El fondo local `public/map-land.geojson` contiene los contornos de países de Natural Earth 1:110m, de dominio público, sin Antártida y sin propiedades. Procede de [Natural Earth](https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_admin_0_countries.geojson) y mantiene el contexto geográfico si fallan las teselas. La lista permanece disponible si no hay WebGL. El proceso de MapLibre se empaqueta con Vite mediante `?worker&url` para servirlo localmente también en producción.

El trazado Madrid → Valencia de `src/data/scenarios/routes/madrid-valencia.json` se obtuvo del [servicio de rutas OSRM](https://project-osrm.org/docs/v26.6.1/http) sobre OpenStreetMap, con geometría completa y simplificación de unos 35 metros para reducir el tamaño. Se guarda en el proyecto para evitar peticiones a un servicio público al abrir la aplicación. La ruta conserva el punto de Perales de Tajuña. Es un itinerario de referencia por carretera, no una ruta certificada para camiones ni un recorrido GPS observado.

Cada `ShipmentLeg.route` admite coordenadas de un trazado y su fuente. En carretera deben proceder de un motor de rutas; en mar, de un itinerario marítimo del operador que respete costas y pasos navegables. El mapa dibuja esas coordenadas sin conectar centros mediante rectas. Si un tramo no tiene geometría válida, conserva el marcador y el acceso al detalle, sin inventar un trazado. Los tramos marítimos usan itinerarios sintéticos del operador que evitan costas y pasan por el estrecho de Gibraltar. El seguimiento GPS en directo requiere integrar una fuente de posiciones del transportista.
