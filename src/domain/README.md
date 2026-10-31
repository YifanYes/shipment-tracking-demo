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

Las funciones de visibilidad, reducción de eventos, métricas y simulación se implementarán en las siguientes fases. Un cambio en estos contratos requiere coordinar a los consumidores antes de seguir en paralelo.
