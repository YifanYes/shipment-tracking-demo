# Plan de implementación

Fecha del acuerdo: 31 de octubre de 2026.

## Objetivo

Construir una demo de seguimiento logístico con dos experiencias, operaciones internas y cliente o filial. El producto consolidará envíos de varios centros y operadores, por carretera y mar, con información fiable sobre hitos, incidencias, documentos y ETA.

La experiencia principal será una torre de control con una red logística 3D isométrica. Fábricas, almacenes, puertos, camiones y barcos permitirán explorar los mismos envíos que aparecen en los paneles y listados.

Referencia visual: [publicación de Dilum Sanjaya](https://x.com/DilumSanjaya/status/2106426962738880879). Se toma como referencia de cámara, geometría estilizada y paneles flotantes. La demo desarrollará su propio diseño y una red de transporte completa.

## Decisiones acordadas

- Aplicación exclusivamente frontend, sin backend, base de datos ni integraciones reales.
- Datos, empresas, centros, operadores, documentos e identidades sintéticos.
- Publicación final en Railway. Sustituye a Vercel por decisión del usuario del 4 de noviembre de 2026.
- IA centrada en explicar y resolver incidencias, con evidencias y siguientes acciones.
- Reporte de IA para detectar cuellos de botella y proponer optimizaciones logísticas.
- Consulta conversacional aplazada a una ampliación posterior. No se construirá una interfaz de chat en este alcance.
- Los resultados de IA procederán de reglas y plantillas locales. La interfaz no incluirá avisos de "IA simulada", por decisión del usuario.
- Estados, ETA y recomendaciones conservarán sus fuentes, fechas y límites. La ausencia de datos se mostrará explícitamente.
- Interfaz basada en shadcn/ui sobre Base UI y Tailwind, con diseño propio para la escena y los componentes logísticos.
- La implementación podrá usar subagentes. Se definen responsabilidades y dependencias antes de paralelizar.
- Las vistas principales tendrán un título compacto en la barra superior, sin encabezados promocionales. Se reservarán los breadcrumbs para páginas con jerarquía real, como el detalle de un envío. Los filtros y acciones se incorporarán junto con sus datos y comportamiento en las fases siguientes.
- Atlas tendrá un símbolo SVG propio, compartido con el favicon. El control de la sidebar estará en la cabecera del contenido, fuera del panel lateral.

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
- Tiempos de espera y cuellos de botella por puerto, aduana y centro de origen.
- Comparaciones con número de observaciones y definición de la métrica.
- Enlaces a los envíos que sustentan cada hallazgo.
- Recomendaciones priorizadas y factores que requieren validación.
- Fechas de corte, filtros aplicados y datos ausentes.

Las métricas se calcularán sobre los datos filtrados. Las plantillas redactarán conclusiones a partir de esos cálculos. Las relaciones observadas se presentarán como indicios cuando no exista evidencia causal. Cualquier estimación de ahorro explicará sus supuestos.

Las esperas por nodo solo usan hitos completados; lo que sigue abierto pertenece a la bandeja de atención. Un reporte conservará su fecha de corte. Si cambia el estado relevante, se ofrecerá regenerarlo. El histórico y los enlaces respetarán el perímetro de la identidad actual.

## Stack y arquitectura

| Pieza              | Elección                                                   |
| ------------------ | ---------------------------------------------------------- |
| Aplicación         | React, TypeScript estricto y Vite                          |
| Gestor de paquetes | pnpm, con versión fijada en package.json y pnpm-lock.yaml  |
| Mapa               | MapLibre GL JS, teselas de OpenStreetMap y fondo local     |
| Componentes        | shadcn/ui sobre Base UI                                    |
| Estilos            | Tailwind CSS y variables de diseño compartidas             |
| Estado             | Zustand                                                    |
| Dominio            | Funciones TypeScript independientes de React               |
| Datos              | Fixtures y simulador local determinista                    |
| Persistencia       | Memoria y localStorage versionado, con reinicio completo   |
| Pruebas            | Vitest para reglas y recorridos automatizados en navegador |
| Calidad de código  | Oxlint, Prettier y Husky con comprobaciones pre-commit     |
| Publicación        | Build estático en Railway, servido con Railpack y Caddy    |

Se fijarán versiones compatibles mediante el archivo de bloqueo. La escena se cargará de forma diferida. Los modelos y otros recursos necesarios estarán disponibles desde el proyecto para reducir dependencias externas durante la demo.

Estructura prevista:

```text
src/
  app/                 Composición, layout, navegación y proveedores
  domain/              Tipos, normalización, visibilidad y reglas
  data/scenarios/      Fixtures, escenarios y generación del histórico
  simulation/          Reloj, escenarios y eventos programados
  store/               Estado compartido y persistencia
  features/
    overview/          Métricas y mapa operativo
    shipments/         Cartera y detalle de envíos
    exceptions/        Incidencias, recomendaciones y acciones
    customer/          Experiencia de cliente
    analytics/         Métricas y reporte de IA
  shared/              Componentes shadcn/ui, formato y utilidades
  styles/              Tema y estilos base
tests/
  unit/                Reglas, store y utilidades, con la misma ruta que src/
  integration/         Recorridos de la aplicación
  support/             Fixtures y sustitutos compartidos
```

Cada funcionalidad contiene `components/`, `lib/`, sus estilos e `index.ts` como API pública. Las convenciones de nombres y dependencias están en README.md.

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

| Responsable           | Archivos y trabajo                                | Entrega y verificación                                                                                                                  |
| --------------------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Subagente de dominio  | data/, simulation/ y módulos de dominio asignados | Dataset activo e histórico, eventos heterogéneos, normalización, escenarios y métricas; pruebas de reglas y resultados esperados        |
| Subagente de mapa     | features/overview/                                | Centros, puertos, rutas por carretera y mar, marcadores, encuadre y selección; mapa inspeccionable con entradas del contrato compartido |
| Subagente de interfaz | Componentes de features/ asignados                | Vistas de operaciones y cliente, detalle, documentos y estructura del reporte; estados de carga, vacío y error coherentes               |
| Agente principal      | app/, store/, shared/, contratos y configuración  | Integración continua, permisos, componentes compartidos, dependencias y resolución de incompatibilidades                                |

Cada tarea tendrá una lista exacta de archivos, entradas, salidas y criterios de aceptación. Nadie modificará contratos o dependencias compartidas sin coordinarlo con el principal. Los cambios de contrato se propagarán antes de continuar con tareas dependientes.

Cierre: cada entrega cumple sus contratos; no hay errores de tipos; los escenarios y la interfaz consumen el mismo modelo.

### Fase 3. Integración e IA

Responsable: agente principal, con apoyos acotados cuando proceda.

Bloque 1. Pasos de la demo. La revisión de la fase 2 mostró que el reloj exigía 20 clics, la mayoría de eventos técnicos, y que al terminar la bandeja de atención crecía: los envíos sin escenario dejaban de recibir eventos y algunos problemas no tenían forma de resolverse. Se acuerda:

- El reloj avanza por pasos con nombre. Cada paso libera los eventos de la historia hasta su hora y el avance habitual del resto de la operación. El control indica el paso siguiente y su hora.
- Los eventos resuelven lo físico (respuestas del operador, liberación aduanera y entregas). Las acciones de la fase 3 resuelven lo documental y los avisos.
- Un código desconocido requiere atención hasta que el operador confirma un evento conocido posterior en el mismo tramo. El evento original se conserva en la cronología.
- Un envío entregado solo requiere atención si mantiene una incidencia abierta, como un documento pendiente.
- La demo empieza con Operaciones · Red para que todos los pasos sean visibles. Operaciones Madrid demuestra el perímetro por centro.

| Paso                                 | Hora          | Qué ocurre                                                                                                                       | Qué enseña                                                                               |
| ------------------------------------ | ------------- | -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Inicio                               | 31 oct, 11:00 | ATL-TR-004 retenido por falta de documento, ATL-ES-005 sin noticias, ATL-ES-012 y ATL-ES-021 con retraso, ATL-ES-011 sin recoger | Bandeja, mapa y detalle con evidencias                                                   |
| Retraso marítimo de ATL-IT-003       | 31 oct, 12:30 | La naviera comunica una ETA posterior al compromiso; ATL-ES-005 envía un código desconocido                                      | Cambio de ETA con fuente, nueva incidencia y código pendiente de clasificar              |
| Respuesta del operador de ATL-ES-005 | 31 oct, 14:00 | ATL-ES-005 vuelve a informar con un código conocido; ATL-ES-001 se entrega a tiempo; ATL-MA-002 llega a Algeciras                | Información desactualizada y código desconocido resueltos                                |
| Entregas de la tarde                 | 31 oct, 19:00 | ATL-ES-005, ATL-ES-012 y ATL-ES-021 se entregan; ATL-MA-002 zarpa                                                                | Retrasos cerrados con la entrega, contadores y mapa sincronizados                        |
| Liberación aduanera de ATL-TR-004    | 1 nov, 13:00  | Llega `CUSTOMS_RELEASED`; ATL-MA-002 pasa la aduana de Tanger Med                                                                | El documento aportado no libera; el evento sí                                            |
| Entregas internacionales             | 1 nov, 16:00  | ATL-MA-002 y ATL-TR-004 se entregan en Casablanca y Adana                                                                        | Recorrido multimodal completo                                                            |
| Llegada de ATL-IT-003                | 2 nov, 05:15  | ATL-IT-003 llega con la ETA revisada y se entrega en Milán                                                                       | Estado final: solo queda el documento de ATL-TR-004, que resuelve la acción de aportarlo |

Las fases restantes amplían este bloque: las acciones y avisos actúan sobre el estado de cada paso, y reproducir y pausar recorren los mismos pasos.

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
- Compilar y publicar en Railway con una sesión autorizada.
- Comprobar la URL publicada, carga directa, recarga y recursos estáticos.
- Repetir el recorrido principal y un reporte desde la versión desplegada.
- Entregar URL, resumen de verificación y limitaciones pendientes.

Cierre: prototipo accesible en Railway y demo repetible. Si falta acceso a la cuenta, documentar el impedimento exacto y dejar el proyecto listo para desplegar; no declarar completada la publicación.

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
| Despliegue         | URL de Railway y recorrido principal comprobados sobre la versión publicada                                     |

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
- [x] Fase 1 completada.
- [x] Fase 2 completada.
- [x] Fase 3 completada.
- [x] Fase 4 completada.
- [x] Fase 5 completada.

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

### Revisión de cierre de la fase 0

Revisada el 31 de octubre de 2026 después de los ajustes de interfaz. La fase 0 está completada conforme a sus condiciones de cierre.

| Criterio                          | Resultado                                                                                                                                                               |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Herramientas y gestor de paquetes | Node.js 26.12.1 y pnpm 12.15.0 comprobados; packageManager fijado y un único lockfile de pnpm                                                                           |
| Stack y componentes               | Vite, React, TypeScript estricto, Tailwind, shadcn/ui sobre Base UI, Three.js, React Three Fiber, Drei y Zustand configurados                                           |
| Estructura y contratos            | Contratos de cuentas, identidades, centros, operadores, envíos, tramos, eventos, ETA, documentos, incidencias, acciones y reportes presentes; convenciones documentadas |
| Comandos y calidad                | pnpm check y pnpm build correctos; Husky activo en core.hooksPath y hook pre-commit con lint y formato                                                                  |
| Configuración de pruebas          | Vitest carga su configuración mediante pnpm exec vitest list --passWithNoTests; todavía no hay pruebas de negocio, que comienzan en la fase 1                           |
| Interfaz mínima                   | Tres vistas navegables, título h1 único de 18 px, título de pestaña por sección, sidebar colapsable con control exterior y logotipo y favicon compartidos               |
| Inspección en navegador           | Build de producción revisado en escritorio y móvil de 320 px; escena 3D renderizada, navegación y colapsado comprobados, sin desbordamiento horizontal                  |
| Despliegue preparado              | vercel.json define instalación con lockfile congelado, build y recarga de rutas; no hay CLI, sesión local ni proyecto de Vercel enlazado                                |

El acceso a Vercel sigue pendiente para la publicación de la fase 5. El aviso de tamaño del fragmento 3D y la depreciación de THREE.Clock se mantienen registrados para la fase de rendimiento. Estos pendientes no impiden cerrar la base local.

Al cerrar la fase 0, los filtros por centro, el histórico, la actualización de estados, las identidades funcionales, los documentos y la IA estaban pendientes. La fase 1 incorpora el primer seguimiento y las identidades; el resto permanece en las fases 2 y 3.

### Resultado de la fase 1

Completada el 31 de octubre de 2026 por el agente principal, sin delegación.

- Incorporado el envío nacional `ATL-ES-001`, Madrid → Valencia, con datos sintéticos y reloj inicial fijo.
- Añadidas dos identidades, operaciones autorizadas y cliente de otra cuenta sin acceso al envío.
- Implementados estado compartido con Zustand, visibilidad por centro y cuenta, selección validada y limpieza de selección al cambiar de identidad.
- Listado, detalle, contadores y vehículo 3D consumen las mismas vistas autorizadas y proyecciones. Seleccionar el vehículo o la fila abre el mismo envío. La URL conserva la selección y descarta identificadores ajenos o inexistentes.
- Añadido un avance reproducible de dos horas que incorpora el evento de entrega una sola vez, y reinicio del escenario. La entrega cambia las superficies conectadas sin modificar la fecha comprometida ni inventar una ETA nueva.
- El detalle conserva códigos y mensajes originales, fechas del hecho y recepción, normalización y evidencias de ETA y última ubicación confirmada. La posición ilustrativa del vehículo se identifica como tal.
- Fijados `ShipmentView`, `ShipmentSummary` y los contratos de selección, proyección y escena en `src/domain/contracts.ts` y `src/domain/README.md` para preparar la fase 2.

Verificación de cierre:

| Criterio               | Resultado                                                                                                                                                                             |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Selección sincronizada | Vehículo y listado abren el mismo detalle; selección y URL coherentes                                                                                                                 |
| Evento compartido      | Entrega actualiza escena, listado, detalle y contadores; repetición idempotente y reinicio reproducible                                                                               |
| Perímetro              | Cliente ajeno sin envío, detalle, ruta ni contadores asociados; identificador directo rechazado                                                                                       |
| Reglas                 | Pruebas de cuenta y centro, códigos desconocidos, duplicados, eventos antiguos y futuros, ETA ausente y antigüedad                                                                    |
| Recorrido automatizado | 12 pruebas correctas en Vitest, incluidas tres de interfaz con jsdom y contrato de escena sustituido                                                                                  |
| Calidad                | `pnpm check`, `pnpm test` y `pnpm build` correctos                                                                                                                                    |
| Navegador              | Build de producción revisado en escritorio y móvil de 320 px; WebGL y selección reales, entrega, identidad y reinicio comprobados; sin desbordamiento horizontal en listado y detalle |

No se añaden dependencias. Continúan los avisos conocidos de `THREE.Clock` y tamaño del fragmento 3D, ahora de unos 935 kB sin comprimir y 248 kB comprimido. No se observaron errores de ejecución. El histórico, los escenarios multimodales, la IA, el reloj completo, la persistencia y la publicación mantienen sus fases previstas.

### Siguiente trabajo

Las fases del plan están completadas. Pendiente, si la demo se abre a más tráfico: proveedor de cartografía.

## Cambio de la vista general: mapa operativo

El 31 de octubre de 2026 el usuario aprobó sustituir la escena 3D de la vista general por un mapa 2D de España con MapLibre. Esta decisión sustituye las referencias anteriores a la escena isométrica para esa vista. Se conserva el perímetro de identidad, el escenario nacional y la navegación al detalle. El mapa representa la última ubicación confirmada, agrupa marcadores y permite seleccionar un recorrido previsto. No implica incorporar seguimiento GPS real ni completar los escenarios de fases posteriores. README.md describe las fuentes de cartografía y las limitaciones del recorrido.

## Reorganización de la estructura

El 2 de noviembre de 2026 se reorganizó el código sin cambiar el comportamiento. Las pruebas pasan a `tests/`; los archivos usan kebab-case; cada funcionalidad expone un `index.ts`; `domain/tracking.ts` se divide en `visibility.ts`, `events.ts` y `projection.ts`; las reglas de atención pasan a `domain/attention.ts` y la geometría del mapa a `features/overview/lib/map-data.ts`; el formato compartido pasa a `shared/lib/format.ts`; los estilos se reparten entre `styles/globals.css`, `app/layout/layout.css` y el CSS de cada funcionalidad. Se retiran las dependencias de Three.js. Al asignar archivos en la fase 2 se deben usar estas rutas.

## Revisión de las fases 0 y 1 tras el mapa y la reorganización

Revisada el 2 de noviembre de 2026. Las fases 0 y 1 siguen completadas con el mapa de MapLibre y la nueva estructura. Donde los criterios de cierre mencionan la escena o el vehículo, se aplican al mapa y su marcador.

| Criterio               | Resultado                                                                                                                                               |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Calidad                | `pnpm check`, `pnpm test` (22 pruebas en 6 archivos) y `pnpm build` correctos                                                                           |
| Selección sincronizada | El marcador real del mapa y la fila del listado abren el mismo detalle `/shipments/shipment-es-001`                                                     |
| Evento compartido      | Confirmar la entrega actualiza detalle (3 eventos, Entregado), listado, contadores y mapa; el botón queda desactivado y Reiniciar restaura el escenario |
| Perímetro              | El cliente de otra cuenta no ve el envío en mapa, listado ni contadores; el enlace directo al detalle se redirige al listado vacío                      |
| Navegador              | Build de producción revisado en escritorio (1280 × 800) y móvil (390 × 844): sin desbordamiento horizontal, sin errores de consola, teselas cargadas    |

Pendientes que no bloquean estas fases: el aviso de tamaño del fragmento de MapLibre (unos 1,08 MB sin comprimir), el uso de las teselas públicas de OpenStreetMap antes de publicar y la comprobación completa sin WebGL en la fase 4.

## Resultado de la fase 2

Completada el 3 de noviembre de 2026. El agente principal fijó los contratos y tres subagentes trabajaron en paralelo sobre archivos disjuntos: dominio, mapa e interfaz. Una interrupción por límite de uso detuvo a los tres a mitad de tarea; se reanudaron con su contexto y terminaron sus entregas.

| Responsable | Entrega                                                                                                                                                                                                                                                                       |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Principal   | `DemoSeed`, `legStages`, `ShipmentView.incidents`, `ReportMetric.group`; store con semilla y avance al siguiente evento programado (`simulation/clock.ts`); navegación por rol; componentes shadcn/ui input, select, dialog, tabs, table y checkbox; integración en `app.tsx` |
| Dominio     | 174 envíos (24 activos y 150 históricos de 90 días), 1.270 eventos, 28 documentos, cinco identidades, cuatro operadores con vocabularios propios, cinco escenarios, incidencias, umbrales de antigüedad por contexto y métricas del reporte                                   |
| Mapa        | Centros, puertos y destinos del perímetro, tramos por carretera y mar con su estado, filtro por centro, encuadre multimodal y ficha con ETA, compromiso e incidencias                                                                                                         |
| Interfaz    | Listado con búsqueda y filtros, detalle multimodal con incidencias, documentos y eventos por audiencia, inicio del cliente y estructura del reporte con detección de reporte desactualizado                                                                                   |

Verificación de cierre:

| Criterio     | Resultado                                                                                                                      |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| Calidad      | `pnpm check`, `pnpm test` (21 archivos, 103 pruebas) y `pnpm build` correctos                                                  |
| Mismo modelo | Marcadores, contador del mapa, métricas y bandeja de atención coinciden con `selectVisibleShipments` sobre el dataset completo |
| Perímetro    | El cliente solo ve su cuenta, sin mapa ni análisis; un enlace directo ajeno se rechaza                                         |
| Aduana       | ATL-TR-004 permanece en aduana hasta `CUSTOMS_RELEASED` al avanzar el reloj                                                    |
| Fase 1       | El recorrido nacional se conserva sobre `nationalSeed`                                                                         |

Revisión en navegador del 3 de noviembre de 2026 sobre el build de producción, a 1280 × 800 y 390 × 844, sin errores de consola ni desbordamiento horizontal: mapa con dataset completo, selección y ficha de ATL-TR-004, detalle con incidencias, documentos y eventos, búsqueda del listado, inicio y detalle del cliente sin códigos internos, enlace ajeno rechazado, Análisis oculto al cliente, reporte generado, recorrido de los 20 eventos programados y reinicio. Correcciones aplicadas: el cierre de un tramo intermedio se mostraba como "Entregado"; filas del listado alineadas en columnas y con el tipo de incidencia en lugar de "Incidencia pendiente"; filtros en una línea; filtros del reporte con una sola opción ocultos; botón del cliente junto al título; etiqueta del vehículo seleccionado dentro del mapa; el mapa se titula "Envíos sin entregar" porque incluye planificados.

Pendientes para las fases siguientes: al recorrer todos los eventos programados (unas 43 h), los envíos activos sin escenario dejan de recibir eventos y pasan a información antigua y fuera de plazo, de modo que la bandeja de atención crece hasta 22; el reloj completo de la fase 3 debe añadirles eventos o limitar el avance. La métrica de tránsito por cada 100 km compara operadores de carretera y mar en el mismo grupo. el dataset se incluye en el fragmento principal, de unos 550 kB sin comprimir; el tramo Algeciras → Tanger Med cruza unos kilómetros del contorno simplificado de `map-land.geojson`; la liberación aduanera reutiliza el hito `collected`; los filtros del listado se reinician al volver del detalle; las acciones, avisos, hallazgos del reporte, reloj completo y persistencia pertenecen a la fase 3.

## Resultado del bloque 1 de la fase 3

Completado el 3 de noviembre de 2026.

- `DemoStep` y `DemoSeed.steps` definen los seis pasos; `nextDemoStep` devuelve el siguiente y `advanceDemo` libera sus eventos. El control de la sidebar muestra el nombre y la hora del paso, y "Demo completada" al terminar.
- `data/scenarios/background.ts` genera, de forma determinista, los hitos de los 19 envíos activos sin escenario hasta su ETA o antes de su compromiso, con avisos de posición para que ningún paso los encuentre desactualizados.
- `attentionReasons` aplica las nuevas reglas de códigos desconocidos y envíos entregados.
- Al avanzar un paso aparece un aviso arriba a la derecha, bajo la barra superior. Cada paso puede definir en `DemoStep.story` un titular y una frase sobre su envío principal, que solo se muestran si la identidad lo ve. El resto se resume en el número de envíos entregados en su perímetro, con cuántos llegaron tarde; `shipmentChanges` compara las vistas autorizadas antes y después del paso. El aviso usa el Toast de Base UI y se cierra a los 8 segundos, con su botón o al reiniciar.

Verificación: `pnpm check` y `pnpm test` (108 pruebas) correctos. Las pruebas del reloj comprueban el orden de los pasos, que ningún envío de fondo queda desactualizado en ningún paso, que al terminar los cinco escenarios están entregados y solo ATL-TR-004 requiere atención por su documento, y que reiniciar reproduce el mismo recorrido.

## Resultado del resto de la fase 3

Implementado el 3 de noviembre de 2026 por el agente principal, sin delegación. Las reglas y contratos están en `src/domain/README.md`.

- Acciones e incidencias: cada incidencia activa explica qué ha ocurrido y su impacto, y propone acciones con prioridad y las evidencias de la incidencia: aportar el documento, preparar un aviso al cliente o una solicitud al operador. Avisos y solicitudes se preparan en un diálogo con el mensaje editable. Registrar una acción actualiza la atención de la incidencia (sin revisar, en gestión, atendida), el registro de actividad del detalle y la bandeja, que muestra el estado y prioriza los envíos con acciones pendientes. Aportar el certificado de ATL-TR-004 resuelve la tarea documental; la aduana sigue retenida hasta `CUSTOMS_RELEASED`.
- Avisos al cliente: los avisos registrados aparecen en el inicio y en el detalle del cliente del envío. Las solicitudes al operador y el registro de actividad son internos.
- Reloj: reproducir y pausar recorren los mismos pasos con 5 s entre ellos, junto a avanzar y reiniciar.
- Análisis: hallazgos y recomendaciones deterministas antes de las métricas. Con el histórico completo detectan la estancia en Valencia, el despacho en Felixstowe y las recogidas en Zaragoza, con muestra, estimación y supuestos, sin atribuirlos al operador; además, esperas abiertas en aduana, envíos fuera de plazo y la tasa de entregas a tiempo. Se corrigen las concordancias de las limitaciones ("1 envío").
- Persistencia: identidad, paso, actividad y sidebar se guardan en `localStorage` versionado y se reconstruyen desde la semilla. Un estado incompatible se descarta.

Verificación: `pnpm check`, `pnpm test` (25 archivos, 122 pruebas) y `pnpm build` correctos. Las pruebas nuevas cubren las acciones y sus reglas (perímetro, repetición, cliente sin permisos, documento sin liberación), el final de la demo con la bandeja vacía tras aportar el documento, los hallazgos contra sus métricas y filtros, la persistencia con estados manipulados, la reproducción y el recorrido en la interfaz de una incidencia desde la bandeja hasta el aviso del cliente.

Revisión en navegador del 3 de noviembre de 2026 sobre el build de producción, a 1280 × 800 y 390 × 844, sin errores de consola: acciones y diálogos de ATL-TR-004 (mensaje vacío bloqueado, Escape devuelve el foco sin registrar), actividad, cola "En gestión", recarga con estado guardado, reproducir, pausar y parada al final con la bandeja vacía, hallazgos del reporte con sus envíos, avisos del cliente y reinicio. Correcciones aplicadas: la incidencia documental resuelta bajaba de severidad alta a media al dejar de estar activa; la explicación de "Avisar al cliente" y "Pedir posición y ETA" repetía el impacto de la incidencia; los envíos que sustentan un hallazgo no seguían orden de referencia; la región de notificaciones se anunciaba en inglés.

Simplificación del reporte tras la revisión: el reporte muestra tres cifras (entregas a tiempo, en curso fuera de plazo y retraso medio), hasta tres hallazgos de cuellos de botella en lista, con supuestos, limitaciones y envíos plegados en "Detalle", y una tabla de esperas por nodo con barras y el nodo del hallazgo marcado. Se retiran del dominio la duración de tramos por modo, el tránsito por operador y las esperas abiertas por nodo, y los hallazgos de entregas a tiempo, fuera de plazo y despacho pendiente, que repetían cifras o la bandeja. Los filtros pasan a chips con "Todos" y la generación muestra durante 1,8 s los pasos de la consulta y un esqueleto, sin animación con movimiento reducido. Revisado en navegador a 1280 × 800 y 390 × 844.

Fase cerrada a petición del usuario. Los avisos solo siguen en el inicio del cliente mientras su incidencia está activa; en el detalle del envío se conservan como historial. Siguen pendientes de fases posteriores el tamaño del fragmento de MapLibre y del dataset y los filtros del listado que se reinician al volver del detalle.

## Resultado de la fase 4

Revisión del 3 de noviembre de 2026. Un subagente de QA recorrió el build de producción con Chromium 145 (Playwright, WebGL por software) y axe-core 4.10, sin acceso de escritura al código. El agente principal corrigió los problemas y repitió las comprobaciones en navegador. No hubo bloqueantes en los recorridos normales; sí 8 hallazgos materiales y 14 menores.

| Hallazgo material                                                   | Corrección                                                                                                  | Comprobación                                                                |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Fallo del fragmento del mapa: aplicación en blanco                  | `ErrorBoundary` alrededor del mapa y de la aplicación                                                       | Fragmento bloqueado: aviso, 24 filas y bandeja; `/shipments` no lo necesita |
| El aviso de un paso seguía abierto para otra identidad              | Cambiar de identidad cierra los avisos                                                                      | Con Levante Retail no queda el aviso de ATL-IT-003                          |
| Envío entregado "retenido en aduana", retraso atribuido al operador | Lo resuelto se explica en pasado; un compromiso vencido no se atribuye al operador                          | ATL-TR-004 final, operaciones y cliente                                     |
| "Sin noticias desde" usaba la fecha del umbral                      | Fecha y horas del último evento, también en la solicitud al operador                                        | ATL-ES-005: 30 oct, 12:00 (23 h)                                            |
| Foco perdido en `<body>`                                            | Destino definido al navegar, registrar acciones, generar el reporte, cerrar la ficha y abrir una agrupación | Elemento activo medido en cada caso                                         |
| Contraste bajo AA en texto pequeño                                  | Grises, azul y ámbar de texto oscurecidos                                                                   | axe: 0 infracciones en las 9 pantallas revisadas (antes hasta 103 nodos)    |
| Desbordamiento horizontal a 320 px                                  | Controles de demo con salto de línea                                                                        | `scrollWidth` 320 y 390, también con aviso                                  |
| "Localizar envío" sin respuesta visible en móvil                    | La ficha entra en pantalla y se anuncia la selección                                                        | Ficha completa a 320, 390 y 1280 px                                         |

Menores corregidos: enlaces directos sin descargar el mapa; reporte, filtros y listado conservados al volver de un detalle, con `Volver al reporte`; referencias ajenas fuera del control de demo; "1 día"; contador del listado según los filtros; agrupación entregada sin lista vacía; registros de `localStorage` validados reproduciendo `recordAction`; `removeItem` bloqueado sin pantalla en blanco; eventos con fecha inválida ignorados; scroll al inicio al cambiar de página o identidad; nombres accesibles en español y concordancia; `Saltar el mapa`; foco visible en el selector de fecha; leyenda oculta sin mapa; HTML válido en la bandeja y la ficha; retirados "CONTROL LOGÍSTICO", el contador repetido de la bandeja y la referencia repetida del detalle; "Sin previsión" como único texto para la ETA ausente.

Sin cambios tras repetir las comprobaciones: los pasos de la demo coinciden con el dominio y terminan solo con el documento de ATL-TR-004; el reporte coincide con un recálculo independiente en sus combinaciones de filtros; el perímetro se mantiene en las cinco identidades; sin WebGL y sin teselas la aplicación sigue siendo útil; las variantes de `localStorage` incompatible arrancan sin errores; movimiento reducido correcto.

Verificación final: `pnpm check`, `pnpm test` (27 archivos, 133 pruebas) y `pnpm build` correctos; consola sin errores en los recorridos normales.

### Rendimiento medido

Build de producción en `vite preview`, localhost, Apple M3 Pro, Chromium headless con WebGL por software. Medianas de 7 cargas; interacción del clic al segundo fotograma.

| Carga (ms)       | Sin limitar | CPU 4x |
| ---------------- | ----------- | ------ |
| DOMContentLoaded | 48          | 137    |
| FCP y LCP        | 140         | 348    |
| Bloqueo total    | 1           | 6      |
| Mapa listo       | 924         | 1.312  |

| Interacción (ms)     | Sin limitar | CPU 4x |
| -------------------- | ----------- | ------ |
| Avanzar paso         | 20          | 46     |
| Seleccionar marcador | 19          | 32     |
| Buscar en el listado | 13          | 25     |
| Cambiar de identidad | 83          | 102    |
| Abrir el listado     | 60          | 99     |
| Abrir detalle        | 9           | 28     |
| Generar reporte\*    | 21          | 33     |

\* Sin los 1,8 s de espera deliberada. Transferencia con gzip: 558 kB propios y unos 111 kB de teselas, más el worker (147 kB) y `map-land.geojson` (95 kB), calculados. Antes de corregir, con 1,6 Mbps y 150 ms de latencia, el mapa tardaba unos 6,9 s; esa medida no se repitió. Localhost no representa la red de producción.

### Limitaciones documentadas

- Sin comprobar: lector de pantalla real, Safari, Firefox, táctil real, GPU real y salida de pantalla completa con Escape.
- Teclado: `Saltar el mapa` evita las paradas del mapa, pero la bandeja sigue tras las filas de la lista. La trampa de foco del diálogo perdió el foco con Tab cada 40 ms o menos en 2 de 3 ejecuciones y se mantuvo a 80 ms; es una sospecha sin efecto observado a velocidad humana.
- Contraste: axe cubre el texto de las pantallas revisadas, no el color de las rutas ni los iconos. Se mantiene texto de 9 y 10 px por densidad de la interfaz.
- Dominio, no alcanzable con los datos actuales: una entrega sin `CUSTOMS_RELEASED` deja el envío entregado con la incidencia de aduana activa, y un aviso de retraso con ETA en plazo no deja incidencia.
- Textos: el mensaje original del operador se conserva aunque repita el título del evento; conviven "ETA" y "Llegada prevista"; la cronología del cliente describe cada evento en presente con su fecha; "Muestra insuficiente" convive con "Ver envíos (1)" en periodos cortos.
- Solo frontend: `/documents/*.html` responde por URL directa y el dataset completo va en el fragmento principal, de unos 650 kB sin comprimir. El aviso de tamaño del build sigue activo, también por MapLibre.

## Resultado de la fase 5

Publicada el 4 de noviembre de 2026 por el agente principal en <https://web-production-ebee6c.up.railway.app>. Railway sustituye a Vercel por decisión del usuario. Proyecto `shipment-tracking-demo`, servicio `web`, entorno `production`, desplegado primero con `railway up` y conectado después a GitHub: cada push a `main` despliega.

Se retira `vercel.json` y no se añade `railway.json`, que Railway marca como obsoleto. Railpack detecta Vite y pnpm, ejecuta `pnpm build` y sirve `dist` con Caddy.

| Criterio           | Resultado sobre la URL publicada                                                                                                 |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| Build              | Railway compila con el lockfile; `index.html` idéntico al build local. Despliegue en estado `SUCCESS`                            |
| Carga directa      | `/`, `/shipments`, `/shipments/shipment-es-001` y `/analytics` responden 200 con la aplicación                                   |
| Recarga            | `/shipments/shipment-tr-004` carga con el envío, el paso y la actividad guardados                                                |
| Recursos estáticos | Fragmentos, favicon, `map-land.geojson` y documentos responden 200 con gzip. Mapa renderizado con teselas                        |
| Recorrido          | ATL-TR-004: selección en el mapa, documento aportado, aviso registrado, aviso visible para Levante Retail, liberación y reinicio |
| Perímetro          | Levante Retail no ve envíos ajenos; `/shipments/shipment-gb-015` lo devuelve a su listado                                        |
| Reporte            | Generado con corte 01 nov, 13:00; hallazgos visibles y `ATL-ES-012` abierto desde el reporte con `Volver al reporte`             |
| Móvil              | 390 × 844 sin desbordamiento horizontal y sin peticiones fallidas                                                                |

Antes de publicar, `pnpm check`, `pnpm test` (27 archivos, 133 pruebas) y `pnpm build` correctos. El registro de consola quedó vacío en las capturas de carga de escritorio y móvil; no se capturó durante cada acción.

### Limitaciones de la publicación

- La cartografía usa las teselas públicas de OpenStreetMap, no aptas para tráfico alto según su política de uso.
- La recaída en `index.html` también responde 200 en rutas y recursos inexistentes, como `/assets/no-existe.js`. Una pestaña abierta durante un despliegue puede fallar al pedir un fragmento antiguo; `ErrorBoundary` lo contiene y recargar lo resuelve.
- Los recursos con hash no llevan `Cache-Control` de larga duración.
- Se mantienen las limitaciones de la fase 4. No se ha repetido en Railway la medición de rendimiento ni se ha probado en Safari, Firefox o dispositivos reales.
