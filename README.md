# Atlas · Seguimiento de envíos

Prototipo de seguimiento de envíos para un fabricante. Reúne en una sola vista los envíos por carretera y mar de varios centros y operadores, con una experiencia para operaciones y otra para cada cliente o filial.

Demo: <https://web-production-ebee6c.up.railway.app>

Es solo frontend. Datos, empresas, documentos e identidades son sintéticos. Los resultados de IA proceden de reglas y plantillas locales. El selector de identidad muestra el perímetro de cada rol, pero no protege datos: el dataset completo viaja al navegador.

## Guion de demo

La demo empieza como `Operaciones · Red`, en la fecha actual a las 11:00 (hora de Madrid). Los controles de la barra lateral mueven el reloj bajo cualquier identidad y `Reiniciar` vuelve al inicio.

1. **Gestión por excepción.** En la vista general, la bandeja ordena lo que requiere atención y propone el siguiente paso de cada envío. Abre `ATL-TR-004`, retenido en aduana por falta de un documento.
2. **Copiloto de incidencias.** Revisa la explicación, sus evidencias y el riesgo de retraso. Pulsa `Aportar documento`; después, `Preparar aviso` y `Registrar aviso`, editando el borrador si quieres.
3. **Perímetro.** Cambia a `Cliente · Levante Retail`. Solo aparecen sus envíos, con el aviso en el inicio.
4. **Aviso antes del retraso.** Cambia a `Cliente · Atlántico Industrial` y avanza un paso. Llega `Posible retraso de ATL-IT-003`: una estimación a partir del parte del buque, mientras el operador mantiene su ETA. Al avanzar otro paso, el operador confirma el retraso y la estimación desaparece.
5. **Códigos desconocidos.** Vuelve a `Operaciones · Red` y abre `ATL-ES-005`. En sus eventos, `ZZ-07` tiene una propuesta de clasificación que se puede aceptar sin que el envío avance.
6. **Hechos frente a acciones.** Avanza hasta `Liberación aduanera de ATL-TR-004`. Aportar el documento no liberó el envío; solo lo hace el evento `CUSTOMS_RELEASED` del operador.
7. **Cuellos de botella.** En `Análisis`, genera el reporte y abre los envíos de un hallazgo.

## Desarrollo

Requiere Node.js 22.12 o superior y pnpm 12.15.0.

```sh
pnpm install --frozen-lockfile
pnpm dev        # http://127.0.0.1:5173
pnpm check      # lint, formato y tipos
pnpm test
pnpm build
```

Las pruebas usan fechas fijas y datos reproducibles. Cubren reglas de dominio, perímetro, store, datos del mapa y recorridos de interfaz con jsdom, sustituyendo el renderizador WebGL.

## Estructura

| Ruta                  | Responsabilidad                                                      |
| --------------------- | -------------------------------------------------------------------- |
| `src/app/`            | Composición, layout y navegación                                     |
| `src/domain/`         | Contratos y reglas puras: normalización, proyección, incidencias, IA |
| `src/data/scenarios/` | Dataset sintético, escenarios y trazados                             |
| `src/simulation/`     | Reloj de la demo e incorporación de eventos                          |
| `src/store/`          | Estado con Zustand y persistencia versionada                         |
| `src/features/`       | Vista general, envíos, cliente y análisis                            |
| `src/shared/`         | Componentes de interfaz y utilidades                                 |
| `tests/`              | Pruebas unitarias y de integración, con la misma estructura          |

Las dependencias van en un sentido, `app → features → shared/store → domain`, y Oxlint lo comprueba. Cada funcionalidad expone su API en `index.ts`. Las reglas de dominio están en [src/domain/README.md](src/domain/README.md).

## Despliegue

Railway compila el proyecto con Railpack y sirve `dist`. Cada push a `main` despliega.

## Cartografía

El mapa usa MapLibre GL JS con teselas públicas de [OpenStreetMap](https://operations.osmfoundation.org/policies/tiles/), no aptas para tráfico alto, y contornos de [Natural Earth](https://github.com/nvkelso/natural-earth-vector) como respaldo. Los trazados por carretera proceden de [OSRM](https://project-osrm.org/) y son itinerarios de referencia; los marítimos son sintéticos. Los marcadores muestran la última ubicación confirmada por un evento, sin interpolar posiciones.
