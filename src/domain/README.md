# Contratos de dominio

`contracts.ts` define los tipos compartidos. Los módulos de dominio no importarán React, Zustand ni componentes de UI.

## Reglas de implementación

- Todos los tiempos de dominio serán ISO 8601 en UTC. La presentación convertirá a la zona configurada.
- La identidad de cliente usa una cuenta exacta. Operaciones debe cumplir tanto el perímetro de centro de origen como el de cuenta. Las listas vacías no equivalen a acceso global.
- La colección de envíos de `DemoDataset` incluirá activos e históricos. Su estado se derivará de los eventos a la fecha de corte.
- El orden de los tramos y los hitos aplicables definen el recorrido; el modo no introduce hitos que no estén en ese tramo.
- Los eventos conservan la fecha del hecho y la de recepción. La deduplicación usa su ID estable.
- La normalización puede producir varias señales para un evento. Una señal de ETA o incidencia no implica avance físico.
- La condición de una incidencia y el estado de atención son independientes.
- `ShipmentProjection` se calcula desde las mismas entradas para escena y paneles. Las animaciones no la modifican.
- El documento aportado y la liberación aduanera requieren eventos distintos.
- Las recomendaciones y reportes solo usarán evidencias visibles para la identidad activa.
- `ReportMetric.value` será null cuando no exista muestra suficiente; las esperas abiertas se separan de duraciones completadas.
- Cada reporte conservará su revisión del dataset y fecha de corte para detectar resultados que necesitan regenerarse.

## Contratos fijados al cerrar la fase 1

- `DemoDataset` conserva los hechos originales. `referenceTime` es el inicio del reloj; `TrackingState.cutoffAt` es la fecha de corte actual. `revision` aumenta cuando se incorporan eventos nuevos.
- `canViewShipment` aplica cuenta exacta al cliente y la intersección de centros y cuentas a operaciones. Una identidad desconocida o un perímetro vacío no dan acceso.
- `selectVisibleShipments` aplica ese perímetro antes de devolver `ShipmentView[]`. Cada vista reúne el envío, su proyección, sus eventos, ubicaciones, operadores y documentos asociados. Listado, detalle y escena reciben estas vistas, sin consultar el dataset completo.
- `selectSelectedShipment` devuelve `ShipmentView | null` y vuelve a comprobar el perímetro. `selectSummary` deriva activos, entregados, envíos que requieren atención y próximas entregas de las vistas ya autorizadas. Próximas entregas cuenta ETA del operador dentro de las siguientes 24 horas, excluyendo entregados. Atención incluye incidencias, información antigua o ausente, códigos pendientes de clasificar y entregas fuera de plazo. La vista general cuenta además las llegadas de hoy según Europe/Madrid, sin cambiar el contador de próximas 24 horas.
- La escena recibe `shipments`, `selectedId` y `onSelect(id)`. La selección solo contiene el ID del envío. La escena no escribe eventos ni modifica una proyección.
- `shipmentEvents` filtra envío, tramo y operador. Solo incluye hechos ocurridos y recibidos hasta la fecha de corte. Deduplica por ID, conserva la primera copia y ordena por fecha del hecho, con ID como desempate.
- `normalizeEvent` devuelve señales conocidas o un código pendiente de clasificación. La fase 1 incorpora el vocabulario de Vía Cargo, `PICKED_UP`, `ON_ROUTE` y `DELIVERED`. Los siguientes adaptadores ampliarán las señales existentes sin modificar eventos originales.
- `projectShipment` aplica el orden de hitos de cada tramo sin retrocesos. Conserva evidencia y fecha de ETA y ubicación. La fase 1 usa umbrales de 4 horas por carretera y 24 horas por mar para información antigua, excluyendo entregas completadas. La fase 2 ampliará estos umbrales por contexto y completará incidencias y escenarios multimodales.
- `advanceScenario` incorpora los eventos del escenario hasta su último desplazamiento temporal, sin duplicar IDs que ya existen. La fase 1 expone un único avance de dos horas. Reproducir, pausar y avanzar por pasos corresponden a la fase 3.
- `setIdentity` valida el ID y limpia selección y vista. `selectShipment` rechaza IDs ajenos o inexistentes y abre la vista `shipment-detail` si el envío está autorizado. `setView` cambia de sección y limpia la selección. `resetDemo` restaura dataset y reloj sin cambiar la identidad, y vuelve al listado si el detalle estaba abierto. No hay persistencia todavía.

Las métricas históricas, las incidencias y el resto de adaptadores se implementarán en las siguientes fases. Un cambio en estos contratos requiere coordinar a los consumidores antes de seguir en paralelo.

- Las ubicaciones pueden incluir `coordinates` en orden longitud, latitud, y ser centros o puntos de paso `waypoint`. El mapa sitúa los marcadores con las coordenadas de `lastConfirmedLocation`; nunca interpola posiciones entre origen y destino. El escenario nacional confirma un punto de la A-3 mediante su evento `ON_ROUTE`. La selección dentro del mapa es local; `selectShipment` se invoca al abrir el detalle.
- `ShipmentLeg.route` conserva la geometría del itinerario y su fuente. Los trazados por carretera proceden de un motor de rutas; los marítimos deben aportar un itinerario navegable. `mapRoutes` solo devuelve geometrías válidas de envíos activos, con el mismo criterio de atención que los marcadores. Los tramos sin geometría no se sustituyen por líneas entre extremos. La sección de envíos en curso excluye entregados; el listado y el detalle conservan su acceso.
