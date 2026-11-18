# Etapa 4 — Carrito y agregados

## Estado local y alcance

Se inspeccionaron los archivos de la carpeta local antes de implementar. El origen Git configurado coincide con el repositorio proporcionado. Al inicio, la única modificación preexistente era `.firebase/logs/vsce-debug.log`; no se descartó ni se editó ese registro. No se descargó otra copia del repositorio ni se escribieron archivos remotos.

La rama `etapa-4-carrito-agregados` se creó en la primera parte del trabajo, cuando estaba expresamente solicitada. Después de la aclaración de trabajar sobre la carpeta y rama actuales, no se hicieron más cambios de rama. No se realizaron commits, pull, reset, checkout, merge, push ni despliegues de esta entrega. Los cambios de implementación siguen sin confirmar para revisión local.

La base ya tenía Firebase Authentication, Firestore, catálogo SCM, operaciones ERP, CRM, navegación por roles y compatibilidad con archivos locales. El checkout, los saldos y las promociones eran locales o simulaciones sin registros financieros persistentes. Se conservaron páginas, clases visuales, colores, fuentes, búsqueda, filtros, detalles, comentarios, publicaciones y subastas existentes. Los archivos heredados vacíos `mis-publicaciones.html`, `publicar-producto.html` y `subasta.html` no se sustituyeron por otra web.

## Módulos, cambios y validación

| Módulo | Implementación y archivos principales | Validación ejecutada | Configuración pendiente |
|---|---|---|---|
| Catálogo y carrito | `js/shop.js`, `js/commerce-client.js`; catálogo real SCM, existencias, cantidades, quitar/vaciar, carrito por UID, revisiones y migración idempotente del visitante | Pruebas unitarias y Chrome: búsqueda, filtros, CRUD del carrito, rechazo por stock, persistencia y recarga sin duplicar | Publicar la callable `commerce` y reglas nuevas |
| Checkout y pagos | `checkout.html`, `checkout.js`, `functions/commerce.cjs`; datos de entrega, cotización del servidor, folio, comprobante, pago persistente y confirmación | Compra completa en Chrome; transacciones reales en Firestore Emulator; doble clic, reintento y recarga | Functions y sus permisos de ejecución; revisar dominio de Authentication |
| Comprobantes y correo simulado | `functions/receipt.cjs`, `js/receipts.js`, checkout y perfil; ticket completo persistido, vista previa del correo y descarga; comprobante pendiente y confirmado para transferencias | Revisión del código de integración; estos cambios finales no se ejecutaron en pruebas por instrucción del usuario | Desplegar la versión actual de `commerce` y las reglas de `notificaciones`; no requiere proveedor de correo real |
| Monedero | `js/commerce-ui.js`, perfil y administración; saldo inicial cero, recargas simuladas, movimientos y ajustes auditados | Compra, saldo insuficiente, cargo único, recarga y ajuste autorizados; reglas niegan escritura directa incluso a admin | Backend y reglas desplegados; no requiere proveedor de pagos |
| Promociones e IVA | `js/promociones.js`, `promociones.html`, administración y backend; porcentajes, vigencia, categoría/producto, mínimos, topes y usos; IVA administrable | Promociones vencidas y límite de uso, redondeo, administración desde formulario, publicación y aplicación junto con IVA | Guardar la configuración inicial desde administración y crear promociones reales |
| Tickets | `contacto.html`, perfil, vista de atención; cliente CRM, pedido opcional, historial y respuestas | Creación y respuesta en backend, reglas y Chrome; ventas responde y el cliente recibe la respuesta | Backend/reglas; no se configuró correo de notificación externo |
| Perfil y permisos | `js/profile.js`, `js/access.js`, `js/auth.js`; edición personal y datos CRM, historial Firestore, monedero/tickets y roles actuales | Pruebas de roles, aislamiento entre cuentas, edición y navegación en Chrome | Conservar cuentas verificadas y perfiles `usuarios/{UID}` válidos |

La compatibilidad de carga local se conserva mediante scripts clásicos para los archivos compartidos; no se reintrodujeron imports de módulos locales bajo `file:///`. Firebase y las funciones de servidor siguen requiriendo conexión y configuración real. Nunca se anuncia una compra exitosa cuando la callable falla o no existe.

El desarrollo de los módulos solicitados queda en esta carpeta local. El cierre incluye correcciones de integración revisadas en código. Por instrucción final del usuario se detuvo la ejecución y ampliación de pruebas: los resultados históricos que se detallan más abajo no certifican los últimos ajustes ni el funcionamiento del proyecto desplegado.

## Ajustes finales de integración

- Los procesos ERP creados por tarjeta, monedero y confirmación de transferencia guardan `unidades_vendidas` y el detalle de movimientos SCM, con el mismo formato que espera la pantalla de procesos existente. Se conservan los reportes y los IDs deterministas de cada operación.
- Los cargos de compra del monedero incluyen actor, motivo y saldo posterior; los ajustes administrativos requieren motivo también en el backend. Se valida que el saldo almacenado sea un entero antes de modificarlo.
- La administración escucha cambios del IVA y del monedero que se está consultando, incluidos sus movimientos. Los cambios del impuesto recibidos de otra ventana no sobrescriben un formulario con ediciones pendientes.
- Las vistas de comercio reaccionan a cambios de Authentication, cancelan sus listeners al cambiar de cuenta y descartan respuestas de la sesión anterior. La tienda prepara el carrito al recibir una sesión verificada, manteniendo la migración del visitante.
- Al abrir SCM se conserva la procedencia de los productos existentes; ya no se etiquetan automáticamente como `demo_scm` los registros que no tenían origen. No se eliminan productos ni se ejecuta una migración sobre datos remotos.
- Cada checkout nuevo guarda un comprobante completo y una notificación de correo simulado en la misma transacción que el pedido. La confirmación de una transferencia actualiza el comprobante y registra su notificación confirmada junto al pago y la salida de stock.
- El historial abre el comprobante persistido y permite descargarlo. El checkout y el detalle abierto en el perfil reciben los cambios de estado del pedido; se distingue una transferencia pendiente de una compra confirmada.
- El CRM registra `ultima_compra` y `ultimo_pedido_id` solo al aprobar el pago simulado. Un cliente nuevo de transferencia pendiente comienza como `Prospecto`; al confirmar pasa a `Activo`, sin reemplazar otras etapas CRM existentes.
- Si cambia la cuenta durante el checkout, se ocultan los datos del comprobante, se cierra la factura abierta y se descartan cotizaciones y respuestas de la sesión anterior.

Estos ajustes finales no se volvieron a ejecutar en pruebas, Chrome ni emuladores, conforme a la instrucción de cierre. La ampliación previa del recorrido administrativo en `tests/commerce-browser.cjs` quedó conservada, sin un resultado final confirmado; no se contabiliza como aprobada.

## Correcciones posteriores: carrito, detalle y error `internal (0)`

- Se corrigió la propagación del clic del detalle: la tarjeta contenía `stopPropagation()`, por lo que el manejador delegado de agregar al carrito no recibía el evento. Cerrar con el botón o pulsando el fondo ahora se maneja sin bloquear los botones internos.
- El catálogo utiliza el ID real del documento SCM, incluso cuando el documento contiene un campo `id` anterior, y oculta productos desactivados. El detalle deshabilita la compra cuando no hay existencias y rechaza cantidades vacías, decimales o fuera de stock.
- La lectura del carrito local admite tanto `price` como `priceCents` y tolera contenido mal formado sin detener la carga de la tienda. La sincronización posterior a una compra conserva ambos formatos necesarios para la interfaz.
- El modal conserva imágenes en una zona de tamaño estable, tiene desplazamiento interno y una columna en pantallas pequeñas. Se consolidaron estilos duplicados y se mantiene el espacio de la barra de desplazamiento para evitar que se mueva el fondo. Nombres, descripciones y atributos se escapan antes de insertarse: el contenido de un producto no puede introducir HTML que cambie el diseño. Se conservan cantidad, imagen elegida y desplazamiento al actualizar el catálogo. Se retiraron estrellas y especificaciones genéricas que no procedían del producto.
- Si se pierde la respuesta de `checkout`, se consulta el mismo identificador con `orderLookup` antes de mostrar el fallo; esa recuperación no envía otro pago. Una consulta fallida de la vista previa del saldo no bloquea tarjeta o transferencia; el servidor sigue validando el saldo al pagar con monedero.
- El cliente distingue errores de transporte, servicio no encontrado y errores con referencia del servidor. El código `0` es una ausencia de respuesta HTTP visible para el navegador, según el manejo de `fetch` del SDK instalado; no permite concluir por sí solo si falta el despliegue, hay un bloqueo CORS/IAM o falló la conexión. No equivale a una aprobación o rechazo financiero confirmado.
- La configuración local de la callable explicita `cors: true` e invocación HTTP pública, manteniendo obligatoria la cuenta verificada y las comprobaciones de rol dentro del backend. Los errores inesperados dejan una referencia correlacionable y código del fallo en los registros, sin guardar solicitudes, datos personales ni datos de pago.

Archivos de esta corrección: `js/shop.js`, `styles/equipo.css`, `js/commerce-client.js`, `checkout.js`, `functions/index.js` y este documento. No se ejecutaron nuevas pruebas ni se desplegó Firebase. Por tanto, no se declara resuelta la conectividad del servicio del proyecto real: los cambios de CORS/IAM y diagnóstico del servidor requieren desplegar la versión actual de `commerce` con autorización. Si el navegador bloquea el origen `file:///`, se debe servir la misma carpeta por HTTP local; esto no mueve ni duplica el proyecto.

### Diagnóstico de la URL del backend

Tras el nuevo reporte de conexión se consultó únicamente la URL pública configurada `https://us-central1-camping-3a6a4.cloudfunctions.net/commerce`, sin enviar solicitudes de compra ni datos de usuario. Tanto `OPTIONS` con origen `null` como `GET` devolvieron **HTTP 404**; no se recibió `Access-Control-Allow-Origin`. Esto confirma que el servicio no está disponible en esa dirección y explica el error de transporte que recibe el navegador.

No se confirmó si existe otra función en otra región: no hay una sesión activa de gcloud disponible para consultar el inventario del proyecto. El 404 de esta URL no demuestra por sí solo que el proyecto carezca de cualquier función publicada. Abrir los archivos con localhost no publica una función inexistente en esa dirección.

La configuración y el código locales apuntan ambos a `commerce` en `camping-3a6a4`, región `us-central1`. La solución requiere publicar el backend y sus reglas con autorización, o proporcionar la dirección de una función equivalente ya desplegada para corregir la configuración local. Sigue pendiente la autorización para desplegar y, si hace falta, iniciar sesión con una cuenta que tenga permisos sobre el proyecto. No se ejecutaron despliegues, compras, pruebas automatizadas ni emuladores durante este diagnóstico.

### Configuración preparada del servicio de compras

Se volvió a leer el estado Git y los archivos locales, conservando los cambios anteriores. La consulta pública más reciente también devolvió 404 tanto en GET como en OPTIONS con origen `http://localhost:5500`. No hay una sesión activa de Google Cloud disponible para consultar el inventario administrativo. El diagnóstico confirma la ausencia de servicio en la URL configurada; no afirma que no exista una función en otra región o proyecto.

| Archivo revisado | Configuración y ajuste |
|---|---|
| `.firebaserc` | Nuevo alias de proyecto predeterminado `camping-3a6a4`; no cambia recursos remotos |
| `functions/index.js` | Exporta `exports.commerce` con `onCall` de segunda generación, región `us-central1`, `cors: true`, `invoker: public`; Admin SDK apunta expresamente al proyecto y rechaza una ejecución en otro proyecto |
| `functions/commerce.cjs` | Mantiene todas las transacciones y permisos; valida sesión, correo verificado y estructura de la solicitud antes de operar |
| `functions/package.json` | Entrada CommonJS `index.js`, runtime Node 22, dependencias Admin/Functions y lockfile coherentes; no se sustituyeron dependencias |
| `firebase.json` | Código fuente `functions`, codebase `commerce`, runtime `nodejs22`, reglas e índices locales ya declarados; no se reinicializó la configuración existente |
| `js/commerce-client.js` | Usa `getFunctions(app, us-central1)` y `httpsCallable(..., commerce)`; verifica el proyecto Firebase activo, clasifica errores y valida la respuesta de pedido |
| `js/commerce-ui.js` | Mantiene sus llamadas a `RutaCommerce.call`; los errores mejorados llegan a los formularios existentes sin sustituir el backend ni el diseño |
| `checkout.js` | Solo presenta la confirmación con un pedido válido del servidor y un comprobante coherente; `completed(order)` requiere el pedido y la cuenta propietaria |
| `js/shop.js` | Guarda primero el borrador local y reporta un cliente no cargado o un fallo de sincronización; no presenta ese fallo como una escritura Firestore exitosa |

Se conserva el protocolo callable completo: el SDK suministra el ID token de Firebase y el backend utiliza `request.auth`. No se cambió a `onRequest`, no se envían compras con un `fetch` incompatible ni se consulta una página HTML como si fuera la respuesta de un pago. La [documentación de funciones callable](https://firebase.google.com/docs/functions/callable) describe este protocolo, CORS y `HttpsError`.

`cors: true` admite localhost, los dominios de Firebase Hosting, el futuro dominio propio y el origen local `null`. La autorización financiera depende de Authentication y del perfil/rol en Firestore. El acceso HTTP público permite que el navegador alcance la callable y su preflight; no concede autorización para comprar sin cuenta verificada. Estas opciones solo se aplicarán al servicio remoto cuando se publique la función. Los dominios autorizados de Authentication son una configuración distinta de CORS.

Los errores conservan `code` e incorporan `category`, estado HTTP cuando es visible y metadatos no secretos del servicio. Se distinguen sesión ausente/expirada, permisos de la cuenta, invocación HTTP 403 de infraestructura, 404 del endpoint, permisos del backend sobre Firestore, CORS explícito y fallos del servidor. Un error de transporte `0` sin respuesta no se etiqueta falsamente como una causa única: el navegador puede ocultar por igual un 404 sin CORS, IAM o una caída de red. Las referencias del servidor permiten localizar fallos sin registrar datos personales ni solicitudes de pago.

Una respuesta vacía, con otro estado, otra cuenta o sin un pedido de checkout válido no aprueba una compra. Antes de sincronizar el carrito se exige el pedido confirmado por el backend; la sincronización lee el carrito del servidor. Ante un resultado de pago desconocido se consulta el mismo identificador, sin generar otra compra. Continúan intactos el inventario SCM, cargo de monedero, importes, pago, pedido, comprobante, correo simulado e integración CRM/ERP de la transacción.

### Pasos de Firebase pendientes de autorización

Los siguientes comandos son instrucciones para ejecutar desde esta misma carpeta **después de autorizar la configuración y el despliegue**. No se ejecutaron como parte de esta corrección:

```powershell
npx --yes firebase-tools login
npx --yes firebase-tools functions:list --project camping-3a6a4
npm ci --prefix functions
npx --yes firebase-tools deploy --only "functions:commerce,firestore:rules" --project camping-3a6a4
```

`functions:list` permite confirmar el nombre y la región con una cuenta autorizada. Si muestra una versión anterior de `commerce`, el despliegue actualiza el mismo servicio. Si solo existe en otra región, debe decidirse expresamente si publicar la versión de esta entrega en `us-central1` o cambiar ambos extremos a la región real; no se elimina automáticamente la función anterior. La selección `functions:commerce` apunta al codebase que contiene la exportación `commerce`, según la [configuración de codebases de Firebase](https://firebase.google.com/docs/functions/organize-functions). El comando publica únicamente ese backend y las reglas. Las consultas de esta entrega usan índices simples: se conservan los índices compuestos remotos existentes sin publicar la definición local vacía. Hosting conserva su configuración actual.

Antes de publicar, el propietario debe habilitar la facturación/plan Blaze y las APIs requeridas por Functions de segunda generación si todavía faltan; Firebase documenta ese requisito en [primer despliegue de Functions](https://firebase.google.com/docs/functions/get-started). La cuenta que despliega debe poder publicar Functions y establecer los permisos de su servicio Cloud Run. La cuenta de servicio de ejecución necesita acceso de lectura y escritura a Firestore, por ejemplo `roles/datastore.user`, además de los permisos de plataforma que corresponda conservar. No se verificaron ni se cambiaron estas asignaciones remotas.

`invoker: public` prepara la invocación desde el navegador. Si después de publicar aparece un 403 de infraestructura, revisar en el servicio Cloud Run de `commerce` que `allUsers` tenga `roles/run.invoker`, de acuerdo con la política del proyecto. Es una asignación al servicio, no un rol administrativo para los clientes. El responsable debe autorizar cualquier modificación IAM; una política de organización puede impedirla. Véase [acceso público a Cloud Run](https://cloud.google.com/run/docs/authenticating/public). No se modificaron roles remotos ni se deshabilitó la validación de Firebase Authentication.

En Authentication se deben conservar correo/contraseña, verificación y perfiles vinculados al UID; añadir `localhost` y el dominio real del sitio a dominios autorizados si faltan. Para usar HTTP local puede servirse la carpeta actual, sin copiarla:

```powershell
python -m http.server 5500 --bind 127.0.0.1
```

Abrir `http://localhost:5500/equipo.html`. El almacenamiento de visitantes pertenece a cada origen del navegador: el carrito de `file:///` no se traslada automáticamente a localhost; una compra autenticada utiliza su UID y Firestore una vez publicado el servicio. El servidor local tampoco publica `commerce`: la URL remota debe dejar de devolver 404.

Después de un despliegue autorizado se podrán leer errores del servicio con `npx --yes firebase-tools functions:log --only commerce --project camping-3a6a4`. Hasta entonces el carrito de visitante puede funcionar localmente; la persistencia autenticada, cotizaciones, checkout, pedidos, monedero y demás operaciones de la callable necesitan ese backend real y las reglas de esta entrega. No hay una compra de producción comprobada ni nuevas baterías de pruebas para estos ajustes.

## Modelo de Firestore y relaciones

No se creó una colección paralela `pedidos`: **`erp_ordenes` es también el pedido de la tienda**. Las nuevas estructuras representan conceptos que no existían antes.

| Ruta | Propósito / relación |
|---|---|
| `usuarios/{uid}` | Perfil y rol existentes; datos personales y dirección, sin conceder roles desde el perfil |
| `clientes/{id}` | Cliente CRM existente localizado por correo; si falta se crea `auth_{uid}`, sin duplicar uno existente |
| `scm_productos/{id}` | Fuente de nombre, categoría, precio y stock; el checkout vuelve a consultarla |
| `carritos/{uid}` | `items` embebidos equivalentes a CarritoDetalle y `revision` para concurrencia |
| `carritos/{uid}/migraciones/{key}` | Registro privado de migración del visitante; impide sumar dos veces el mismo carrito |
| `erp_ordenes/{web_hash}` | Pedido canónico con usuario, cliente, productos, entrega, importes en centavos, pago, folio y estado |
| `pagos/{orderId}` | Pago simulado vinculado al mismo pedido: método, importe, estado, fecha y confirmación |
| `notificaciones/{orderId_pendiente\|orderId_confirmado}` | Correo simulado persistente ligado al usuario y pedido; destinatario, asunto, cuerpo, fecha y estado; una notificación por estado de pago |
| `monederos/{uid}` | Saldo entero en centavos; se inicializa en cero al consultar el monedero |
| `monederos/{uid}/movimientos/{operationId}` | Recargas, cargos y ajustes simulados; actor, motivo, pedido y fecha |
| `promociones/{CODIGO}` | Porcentaje en puntos base, vigencia UTC, condiciones, estado y usos |
| `configuracion/comercio` | Nombre del impuesto, `ivaBps`, `activo`, política de precios y auditoría de cambio |
| `tickets/{hash}` | Usuario, cliente CRM, pedido opcional, asunto, estado y hasta 100 mensajes de máximo 2,000 caracteres |
| `scm_movimientos/{orderId_productId}` | Salida de inventario por cada producto vendido |
| `erp_procesos/{orderId}` y `erp_reportes/{orderId}` | Operación y reporte de venta; IDs deterministas evitan duplicarlos |

El perfil muestra pedidos Firestore del propio UID. Las compras de etapas anteriores que únicamente estaban en `localStorage` permanecen identificadas como **historial local anterior**; no se convierten en ventas o pagos ficticios en Firestore. Las publicaciones comunitarias locales conservan su flujo anterior; un checkout solo acepta IDs existentes y disponibles en SCM.

## Comprobante digital y correo simulado persistente

`functions/receipt.cjs` genera el comprobante a partir de los importes definitivos y los productos del pedido. Se guarda en `erp_ordenes/{id}.comprobante`, con nombre de Ruta Salvaje, folio, fecha y hora de Ciudad de México, nombre y correo del comprador, entrega, productos, cantidades, precios unitarios, subtotal, descuento, base gravable, IVA, total, método y estado del pago simulado. Incluye una versión de texto para descargar; no se reconstruyen importes a partir del catálogo actual al consultar una compra anterior. Los nuevos folios usan el hash completo del ID del pedido; los folios ya guardados no se cambian.

El destinatario de una compra nueva procede del correo del token verificado de **Firebase Authentication**, validado también contra el perfil vinculado. Se conserva en `comprador_email` como parte de la compra. Cuando un empleado confirma una transferencia se utiliza ese correo del comprador, nunca el de la cuenta administrativa.

La colección `notificaciones` guarda `usuario_id`, `orden_id`, `folio`, `canal: correo_simulado`, `tipo`, `destinatario`, `asunto`, `cuerpoTexto`, `fecha`, `estado: envio_simulado`, `simulado: true` y `envio_real: false`. El pedido conserva `correo_comprobante` con la referencia y los metadatos de esa misma notificación. Las reglas permiten su lectura al propietario y a administración/ventas; ningún cliente, incluido admin, puede escribir estos registros directamente.

Tarjeta y monedero registran el evento `{orderId}_confirmado`. La transferencia registra primero `{orderId}_pendiente`; su confirmación crea `{orderId}_confirmado` y actualiza el comprobante del pedido. El evento pendiente queda conservado como antecedente. Los IDs deterministas, el estado persistido y la transacción evitan crear otro correo, cargo o movimiento de inventario al reintentar. Una transacción rechazada no produce una notificación de éxito.

La pantalla de confirmación y el detalle del historial muestran el ticket, el mensaje de simulación y una vista previa del destinatario, asunto, fecha, estado, ID y contenido del correo registrado. Ambos permiten descargar el comprobante en TXT. Una transferencia pendiente no habilita la factura simulada hasta confirmar su pago. La factura existente sigue siendo una simulación y no es un CFDI.

Para pedidos Firestore de checkout anteriores a este cambio, `receiptGet` y la recuperación de compra generan el comprobante faltante de forma transaccional, sin repetir pago, inventario ni ventas. Se conserva el correo original cuando existe; en pedidos anteriores que no lo guardaban se utiliza el correo verificado de la cuenta propietaria o su perfil vinculado. No es posible reconstruir un correo histórico que nunca se almacenó. No se fabrican registros financieros a partir del historial local anterior.

No se encontró un servicio de correo transaccional real en los archivos existentes. Esta entrega **no envía correos de compra reales**: persiste su contenido y señala expresamente que se simuló el envío. Los correos de verificación y recuperación de Authentication conservan su flujo independiente. No se necesita SMTP para el mecanismo solicitado; enviar correos reales requeriría una integración adicional autorizada y guardar el resultado del proveedor.

## Operaciones equivalentes a endpoints

La función HTTPS callable exportada es `commerce`, región `us-central1`, código en `functions/index.js`. Se invoca con `{action, ...datos}` mediante `httpsCallable`. Authentication suministra el token; no se toman UID, rol, precio o saldo del almacenamiento del navegador como prueba de autorización.

| Endpoint lógico | `action` / acceso |
|---|---|
| GET /carrito | `cartGet`, propia cuenta verificada |
| PUT /carrito | `cartSave`, revisión esperada + IDs y cantidades; precio/stock se obtienen de SCM |
| POST /carrito/migrar | `cartMerge`, propia cuenta y clave de migración persistente |
| POST /checkout/cotizar | `quote`, carrito de servidor y código promocional opcional |
| POST /pedidos | `checkout`, cotización vigente, entrega, método y clave idempotente |
| GET /pedidos/por-solicitud | `orderLookup`, clave del usuario; recuperación tras una respuesta perdida |
| GET /pedidos/{id}/comprobante | `receiptGet`, propietario o administración/ventas; recupera o genera el comprobante faltante sin repetir la compra |
| POST /pagos/transferencias/confirmar | `transferConfirm`, administración o ventas |
| GET /monedero | `walletEnsure` inicializa saldo; lectura propia protegida por reglas |
| POST /monedero/recargas | `walletTopup`, propia cuenta; **simulación**, nunca dinero real |
| POST /monederos/ajustes | `walletAdjust`, solo administración, motivo obligatorio en pantalla y servidor, con auditoría de actor |
| PUT /promociones/{codigo} | `promotionSave`, solo administración; permite activar/desactivar |
| PUT /impuestos/configuracion | `taxSave`, solo administración |
| POST /tickets | `ticketCreate`, usuario verificado, cliente CRM y pedido propio opcional |
| POST /tickets/{id}/respuestas | `ticketReply`, propietario o administración/ventas; solo personal cambia el estado administrativo |
| PUT /perfil | `profileSave`, propia cuenta; no modifica rol ni correo autenticado |

Las lecturas de catálogo, promociones y configuración son públicas. Las lecturas de pedidos, pagos, notificaciones, carritos, movimientos y tickets están protegidas por `firestore.rules`; se consultan por `usuario_id` para usuarios normales. Admin puede gestionar monederos; administración y ventas pueden atender tickets y transferencias; logística conserva sus módulos SCM/ERP sin obtener acceso administrativo al saldo de otros usuarios ni a tickets ajenos.

## Importes, pagos e inventario

- Todos los precios de venta SCM se interpretan **antes de IVA**. El impuesto se calcula una sola vez sobre `subtotal − descuento`. No se suma IVA sobre un precio ya gravado dentro de este modelo: si el catálogo que se vaya a publicar usa precios con IVA incluido, se debe normalizar su precio neto antes de activar la etapa. No se modificaron automáticamente precios existentes.
- Configuración inicial efectiva: IVA 16%, `1600` puntos base. El backend utiliza ese valor si todavía no existe `configuracion/comercio`; administración puede persistirlo o cambiarlo desde la nueva pantalla. No hay datos promocionales sembrados automáticamente.
- Precio, descuento, base, IVA y total se calculan con centavos enteros, validaciones de límites y redondeo half-up. Se guardan los importes definitivos en el pedido. Ejemplo: 100,000 centavos de base y sin descuento generan 16,000 de IVA y 116,000 de total.
- Las promociones validan estado, fechas, importe mínimo, producto/categoría, tope de descuento y límite de usos. El servidor vuelve a validarlas en la compra; una cotización anterior no permite conservar precios o impuestos manipulados.
- Tarjeta y monedero generan pago `aprobado_simulado`. No existen campos para capturar PAN/CVV ni un proveedor de pagos real. El backend rechaza campos extra de tarjeta en la solicitud.
- Una transferencia crea pedido `pendiente_pago` y pago `pendiente_confirmacion`, **sin descontar stock ni generar una venta pagada en reportes**. Administración o ventas confirma la simulación; entonces se valida de nuevo el stock y la promoción y se registran pago, inventario y ERP atómicamente. Si el stock se agotó o la promoción venció, la confirmación se rechaza y el pedido queda pendiente; no se presenta como una venta pagada.
- La transferencia no reserva existencias. El importe acordado se guarda al crear el pedido; no se recalcula el precio del catálogo al confirmar, pero se exige stock y condiciones promocionales válidas. Los usos de la promoción se consumen al confirmar el pago, no al crear la transferencia pendiente.
- Confirmación de compra, pago, cargo del monedero, salida SCM, reporte/proceso ERP y limpieza del carrito se guardan en una sola transacción. Si falla, no hay escrituras parciales y el carrito del servidor se conserva. Se bloquean cargos que dejarían saldo negativo.
- La clave de compra se conserva en `sessionStorage`. El ID de pedido depende del UID y esa clave, y un hash vincula la solicitud con su cotización. Reintentos y doble clic no crean otro pago ni cargo. La recarga/ajuste usa una clave propia y movimientos deterministas. Las respuestas de tickets también tienen claves de reintento.
- El carrito de visitantes se mantiene local. Se borra su copia de migración únicamente después de que el backend confirme la sincronización. Si falla una escritura autenticada, se conserva el borrador local y se informa el error. Las revisiones evitan sobrescribir cambios de otra ventana silenciosamente.
- El comprobante y su correo simulado usan exclusivamente el pedido persistido. Se descargan desde confirmación e historial y distinguen pago pendiente y aprobado. La factura conserva su carácter **simulado**; no es un CFDI ni un servicio de facturación fiscal.

## Pruebas ejecutadas antes del cierre y límites

Entorno utilizado: Windows, Node 24 para ejecución local, Java 21, Chrome y Firestore Emulator 1.22.0. Runtime configurado para Firebase Functions: **Node 22**. Los datos de prueba se crean exclusivamente en memoria o en el proyecto de emulador `demo-ruta-etapa4`.

Se conservan los siguientes resultados observados antes de los ajustes finales. No se ejecutaron nuevas rondas después de que el usuario solicitó dejar de probar. **Los comprobantes ampliados, la nueva colección de notificaciones, su regla, `receiptGet` y los ajustes de sesión posteriores no están cubiertos por esos resultados históricos.** El recorrido completo adicional de todas las pantallas administrativas no tiene un resultado confirmado y no se afirma una certificación funcional de cada pantalla heredada. No se ampliaron archivos de pruebas para los cambios de cierre.

1. `npm test`: **21 pruebas aprobadas** (11 de acceso/sincronización existentes y 10 de comercio). Incluyen centavos y redondeo, migración/revisiones del carrito, compra idempotente con monedero, rechazo por stock/saldo, cotización invalidada por cambio de IVA, promociones vencidas/usos, roles, tickets y actualización CRM.
2. `npm run test:emulator`: **7 pruebas aprobadas** contra Firestore real emulado y las reglas del repositorio. Incluyen compra completa, dos compradores concurrentes de la última unidad, transferencia pendiente y confirmación concurrente única, rollback, promoción vencida, aislamiento de datos y persistencia de tickets/perfil.
3. `node tests/commerce-browser.cjs`: **26 comprobaciones aprobadas** usando las páginas y scripts reales en Chrome, con transporte local de Auth/SDK y el servicio de backend real sobre un adaptador de pruebas en memoria. Se probaron búsqueda/filtro, carrito, recarga de página, checkout y validación de dirección, IVA, ausencia de campos de tarjeta, compra/recibo sin cargo doble, perfil, monedero, respuesta de ventas, administración de promociones/IVA/saldos, edición personal, transferencia y promociones públicas. **Esta prueba no es una compra contra Firebase de producción ni una validación de correo real.**
4. Se comprobó sintaxis de los scripts e inline HTML, IDs sin duplicados y orden de carga de scripts compartidos. No se sustituyeron las reglas por reglas abiertas para obtener resultados positivos.

El emulador se inicia con idioma inglés porque su paquete `es_MX` falla al generar mensajes de denegación; esto no cambia las reglas ni el idioma del sitio. Los `PERMISSION_DENIED` de las pruebas negativas son resultados esperados. El runner rechaza reutilizar un puerto ocupado, limita el tiempo de ejecución y termina su propio emulador al finalizar.

No se comprobaron con cuentas reales: despliegue/IAM de Cloud Functions, correos de registro/verificación/recuperación, dominio autorizado, ni una compra contra el proyecto productivo. Tampoco se ejecutó una descarga manual del archivo de comprobante ni se certificaron visualmente todos los navegadores móviles. Se conservaron los flujos de Authentication existentes; CAPTCHA/App Check humano y equivalentes quedan fuera de esta Etapa 4.

## Instalación, emulador y configuración pendiente

```powershell
npm ci
npm ci --prefix functions
npm test
npm run test:emulator
node tests/commerce-browser.cjs
```

Para el runner de Firestore, configurar `FIRESTORE_EMULATOR_JAR` si el JAR oficial no está en la ruta por defecto. También admite `JAVA_BIN`; la prueba de navegador admite `CHROME_BIN`. Se necesitan permisos de loopback para Java y Chrome. Las carpetas `node_modules` y archivos de entorno no se deben confirmar en Git.

**Antes de habilitar la aplicación en Firebase real**, y solo con autorización para desplegar:

1. Instalar/usar Firebase CLI e iniciar sesión con la cuenta del proyecto correcto. El proyecto existente en el código es `camping-3a6a4`; verificar que sea el proyecto de destino.
2. Habilitar correo/contraseña de Firebase Authentication, mantener verificación de correo y perfiles `usuarios/{UID}` con `uid`, `auth_uid`, `email` y roles actuales. No conceder privilegios por el texto del correo ni por `localStorage`.
3. Habilitar la facturación y APIs necesarias para Cloud Functions de segunda generación; verificar IAM de la cuenta de servicio y ejecución de funciones. No crear una pasarela de pagos real.
4. Revisar la política de precios netos y el catálogo SCM actual. No se fabrican productos, saldos, clientes ni promociones para producción.
5. Desplegar, cuando se autorice: `firebase deploy --only "functions:commerce,firestore:rules" --project camping-3a6a4`. **Este comando no fue ejecutado.** La configuración incluye la función `commerce` en `us-central1`, `functions/receipt.cjs`, la acción `receiptGet` y las reglas nuevas de `notificaciones`. Firestore crea los documentos de notificaciones al confirmar cada transacción; no hay que sembrar correos de ejemplo ni crear un índice compuesto para este flujo. Se conservan los índices remotos existentes. No se despliega Hosting automáticamente.
6. Entrar como administrador y guardar nombre/estado/porcentaje del IVA (valor inicial 16%). Crear las promociones deseadas y sus condiciones. Un monedero nuevo empieza en cero; las recargas son explícitas y simuladas.
7. Antes de publicar, queda pendiente la aceptación en el proyecto configurado con cuentas propias: recuperación/verificación por correo, restricciones de rol, comprobante y notificación persistentes, descarga y transición de transferencia pendiente a confirmada. No se ejecutó esa aceptación ni otra ronda local después de la instrucción de detener pruebas.

Las operaciones que requieren backend no se degradan a escrituras financieras desde el navegador si Functions no está disponible. Se conserva el carrito y se informa el fallo. Las pruebas no requieren credenciales de producción ni despliegan código.

Documentación oficial utilizada para la integración: [funciones invocables](https://firebase.google.com/docs/functions/callable), [transacciones Firestore](https://firebase.google.com/docs/firestore/manage-data/transactions), [emulador de funciones](https://firebase.google.com/docs/functions/local-emulator).

## Archivos de esta implementación

| Archivos | Cambio |
|---|---|
| `functions/index.js`, `functions/commerce.cjs`, `functions/money.cjs`, `functions/receipt.cjs` | Callable, autorización, transacciones, estados, cálculo monetario, comprobante y notificación persistente |
| `functions/package.json`, `functions/package-lock.json` | Dependencias del backend y runtime Node 22 |
| `functions/test/commerce.test.cjs` | Pruebas unitarias de operaciones y cálculo |
| `js/commerce-client.js` | Cliente Firebase, invocación callable, carrito, consultas protegidas y seguimiento del estado del pedido |
| `js/commerce-ui.js` | Formularios y vistas de perfil/administración/contacto y listeners |
| `js/receipts.js` | Presentación compartida del comprobante persistido, vista previa del correo simulado y descarga TXT |
| `js/shop.js` | Catálogo SCM sin semillas de tienda, validación de stock, carrito persistente y resumen con IVA/promociones |
| `checkout.html`, `checkout.js`, `checkout.css` | Checkout conservado, datos requeridos, pago simulado persistente, recuperación, comprobante completo, correo simulado, seguimiento de transferencia y descarga |
| `profile.html`, `js/profile.js` | Datos personales, monedero, tickets e historial Firestore junto al histórico local anterior |
| `admin.html`, `js/admin.js`, `js/access.js`, `js/erp.js` | Nuevas vistas por rol, promociones persistentes y conteo de transferencias pendientes |
| `js/scm.js` | Conserva la procedencia de productos existentes al abrir el módulo; evita marcarlos como demostración |
| `js/auth.js` | Sincronización del carrito tras iniciar sesión; se mantienen registro, cierre, recuperación y verificación |
| `contacto.html` | El formulario crea tickets persistentes; se conserva la navegación y el resto de la página |
| `promociones.html`, `js/promociones.js` | Ofertas y producto destacado obtenidos desde Firestore, sin promociones ficticias |
| `campana.html`, `equipo.html`, `index.html`, `login.html`, `marketing.html`, `nosotros.html` | Carga del cliente de comercio antes de sus consumidores; diseño conservado |
| `styles/admin.css`, `styles/c2c.css`, `styles/equipo.css` | Disposición adaptable de los formularios y comprobantes; modal de producto estable con los colores existentes |
| `.firebaserc`, `firebase.json`, `firestore.rules`, `firestore.indexes.json` | Proyecto predeterminado, Functions, emuladores y restricciones de datos/operaciones |
| `package.json`, `package-lock.json`, `.gitignore` | Comandos de pruebas, dependencias reproducibles y exclusión de artefactos locales |
| `tests/commerce-browser.cjs`, `tests/emulator.test.cjs`, `tests/run-emulator.cjs`, `tests/support/memory-db.cjs` | Pruebas de pantallas, reglas, concurrencia y adaptador de fixtures |
| `README.md`, `docs/ETAPA4.md` | Estado, modelo, pruebas, límites y configuración pendiente |

No se modificó intencionalmente `.firebase/logs/vsce-debug.log`; ya presentaba cambios antes de esta implementación.
