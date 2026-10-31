# Plan de implementación

Fecha del acuerdo: 31 de octubre de 2026.

## Objetivo

Construir una demo de seguimiento logístico con dos experiencias, operaciones internas y cliente o filial. El producto consolidará envíos de varios centros y operadores, por carretera y mar, con información fiable sobre hitos, incidencias, documentos y ETA.

La experiencia principal será una torre de control con una red logística 3D isométrica. Fábricas, almacenes, puertos, camiones y barcos permitirán explorar los mismos envíos que aparecen en los paneles y listados.

Referencia visual: [publicación de Dilum Sanjaya](https://x.com/DilumSanjaya/status/2106426962738880879). Se toma como referencia de cámara, geometría estilizada y paneles flotantes. La demo desarrollará su propio diseño y una red de transporte completa.

## Decisiones acordadas

- Aplicación exclusivamente frontend, sin backend, base de datos ni integraciones reales.
- Datos, empresas, centros, operadores, documentos e identidades sintéticos.
- Publicación final en Vercel.
- IA centrada en explicar y resolver incidencias, con evidencias y siguientes acciones.
- Reporte de IA para detectar cuellos de botella y proponer optimizaciones logísticas.
- Consulta conversacional aplazada a una ampliación posterior. No se construirá una interfaz de chat en este alcance.
- Los resultados de IA procederán de reglas y plantillas locales. La interfaz no incluirá avisos de "IA simulada", por decisión del usuario.
- Estados, ETA y recomendaciones conservarán sus fuentes, fechas y límites. La ausencia de datos se mostrará explícitamente.
- Interfaz basada en shadcn/ui sobre Base UI y Tailwind, con diseño propio para la escena y los componentes logísticos.
- La implementación podrá usar subagentes. Se definen responsabilidades y dependencias antes de paralelizar.

## Experiencia de producto

### Espacio 3D

Una red esquemática reunirá tres centros de origen, carreteras, dos puertos, un tramo marítimo y destinos. Permitirá acercar, desplazar y orientar la cámara con límites que mantengan la escena legible. Seleccionar un centro o vehículo filtrará o abrirá la información asociada. Seleccionar un envío en el listado resaltará su recorrido y enfocará la escena.

Los modelos se construirán inicialmente con geometría sencilla. Se usarán colores y formas consistentes, sombras suaves y paneles HTML superpuestos. Las animaciones ilustrarán el tramo activo; la última ubicación confirmada mostrará su propia fuente y fecha. Una animación nunca aportará una ubicación confirmada nueva.

Habrá una vista de lista completa y una alternativa si WebGL no está disponible. En móvil se dará prioridad al listado y al detalle. Se respetará la preferencia de movimiento reducido y las acciones importantes estarán disponibles con teclado.

### Operaciones

- Cartera de envíos limitada a los centros y cuentas asignados.
- Bandeja de incidencias priorizada por impacto, urgencia y disponibilidad de información.
- Búsqueda y filtros por centro, cuenta, operador, modo, progreso y riesgo.
- Detalle de cada envío con tramos, hitos, documentos, eventos originales y estados normalizados.
- Recomendaciones con evidencias y acción propuesta.
- Preparación de avisos, solicitudes al operador y aportación de documentos dentro de la demo.
- Pantalla de análisis logístico sobre el histórico autorizado.

### Cliente o filial

- Únicamente sus envíos, documentos y avisos.
- Próximas entregas, estado comprensible, ETA y recorrido multimodal.
- Explicación de retrasos y cambios de ETA con su impacto.
- Acceso a documentos sintéticos y notificaciones proactivas dentro de la aplicación.

### Identidades y perímetro

Un selector de identidades ficticias permitirá recorrer ambos roles. El perímetro se aplicará a listado, detalle, escena, contadores, búsqueda, documentos, notificaciones, recomendaciones y reportes. Cambiar de identidad limpiará selección y resultados anteriores. Un identificador en la URL tampoco permitirá abrir un envío ajeno desde la interfaz.

Estas comprobaciones demuestran el comportamiento de los permisos en el navegador. La autorización real de producción requeriría un servidor.

## Datos y reglas de dominio

### Dataset

- Aproximadamente 24 envíos activos.
- Aproximadamente 150 envíos históricos adicionales durante 90 días.
- Tres centros de origen, cuatro operadores ficticios y tres cuentas de cliente.
- Rutas nacionales e internacionales, por carretera, mar y combinadas.
- Generación reproducible, identificadores estables y fechas ligadas al reloj de la demo.
- Documentos sintéticos sin información personal. Los archivos se generarán localmente o se incluirán como recursos estáticos.

El histórico incluirá patrones deliberados y muestras de comparación para evaluar el reporte. Se evitará atribuir un resultado al operador cuando la evidencia solo describa una ruta, un centro o una combinación de factores.

### Escenarios completos

1. Envío nacional por carretera que llega a tiempo.
2. Envío internacional con carretera, puerto de origen, barco, puerto de destino, aduana y última milla.
3. Retraso marítimo con nueva ETA comunicada por el operador.
4. Retención aduanera por falta de documentación.
5. Envío sin actualizaciones recientes y sin ETA fiable.

### Contratos compartidos

| Entidad             | Información principal                                                           |
| ------------------- | ------------------------------------------------------------------------------- |
| Identidad           | Rol, cuenta y centros o cuentas permitidos                                      |
| Centro y ubicación  | Tipo, referencias de lugar y posición esquemática en la escena                  |
| Operador            | Identificador, modos y vocabulario original de eventos                          |
| Envío               | Cuenta, origen, destino, referencia, compromiso, tramos y documentos            |
| Tramo               | Secuencia, modo, operador, origen, destino e hitos aplicables                   |
| Evento del operador | ID, envío, tramo, estado original, fuente, fecha del hecho y fecha de recepción |
| Evento normalizado  | Interpretación conocida o desconocida y vínculo al evento original              |
| Incidencia          | Tipo, severidad, evidencias y estado de atención                                |
| ETA                 | Valor o intervalo, procedencia, fecha de emisión y evidencias                   |
| Acción              | Propuesta, destinatario sintético, ejecución local y registro de actividad      |
| Reporte             | Perímetro, filtros, fecha de corte, métricas, hallazgos y recomendaciones       |

### Fiabilidad

- Separar progreso del transporte, situación de incidencia y antigüedad de la información.
- Adaptar los hitos al modo y a los tramos reales del envío.
- Conservar eventos originales junto con su normalización.
- Interpretar los códigos desconocidos como pendientes de clasificación.
- Procesar duplicados de forma idempotente y ordenar por fecha del hecho.
- Un evento antiguo recibido después no hará retroceder el progreso confirmado.
- Diferenciar fecha comprometida, ETA del operador y estimación.
- Mostrar información insuficiente cuando no exista evidencia para una ETA.
- Definir umbrales de información desactualizada según el contexto del tramo.
- Aportar un documento resuelve la tarea documental. La retención continúa hasta recibir un evento de liberación.
- Registrar un aviso o contactar al operador no modifica hechos físicos del envío.
- Los contadores y paneles se derivan del mismo estado que la escena.

## IA integrada

### Asistencia en incidencias

Cada incidencia podrá mostrar un resumen de lo ocurrido, impacto previsto, evidencias y siguiente acción. Las propuestas usarán reglas y plantillas deterministas sobre los datos visibles para el usuario.

Las acciones podrán preparar y registrar un aviso al cliente, crear una solicitud al operador o asociar un documento sintético. La interfaz reflejará el resultado local y conservará un registro de actividad. No se enviarán mensajes reales.

### Reporte de análisis logístico

Pantalla de operaciones con selección de periodo, centros y operadores, y acción "Generar reporte".

El reporte contendrá:

- Resumen de demoras y envíos afectados.
- Tiempos de espera y cuellos de botella por tramo, puerto, aduana, centro y operador.
- Comparaciones con número de observaciones y definición de la métrica.
- Enlaces a los envíos que sustentan cada hallazgo.
- Recomendaciones priorizadas y factores que requieren validación.
- Fechas de corte, filtros aplicados y datos ausentes.

Las métricas se calcularán sobre los datos filtrados. Las plantillas redactarán conclusiones a partir de esos cálculos. Las relaciones observadas se presentarán como indicios cuando no exista evidencia causal. Cualquier estimación de ahorro explicará sus supuestos.

Se distinguirán hitos completados y esperas abiertas para evitar comparar duraciones incompatibles. Un reporte conservará su fecha de corte. Si cambia el estado relevante, se ofrecerá regenerarlo. El histórico y los enlaces respetarán el perímetro de la identidad actual.

## Stack y arquitectura

| Pieza              | Elección                                                   |
| ------------------ | ---------------------------------------------------------- |
| Aplicación         | React, TypeScript estricto y Vite                          |
| Gestor de paquetes | pnpm, con versión fijada en package.json y pnpm-lock.yaml  |
| Escena             | Three.js, React Three Fiber y Drei                         |
| Componentes        | shadcn/ui sobre Base UI                                    |
| Estilos            | Tailwind CSS y variables de diseño compartidas             |
| Estado             | Zustand                                                    |
| Dominio            | Funciones TypeScript independientes de React               |
| Datos              | Fixtures y simulador local determinista                    |
| Persistencia       | Memoria y localStorage versionado, con reinicio completo   |
| Pruebas            | Vitest para reglas y recorridos automatizados en navegador |
| Calidad de código  | Oxlint, Prettier y Husky con comprobaciones pre-commit     |
| Publicación        | Build estático en Vercel                                   |

Se fijarán versiones compatibles mediante el archivo de bloqueo. La escena se cargará de forma diferida. Los modelos y otros recursos necesarios estarán disponibles desde el proyecto para reducir dependencias externas durante la demo.

Estructura prevista:

```text
src/
  app/                 Composición, navegación y proveedores
  components/ui/       Componentes shadcn/ui compartidos
  domain/              Tipos, normalización, visibilidad y reglas
  data/                Fixtures y generación del histórico
  simulation/          Reloj, escenarios y eventos programados
  store/               Estado compartido y persistencia
  scene/               Modelos, cámara, selección y rutas
  features/
    shipments/         Cartera y detalle de envíos
    exceptions/        Incidencias, recomendaciones y acciones
    customer/          Experiencia de cliente
    analytics/         Métricas y reporte de IA
  styles/              Tokens y estilos globales
```

El dominio devolverá datos sin importar componentes de UI. La escena y los paneles consumirán selectores compartidos. El simulador producirá eventos de dominio. Las animaciones no modificarán estados de negocio.

## Fases y condiciones de cierre

### Fase 0. Base y contratos

Responsable: agente principal. No requiere delegación.

- Comprobar herramientas locales, instrucciones y acceso disponible a Vercel sin mostrar credenciales.
- Preparar Vite, React, TypeScript, Tailwind y shadcn/ui sobre Base UI.
- Incorporar dependencias de escena, estado y pruebas.
- Establecer estructura, convenciones y contratos compartidos.
- Definir tokens visuales y una interfaz mínima reconocible.
- Preparar comandos de desarrollo, tipos, build y pruebas.
- Preparar configuración de despliegue y documentar la situación de acceso a Vercel.

Cierre: comprobación de tipos y build correctos; interfaz mínima inspeccionada en navegador cuando esté disponible; contratos suficientes para asignar las siguientes tareas. El acceso a Vercel se informará como verificado o pendiente, sin bloquear el trabajo local por falta de autenticación.

### Fase 1. Primer recorrido completo

Responsable: agente principal.

- Incorporar un envío nacional y dos identidades de referencia.
- Implementar el estado compartido y los selectores de visibilidad.
- Conectar listado, detalle y selección de un vehículo en la escena.
- Añadir un evento que actualice el envío y los paneles.
- Fijar los contratos definitivos antes de delegar.

Cierre: seleccionar en escena o listado abre el mismo envío; el evento actualiza los mismos datos; una identidad ajena no lo ve; tipos, build y comprobaciones del recorrido pasan.

### Fase 2. Desarrollo paralelo

El principal y tres subagentes trabajarán simultáneamente como máximo.

| Responsable           | Archivos y trabajo                                      | Entrega y verificación                                                                                                             |
| --------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Subagente de dominio  | data/, simulation/ y módulos de dominio asignados       | Dataset activo e histórico, eventos heterogéneos, normalización, escenarios y métricas; pruebas de reglas y resultados esperados   |
| Subagente de escena   | scene/                                                  | Centros, puertos, carretera, mar, vehículos, rutas, cámara y selección; escena inspeccionable con entradas del contrato compartido |
| Subagente de interfaz | Componentes de features/ asignados                      | Vistas de operaciones y cliente, detalle, documentos y estructura del reporte; estados de carga, vacío y error coherentes          |
| Agente principal      | app/, store/, components/ui/, contratos y configuración | Integración continua, permisos, componentes compartidos, dependencias y resolución de incompatibilidades                           |

Cada tarea tendrá una lista exacta de archivos, entradas, salidas y criterios de aceptación. Nadie modificará contratos o dependencias compartidas sin coordinarlo con el principal. Los cambios de contrato se propagarán antes de continuar con tareas dependientes.

Cierre: cada entrega cumple sus contratos; no hay errores de tipos; los escenarios y la interfaz consumen el mismo modelo.

### Fase 3. Integración e IA

Responsable: agente principal, con apoyos acotados cuando proceda.

- Conectar incidencias, prioridad, evidencias, acciones y avisos.
- Completar el reloj controlado con reproducir, pausar, avanzar y reiniciar.
- Conectar la pantalla de análisis a las métricas del histórico.
- Generar conclusiones y recomendaciones deterministas con enlaces verificables.
- Completar persistencia, cambios de identidad y estados vacíos.

Cierre: una incidencia recorre escena, bandeja, detalle y aviso del cliente; las acciones respetan las reglas del dominio; el reporte coincide con los datos filtrados y las evidencias.

### Fase 4. Revisión independiente

Un subagente de QA revisará la aplicación después de liberar una plaza. El principal corregirá los problemas.

- Recorrer los cinco escenarios completos y el reporte.
- Comprobar permisos en todas las superficies y cambios de identidad.
- Verificar códigos desconocidos, duplicados y eventos fuera de orden.
- Comprobar ETA ausente, información desactualizada y evidencias.
- Revisar navegación por teclado, foco, contraste y movimiento reducido.
- Inspeccionar escena, selección, rutas, paneles y vista móvil mediante capturas.
- Probar ausencia de WebGL y recuperación desde localStorage incompatible.
- Medir carga e interacción en el entorno disponible y documentar los resultados observados.

Cierre: recorridos críticos, comprobación de tipos y build correctos; sin errores de consola que impidan el uso; problemas materiales corregidos o limitaciones concretas documentadas.

### Fase 5. Publicación y entrega

Responsable: agente principal.

- Completar README con instalación, comandos, arquitectura, alcance y guion de demo.
- Compilar y publicar en Vercel con una sesión autorizada.
- Comprobar la URL publicada, carga directa, recarga y recursos estáticos.
- Repetir el recorrido principal y un reporte desde la versión desplegada.
- Entregar URL, resumen de verificación y limitaciones pendientes.

Cierre: prototipo accesible en Vercel y demo repetible. Si falta acceso a la cuenta, documentar el impedimento exacto y dejar el proyecto listo para desplegar; no declarar completada la publicación.

## Verificación autónoma

Cada fase cerrará con `pnpm check`, el build y las comprobaciones apropiadas a su alcance. El hook pre-commit comprobará lint y formato sobre todo el proyecto. Los tests se centrarán en reglas de negocio y recorridos relevantes, evitando pruebas que solo reproduzcan el código o validen textos decorativos.

| Área               | Evidencia esperada                                                                                              |
| ------------------ | --------------------------------------------------------------------------------------------------------------- |
| Normalización      | Códigos distintos producen una interpretación común; los desconocidos conservan su estado sin inventar progreso |
| Orden y duplicados | Repetir un evento no duplica sus efectos; recibir tarde un evento antiguo no hace retroceder el envío           |
| Perímetro          | Ninguna identidad ve envíos, documentos, métricas o recomendaciones ajenos                                      |
| Coherencia         | Escena, contadores, detalle y notificaciones cambian con el mismo evento                                        |
| ETA                | Fuente y fecha visibles; ausencia explícita si faltan datos                                                     |
| Aduana             | Aportar documento no equivale a liberar; el evento de liberación sí cambia el progreso                          |
| Reporte            | Cálculos contrastados con fixtures de resultados conocidos; filtros, muestras y enlaces correctos               |
| Simulación         | Reloj controlado, avance repetible y reinicio que restaura los mismos escenarios                                |
| Interacción        | Selección real en escena y paneles; accesibilidad y estados sin datos inspeccionados                            |
| Despliegue         | URL de Vercel y recorrido principal comprobados sobre la versión publicada                                      |

Las pruebas usarán una fecha de referencia y datos reproducibles. No dependerán de la hora real ni de esperas largas. La revisión visual complementará las comprobaciones de DOM y de datos.

## Fuera de alcance

- Backend, base de datos, integración con operadores y autenticación real.
- Envío real de correos, mensajes o notificaciones del sistema.
- Consulta conversacional y agentes autónomos que actúen sobre sistemas externos.
- Inventario, gestión de carretillas o muelles y edición avanzada de envíos.
- Optimización matemática de rutas y promesas de ahorro sin evidencia.
- Geografía precisa, GPS real y física de vehículos.

La prioridad es demostrar seguimiento multimodal, confianza en la información, gestión de incidencias y utilidad del análisis logístico.

## Guion de demo

1. Entrar como operaciones y revisar las incidencias de su cartera.
2. Seleccionar un envío retenido y seguir su ruta multimodal en 3D.
3. Consultar la explicación y los eventos que la sustentan.
4. Aportar el documento pendiente y preparar un aviso al cliente.
5. Cambiar al cliente y comprobar que ve únicamente sus envíos y el aviso.
6. Avanzar la simulación hasta recibir la liberación aduanera y observar el cambio.
7. Volver a operaciones, generar el reporte y abrir los envíos de un hallazgo.
8. Reiniciar la demo para repetirla.

## Estado de ejecución

- [x] Alcance y stack acordados.
- [x] Plan guardado en la raíz.
- [x] Fase 0 completada.
- [ ] Fase 1 completada.
- [ ] Fase 2 completada.
- [ ] Fase 3 completada.
- [ ] Fase 4 completada.
- [ ] Fase 5 completada.

### Resultado de la fase 0

Completada el 31 de octubre de 2026 en el mismo chat de planificación. La fase 0 cabía en el contexto disponible y no requirió abrir otro chat ni delegar tareas.

- Preparados Vite, React, TypeScript estricto, Tailwind, Base UI, React Three Fiber, Drei, Zustand y Vitest.
- Generados componentes shadcn/ui con preset Nova. Se utilizó `eject` para conservar las utilidades CSS y retirar la CLI del proyecto.
- Creados los contratos compartidos en `src/domain/contracts.ts` y sus convenciones en `src/domain/README.md`.
- Creada una interfaz inicial con navegación, estados vacíos y una escena 3D estática y responsive.
- Configurados build estático, recarga de rutas y salida `dist` para Vercel.
- Guardados los comandos y el estado real del proyecto en `README.md`.

Verificación realizada:

- Comprobación de tipos correcta. Comando actual: `pnpm typecheck`.
- Build correcto, incluye comprobación de tipos. Comando actual: `pnpm build`.
- Build servido localmente. Comando actual: `pnpm preview --port 5173 --strictPort`.
- Navegación entre las tres vistas y renderizado 3D comprobados en navegador.
- Vista móvil de 390 × 844 revisada; desbordamiento horizontal corregido y ausencia de desbordamiento confirmada.
- Revisión de dependencias sin vulnerabilidades tras retirar las dependencias de la CLI.
- Consola sin errores de ejecución. Persiste un aviso de depreciación de `THREE.Clock` desde React Three Fiber.
- No se han añadido tests triviales para la base visual. La suite de negocio comienza en la fase 1.

Pendientes conocidos:

- La CLI de Vercel no está instalada; no se ha encontrado una sesión local ni un proyecto enlazado. La publicación requiere acceso a Vercel en la fase 5.
- El fragmento diferido de la escena ocupa unos 925 kB sin comprimir y 245 kB comprimido. El build muestra un aviso de tamaño; se revisará en la fase de rendimiento.
- La alternativa sin WebGL tiene contención de errores inicial, pero su recorrido completo se verificará cuando exista el listado funcional.

### Ajustes de herramientas posteriores a la fase 0

- Migrar el gestor de paquetes a pnpm 12.15.0 y conservar las versiones resueltas al importar el archivo de bloqueo anterior.
- Mantener únicamente pnpm-lock.yaml y fijar packageManager en package.json.
- Usar comandos de pnpm en documentación, scripts y despliegue en Vercel.
- Configurar Oxlint para TypeScript, React y accesibilidad JSX, con la excepción necesaria para las propiedades de React Three Fiber.
- Configurar Prettier y aplicar su formato al proyecto.
- Activar Husky mediante prepare y comprobar lint y formato antes de cada commit.
- Verificar que el hook acepta el proyecto correcto y rechaza errores de lint y de formato, sin crear commits de prueba.

Estos ajustes están completados. Se han comprobado `pnpm check`, `pnpm build` y la instalación con el lockfile congelado, también sin red. El hook real de Git acepta el proyecto correcto y rechaza tanto un `debugger` como un archivo mal formateado. Los archivos de prueba temporales se han retirado y no se han creado commits.

### Siguiente trabajo

Continuar con la fase 1. Leer primero este plan, `README.md` y los contratos de dominio. Implementar un envío nacional, dos identidades, las reglas de visibilidad y la selección sincronizada entre escena, listado y detalle. Añadir un evento reproducible y las pruebas de esas reglas antes de abrir las tareas paralelas de la fase 2.

El documento permite continuar en este chat o abrir uno nuevo sin reconstruir las decisiones de la conversación. Si se cambia de chat, pedir: "Lee IMPLEMENTATION_PLAN.md y README.md. Continúa con la fase 1 y sus verificaciones, manteniendo el alcance acordado".
