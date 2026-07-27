# Ruta Salvaje - E-commerce de Camping

## Descripción del Proyecto

**Ruta Salvaje** es un prototipo de sitio web para una tienda de camping, diseñado con un enfoque en la experiencia de usuario (UX) y una interfaz de usuario (UI) atractiva y funcional. El proyecto simula un E-commerce completo utilizando tecnologías front-end, donde los visitantes pueden explorar productos, gestionar un carrito de compras y navegar por diferentes secciones informativas.

La lógica de la aplicación, como el carrito de compras y los filtros, se maneja del lado del cliente con **JavaScript** y los datos persisten en la sesión del navegador a través de `localStorage`.

---

## Tecnologías Utilizadas

- **HTML5**: Para la estructura semántica del contenido.
- **CSS3**: Para los estilos base, animaciones y diseño responsivo.
- **Tailwind CSS**: Framework CSS de utilidad para un desarrollo rápido y consistente de la interfaz.
- **JavaScript (Vanilla)**: Para toda la lógica interactiva, manipulación del DOM y gestión del estado de la aplicación.

---

## Instalación y Ejecución

Este proyecto no requiere un proceso de compilación complejo. Sigue estos pasos para verlo en funcionamiento:

### Opción 1: Abrir directamente en el navegador (Recomendado)
1.  Clona o descarga este repositorio en tu máquina local.
2.  Navega a la carpeta del proyecto.
3.  Abre el archivo `index.html` con tu navegador web preferido (como Chrome, Firefox o Edge).

### Opción 2: Usar un servidor local (Opcional)
Si deseas una experiencia más cercana a un entorno de producción, puedes usar un servidor local simple.

1.  Abre una terminal en la carpeta raíz del proyecto.
2.  Ejecuta uno de los siguientes comandos:

    ```bash
    # Si tienes Python 3 instalado
    python -m http.server
    ```

    ```bash
    # Si tienes Node.js y 'serve' instalado (npm install -g serve)
    serve
    ```
3.  Abre tu navegador y visita `http://localhost:8000` (o el puerto que indique la terminal).

---

## Estructura del Proyecto

El proyecto está organizado de manera modular para facilitar su mantenimiento.

```text
Ruta Salvaje/
├── 📄 index.html             # Página de inicio
├── 📄 equipo.html            # Catálogo de productos y tienda
├── 📄 promociones.html        # Página de ofertas y descuentos
├── 📄 campana.html            # Página de campaña de marketing
├── 📄 contacto.html           # Formulario y datos de contacto
├── 📄 nosotros.html          # Información sobre la empresa
├── 📄 login.html              # Simulación de inicio de sesión
├── 📄 admin.html              # Panel de administración simulado
├── 📁 js/
│   ├── 📜 shop.js            # Lógica principal de la tienda (productos, carrito)
│   └── 📜 admin.js           # Lógica para el panel de administración simulado
└── 📁 styles/
    ├── 📜 main.css            # Estilos globales y variables CSS
    ├── 📜 equipo.css           # Estilos para la página de la tienda
    ├── 📜 contacto.css        # Estilos para la página de contacto
    └── 📜 ...                 # Otros archivos de estilo específicos
```

---

## Funcionalidades Principales

### Tienda y Catálogo de Productos (`equipo.html`)
- **Visualización de Productos**: Los productos se cargan dinámicamente desde un objeto JavaScript.
- **Filtros y Búsqueda**: Permite filtrar productos por categoría, recomendación y búsqueda por texto.
- **Vista de Detalle**: Modal con información ampliada de cada producto.

### Carrito de Compras
- **Añadir y Eliminar Productos**: Funcionalidad completa para gestionar los artículos del carrito.
- **Ajuste de Cantidad**: Permite aumentar o disminuir la cantidad de cada producto.
- **Persistencia de Datos**: El carrito se guarda en `localStorage`, por lo que no se pierde al recargar la página.
- **Códigos de Descuento**: Simulación de aplicación de códigos promocionales.

### Panel de Administración (`admin.html`)
- **Dashboard Simulado**: Interfaz para la gestión de productos, pedidos, clientes y promociones.
- **CRUD Ficticio**: Permite "agregar", "editar" y "eliminar" productos en la memoria del navegador (los cambios no son permanentes).
- **Visualización de Datos**: Tablas y gráficos que simulan métricas de ventas y actividad.

### Páginas Estáticas
- **Nosotros**: Presenta la misión, visión y valores de la empresa.
- **Contacto**: Incluye un formulario funcional (simulado) que muestra un mensaje de éxito al enviarse.
- **Promociones y Campaña**: Páginas de marketing para atraer al cliente con ofertas y contenido de valor.

---

## Flujo de Usuario (Simulado)

```
                             INICIO
                                │
                                ▼
                   Usuario entra al sitio web
                                │
                                ▼
                        Página principal
                                │
      ┌─────────────────────────┼─────────────────────────┐
      ▼                         ▼                         ▼
 Ver catálogo             Ver promociones         Iniciar sesión
      │                         │                         │
      └───────────────┬─────────┴───────────────┬─────────┘
                      ▼                         ▼
              Seleccionar producto      Acceder al perfil
                      │
                      ▼
            Ver detalles del producto
                      │
                      ▼
             Seleccionar cantidad
                      │
                      ▼
          ¿Agregar producto al carrito?
                 ┌──────┴──────┐
               Sí              No
                │               │
                ▼               ▼
      Producto agregado     Regresar al
        al carrito          catálogo
                │
                ▼
      ¿Seguir comprando?
         ┌─────┴─────┐
        Sí           No
         │            │
         ▼            ▼
 Volver al catálogo   Ver carrito
                           │
                           ▼
                 Modificar cantidades
                           │
                           ▼
               ¿Eliminar producto?
                  ┌────┴────┐
                 Sí         No
                  │          │
                  ▼          ▼
         Actualizar carrito  │
                  └────┬─────┘
                       ▼
               Calcular subtotal
                       │
                       ▼
                Ir a pagar
                       │
                       ▼
          Pantalla "Próximamente"
                       │
                       ▼
                      FIN
```

---

## Diagramas de Flujo Adicionales

### Flujo de Navegación del Usuario Registrado

Este diagrama detalla la experiencia de un usuario que ha iniciado sesión, desde el acceso a su perfil hasta la interacción con las funcionalidades C2C (venta entre usuarios).

```
                       INICIO (Click en "Iniciar Sesión")
                                  │
                                  ▼
                           Página de Login
                                  │
                                  ▼
                       Ingresar Credenciales y Enviar
                                  │
                                  ▼
                         ¿Credenciales Válidas? (Simulado)
                            ┌─────┴─────┐
                          No            Sí
                           │             │
                           ▼             ▼
                     Mostrar Error   Guardar Sesión en `localStorage`
                                         │
                                         ▼
                                Redirigir a Perfil/Inicio
                                         │
                                         ▼
                           Click en "Mi Perfil" / Icono de Usuario
                                         │
                                         ▼
                                  Panel de Usuario
                                         │
      ┌──────────────────────────────────┼──────────────────────────────────┐
      ▼                                  ▼                                  ▼
Ver Historial                       Panel de Vendedor (C2C)             Dejar Comentario
  de Compras                               │                                  │
      │                                  │                                  ▼
      ▼                                  │                          Publicar en `campana.html`
Ver lista de                             │
compras pasadas                          │
                                         ▼
                           ┌─────────────┴─────────────┐
                           ▼                           ▼
                 Gestionar Publicaciones         Participar en Subasta
                           │                           │
         ┌─────────────────┼─────────────────┐         ▼
         ▼                 ▼                 ▼     Ver temporizador
   Publicar Nuevo    Editar Pub.       Eliminar    y puja actual
      Producto         Existente       Publicación       │
                                                       ▼
                                                   Realizar Puja
```

### Flujo de Navegación del Administrador

Este diagrama muestra el flujo de acciones que un administrador puede realizar dentro del panel de control simulado para gestionar el contenido y la actividad del sitio.

```
                  INICIO (Navega a /admin.html)
                             │
                             ▼
              Verificar acceso de admin (simulado)
                             │
           ┌─────────────────┴─────────────────┐
      Acceso Denegado                      Acceso Permitido
           │                                  │
           ▼                                  ▼
Redirigir a Login/Inicio               Mostrar Panel de Administración
                                              │
           ┌──────────────────────────────────┴──────────────────────────────────┐
           ▼                                  ▼                                  ▼
    Gestionar Productos                Gestionar Pedidos                Gestionar Usuarios
           │                                  │                                  │
┌──────────┴──────────┐           ┌───────────┴───────────┐           ┌──────────┴──────────┐
▼          ▼          ▼           ▼                       ▼           ▼                     ▼
Ver Lista  Agregar    Editar/     Ver Lista de Pedidos    Cambiar     Ver Lista de          Bloquear/
de Prod.   Producto   Eliminar                            Estado      Usuarios              Desbloquear
           │          Prod.                                                                Usuario
           ▼
Formulario para nuevo
     producto
           │
           ▼
Guardar en `localStorage` (simulado)
```

---

## Diseño y Estilos

- **Paleta de Colores**: Inspirada en la naturaleza y la aventura (`--chill-dark`, `--accent-warm`, `--deep-forest`).
- **Framework CSS**: Se utiliza **Tailwind CSS** para la maquetación principal y componentes, combinado con CSS personalizado para detalles finos y animaciones.
- **Diseño Responsivo**: La interfaz se adapta fluidamente a dispositivos móviles, tabletas y computadoras de escritorio.
- **Iconografía**: Se usa **Bootstrap Icons** para mejorar la legibilidad y el atractivo visual de los elementos interactivos.

---

## Pruebas Manuales Sugeridas

1.  **Añadir un producto al carrito**:
    -   Ve a la página `equipo.html`.
    -   Haz clic en "Ver Detalle" en un producto.
    -   En el modal, haz clic en "Agregar al carrito".
    -   Verifica que el contador del carrito en la barra de navegación se actualice.

2.  **Aplicar un código de descuento**:
    -   Abre el panel del carrito.
    -   En el resumen de compra, introduce el código `RUTA10` y haz clic en "Aplicar".
    -   Verifica que se aplique un 10% de descuento al total.

3.  **Filtrar productos**:
    -   En `equipo.html`, usa el buscador o el selector de categorías.
    -   Confirma que la lista de productos se actualiza correctamente.

4.  **Persistencia del carrito**:
    -   Añade varios productos al carrito.
    -   Recarga la página.
    -   Verifica que los productos sigan en el carrito.

---

## Notas Importantes

1.  **Proyecto de Simulación**: Este es un prototipo front-end. No hay una base de datos real ni un servidor backend. Toda la "lógica de negocio" y los datos son simulados en JavaScript.
2.  **Persistencia de Datos**: El estado de la aplicación (como el contenido del carrito) se almacena en `localStorage`. Para reiniciar el estado, puedes borrar los datos de `localStorage` en las herramientas de desarrollador de tu navegador.
3.  **Formularios**: Los formularios, como el de contacto, son funcionales en la interfaz pero no envían datos a un servidor. Simplemente muestran un mensaje de confirmación.

---

## Autor
-Nombre completo: Ruiz Diaz Miguel Angel 
-ID: 23151228
-Carrera: Ingenieria en Tecnologias de la Informacion y la Comunicacion 
-Correo institucional: 23151228@aguascalientes.tecnm.mx

---

### Reflexión Final

El Proyecto en si, estuvo bien, el diseño usado fue a decision nuestra al igual que el tema en cuestion, el poder hacer la clase mas dinamica me permitio visualizar como es el trabajo de un front-end y poder poner en marcha mi creatividad en el diseño de la pagina
