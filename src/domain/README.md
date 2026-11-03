# Contratos de dominio

`contracts.ts` define los tipos compartidos. `visibility.ts` aplica el perímetro de cada identidad, `events.ts` filtra y normaliza eventos, `projection.ts` deriva el estado del envío, `attention.ts` reúne los criterios de atención y llegadas, y `selectors.ts` compone las vistas autorizadas. Los módulos de dominio no importan React, Zustand, MapLibre ni componentes de UI; Oxlint lo comprueba.

## Reglas de implementación

- Todos los tiempos de dominio serán ISO 8601 en UTC. La presentación convertirá a la zona configurada.
- La identidad de cliente usa una cuenta exacta. Operaciones debe cumplir tanto el perímetro de centro de origen como el de cuenta. Las listas vacías no equivalen a acceso global.
- La colección de envíos de `DemoDataset` incluirá activos e históricos. Su estado se derivará de los eventos a la fecha de corte.
- El orden de los tramos y los hitos aplicables definen el recorrido; el modo no introduce hitos que no estén en ese tramo.
- Los eventos conservan la fecha del hecho y la de recepción. La deduplicación usa su ID estable.
- La normalización puede producir varias señales para un evento. Una señal de ETA o incidencia no implica avance físico.
- La condición de una incidencia y el estado de atención son independientes.
- `ShipmentProjection` se calcula desde las mismas entradas para mapa y paneles. Las animaciones no la modifican.
- El documento aportado y la liberación aduanera requieren eventos distintos.
- Las recomendaciones y reportes solo usarán evidencias visibles para la identidad activa.
- `ReportMetric.value` será null cuando no exista muestra suficiente; las esperas abiertas se separan de duraciones completadas.
- Cada reporte conservará su revisión del dataset y fecha de corte para detectar resultados que necesitan regenerarse.

## Contratos fijados al cerrar la fase 1

- `DemoDataset` conserva los hechos originales. `referenceTime` es el inicio del reloj; `TrackingState.cutoffAt` es la fecha de corte actual. `revision` aumenta cuando se incorporan eventos nuevos.
- `canViewShipment` aplica cuenta exacta al cliente y la intersección de centros y cuentas a operaciones. Una identidad desconocida o un perímetro vacío no dan acceso.
- `selectVisibleShipments` aplica ese perímetro antes de devolver `ShipmentView[]`. Cada vista reúne el envío, su proyección, sus eventos, ubicaciones, operadores y documentos asociados. Listado, detalle y mapa reciben estas vistas, sin consultar el dataset completo.
- `selectSelectedShipment` devuelve `ShipmentView | null` y vuelve a comprobar el perímetro. `selectSummary` deriva activos, entregados, envíos que requieren atención y próximas entregas de las vistas ya autorizadas. Próximas entregas cuenta ETA del operador dentro de las siguientes 24 horas, excluyendo entregados. Atención incluye incidencias, información antigua o ausente, códigos pendientes de clasificar y entregas fuera de plazo. La vista general cuenta además las llegadas de hoy según Europe/Madrid, sin cambiar el contador de próximas 24 horas.
- El mapa recibe `shipments`, `selectedId` y `onSelect(id)`. La selección solo contiene el ID del envío. El mapa no escribe eventos ni modifica una proyección.
- `shipmentEvents` filtra envío, tramo y operador. Solo incluye hechos ocurridos y recibidos hasta la fecha de corte. Deduplica por ID, conserva la primera copia y ordena por fecha del hecho, con ID como desempate.
- `normalizeEvent` devuelve señales conocidas o un código pendiente de clasificación. La fase 1 incorpora el vocabulario de Vía Cargo, `PICKED_UP`, `ON_ROUTE` y `DELIVERED`. Los siguientes adaptadores ampliarán las señales existentes sin modificar eventos originales.
- `projectShipment` aplica el orden de hitos de cada tramo sin retrocesos. Conserva evidencia y fecha de ETA y ubicación. La fase 1 usa umbrales de 4 horas por carretera y 24 horas por mar para información antigua, excluyendo entregas completadas. La fase 2 ampliará estos umbrales por contexto y completará incidencias y escenarios multimodales.
- La fase 1 incorporaba el evento de entrega con un único avance de dos horas. La fase 2 lo sustituye por `simulation/clock.ts`, descrito más abajo.
- `setIdentity` valida el ID y limpia selección y vista. `selectShipment` rechaza IDs ajenos o inexistentes y abre la vista `shipment-detail` si el envío está autorizado. `setView` cambia de sección y limpia la selección. `resetDemo` restaura dataset y reloj sin cambiar la identidad, y vuelve al listado si el detalle estaba abierto. No hay persistencia todavía.

Las métricas históricas, las incidencias y el resto de adaptadores se implementarán en las siguientes fases. Un cambio en estos contratos requiere coordinar a los consumidores antes de seguir en paralelo.

- Las ubicaciones pueden incluir `coordinates` en orden longitud, latitud, y ser centros o puntos de paso `waypoint`. El mapa sitúa los marcadores con las coordenadas de `lastConfirmedLocation`; nunca interpola posiciones entre origen y destino. El escenario nacional confirma un punto de la A-3 mediante su evento `ON_ROUTE`. La selección dentro del mapa es local; `selectShipment` se invoca al abrir el detalle.
- `ShipmentLeg.route` conserva la geometría del itinerario y su fuente. Los trazados por carretera proceden de un motor de rutas; los marítimos deben aportar un itinerario navegable. `mapRoutes`, en `src/features/overview/lib/map-data.ts`, solo devuelve geometrías válidas de envíos activos, con el mismo criterio de atención que los marcadores. Los tramos sin geometría no se sustituyen por líneas entre extremos. La sección de envíos en curso excluye entregados; el listado y el detalle conservan su acceso.

## Contratos de la fase 2

- `DemoSeed` reúne el dataset inicial y los escenarios. `data/scenarios/index.ts` exporta `demoSeed`, el dataset completo, y `nationalSeed`, el envío de la fase 1 que conservan sus pruebas. El store recibe una semilla y `resetDemo` vuelve a ella.
- `applyScheduledEvents(dataset, scenarios, cutoffAt)` incorpora los eventos programados liberados hasta la fecha de corte, una sola vez por ID. `DemoSeed.steps` define los pasos con nombre de la demo; `nextDemoStep` devuelve el siguiente y `advanceDemo` mueve el reloj a su hora. Solo operaciones controla la demo.
- El escenario `background-operations` mantiene el resto de envíos activos: completa sus hitos hasta la ETA comunicada, o antes del compromiso si no la hay, y envía avisos de posición cada dos horas como máximo.
- `attentionReasons` ignora los códigos desconocidos superados por un evento conocido posterior del mismo tramo. En un envío entregado solo cuentan las incidencias abiertas.
- `ShipmentProjection.legStages` contiene el hito más avanzado confirmado de cada tramo. Detalle y mapa lo usan en lugar de recalcular hitos.
- `ShipmentView.incidents` contiene las incidencias activas y resueltas de `deriveIncidents`, con IDs estables y evidencias del evento o documento. `projection.incidentIds` contiene solo las activas. La atención de cada incidencia es `unreviewed` hasta las acciones de la fase 3.
- `buildLogisticsReport` recibe vistas ya autorizadas, filtros, fecha de corte y revisión del dataset. Las listas de filtros vacías equivalen a todo lo visible. La fase 2 entrega las métricas; la fase 3, hallazgos y recomendaciones.

### Datos de la fase 2

- `data/scenarios/` separa la red (`network.ts`), las rutas (`routes.ts`), los cinco escenarios, el resto de envíos activos (`active.ts`) y el histórico (`history.ts`). `buildDemoSeed()` es puro: dos construcciones son iguales. El histórico usa un PRNG con semilla fija y fechas relativas a `referenceTime`.
- Los trazados por carretera proceden de OSRM, simplificados a unos 35 m (60 m por encima de 600 km). Los marítimos son itinerarios sintéticos por mar abierto y estrechos. Los envíos históricos no tienen trazado.
- Los eventos programados se reciben exactamente al liberarse (`referenceTime + offsetMinutes`); la fecha del hecho puede ser anterior.

### Vocabularios y normalización

- Cada operador tiene códigos propios y su clave de ETA en `payload`, que siempre se refiere al destino final: Vía Cargo `arrivalAt`, Transportes Cierzo `llegadaPrevista`, Naviera Boreal `eta`, Puente Aduanas `deliveryEta`. Un código o una clave de otro operador queda pendiente de clasificar.
- Un evento de solo ETA sin fecha válida queda pendiente de clasificar.
- En la última milla con aduana, `CUSTOMS_RELEASED` pasa el tramo de `customs` a `collected`: mercancía liberada para el transportista. Es el único evento que sale de aduana.

### Proyección

- La antigüedad se mide desde el último evento conocido, por fecha del hecho. Los códigos desconocidos no la renuevan. Umbrales: carretera 4 h, puerto o espera entre tramos en un puerto 24 h, buque navegando 36 h, aduana 48 h. Un envío entregado siempre está al día.
- ETA: la última del operador, salvo que haya vencido sin entrega o que una retención se haya abierto después de emitirla. Sin ETA del operador, se estima un intervalo solo con el buque navegando, información al día, trazados disponibles y sin aduana pendiente (14–18 nudos, 6–24 h de puerto, 60–75 km/h). En otro caso, `unavailable` con el motivo.

### Incidencias

- Retraso: aviso del operador, ETA posterior al compromiso o compromiso vencido sin entrega (`incident-<envío>-overdue`). Se resuelve con la entrega o con una ETA posterior dentro del plazo, antes de que venza. Severidad alta si supera 24 h o el plazo ha vencido.
- Aduana y retención en terminal: abiertas y resueltas solo por los eventos de retención y liberación. Aduana tiene severidad alta.
- Documento pendiente: un documento `missing` del envío, o uno solicitado por `DOC_REQUIRED` (`payload.documentId`) antes de aportarse. Se resuelve en `uploadedAt`, sin liberar la aduana. Alta mientras la aduana siga retenida.
- Información antigua: solo mientras dura; no se reconstruyen episodios pasados.
- IDs: `incident-<evento>-<tipo>`, `incident-<documento>-missing`, `incident-<envío>-stale-<último evento>`. La atención siempre es `unreviewed`.

### Métricas del reporte

- Un envío entra en el periodo si se creó entre `from` y `to`. El filtro de operadores incluye envíos con algún tramo suyo. Las duraciones se calculan desde los eventos de cada vista.
- Las duraciones completadas requieren 3 observaciones; las esperas abiertas (`-open`) se muestran desde 1 y miden hasta la fecha de corte.
- `delays`: `delayed-shipments`, `on-time-rate` y `average-delay` sobre entregados, y `overdue-open` sobre envíos en curso.
- `legs`: `leg-duration:<modo>`, del primer hito confirmado a la finalización del tramo.
- `ports`: `port-dwell:<puerto>`, de la entrada en terminal a la salida del buque.
- `customs`: `customs-time:<puerto>`, de la declaración a la liberación.
- `sites`: `site-pickup:<centro>`, de la creación a la recogida.
- `operators`: `operator-transit:<operador>`, horas de movimiento por cada 100 km en línea recta, en tramos de al menos 50 km.
- `limitations` enumera envíos sin eventos, envíos con códigos pendientes y métricas sin muestra suficiente.
