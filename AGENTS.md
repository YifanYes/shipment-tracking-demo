## Proyecto

Atlas es un prototipo solo frontend (React, Vite, Zustand, MapLibre) para seguir envíos por carretera y mar, con vistas de operaciones y de cliente. Datos sintéticos e IA simulada con reglas y plantillas locales. Contexto general y guion de demo en [README.md](README.md).

## Comandos

- `pnpm dev`, `pnpm test`, `pnpm check` (lint, formato y tipos) y `pnpm build`. Ejecutar `pnpm check` y `pnpm test` antes de dar un cambio por terminado.
- El hook de pre-commit ejecuta `pnpm lint && pnpm format:check`.
- Cada push a `main` despliega en Railway.

## Arquitectura

- Las dependencias van en un sentido: `app → features → shared/store → domain`. Oxlint lo comprueba ([.oxlintrc.json](.oxlintrc.json)).
- `src/domain/` contiene reglas puras sin React, Zustand ni MapLibre. Leer [src/domain/README.md](src/domain/README.md) antes de cambiar contratos, normalización, proyección, incidencias o riesgo.
- Cada funcionalidad de `src/features/` agrupa `components/`, `lib/` y sus estilos, y expone su API en `index.ts`; importar desde ahí. Archivos en kebab-case; componentes en PascalCase.
- Los componentes base (shadcn/ui sobre Base UI) están en `src/shared/ui/`; los tokens del tema, en `src/styles/globals.css`.
- El estado y la persistencia versionada están en `src/store/`; el reloj de la demo, en `src/simulation/clock.ts`.
- Los datos y escenarios están en `src/data/scenarios/`, con fechas relativas a `referenceTime`. Si un cambio altera el guion de demo, actualizar el README y `tests/integration/full-demo.test.tsx`.
- Nunca derivar estado, ETA o hitos de la IA ni de las acciones del usuario: solo de eventos del operador.

## Pruebas

- `tests/` replica la estructura de `src/`: `unit/` para dominio, store y componentes; `integration/` para recorridos completos.
- Usar fechas fijas ([tests/support/fixed-date.ts](tests/support/fixed-date.ts)) y los fixtures de `tests/support/`. El mapa WebGL se sustituye por [tests/support/logistics-map-mock.tsx](tests/support/logistics-map-mock.tsx).

## Documentación

- El README, `src/domain/README.md` y la interfaz están en español.

## Textos de la interfaz

- Mostrar solo texto que aporte un dato, identifique un control o ayude a decidir una acción.
- Eliminar frases de relleno, eslóganes y tono promocional. Por ejemplo, "Tu operación, de un vistazo".
- No repetir lo que ya muestran el título, los controles, el mapa o los datos. Evitar subtítulos y etiquetas que no añadan información.
- No añadir contadores secundarios, notas al pie ni instrucciones sobre acciones evidentes.
- Mantener los detalles técnicos y las limitaciones de la demo en la documentación. Mostrarlos en la interfaz solo cuando afecten a una decisión del usuario.
- Dar la información contextual al seleccionar un envío o cuando ocurra un error, en lugar de añadir explicaciones permanentes.
- Escribir en español directo y breve. Cada frase debe justificar el espacio que ocupa.
- Al quitar texto, retirar también los iconos, contenedores y estilos que dejen de tener uso.
- Conservar los nombres accesibles de los controles, los datos necesarios para interpretar el estado y las atribuciones de la cartografía.
