export type HelpArticle = {
  id: string;
  title: string;
  body: string; // texto plano; los saltos de línea se respetan en la vista
  tags: string[];
  section: "Administración" | "Sitio Web" | "Configuración" | "Agenda" | "General";
};

// Artículos curados a partir de reglas_negocio.md, DOCUMENTACION_BD.md y las
// features del dashboard. Mantener el lenguaje simple y orientado al usuario.
export const HELP_ARTICLES: HelpArticle[] = [
  {
    id: "que-es-archivar",
    title: "¿Qué pasa cuando archivo un registro?",
    body: "Archivar NO elimina. El registro queda inactivo y deja de aparecer en los listados activos, pero podés restaurarlo cuando quieras desde la vista \"Archivados\". Funciona igual para servicios, proveedoras, categorías, máquinas, preguntas frecuentes y promos. Esto protege el historial: nunca se borra algo que ya se usó en un turno o una factura.",
    tags: ["archivar", "eliminar", "borrar", "restaurar", "inactivo", "soft delete"],
    section: "General",
  },
  {
    id: "archivados-vista",
    title: "¿Cómo veo y restauro lo que archivé?",
    body: "En cualquier listado de Administración tenés un interruptor \"Archivados\". Al activarlo, la tabla muestra SOLO los registros archivados, cada uno con un botón para restaurarlo. Al desactivarlo, volvés a ver solo los activos.",
    tags: ["archivados", "restaurar", "ver", "listado"],
    section: "Administración",
  },
  {
    id: "precio-lista-vs-efectivo",
    title: "Precio de lista vs. precio en efectivo",
    body: "El precio de lista es el valor de referencia del servicio (el que se usa para promos y facturación). El precio en efectivo es un valor opcional, normalmente menor, para pagos en efectivo. Si dejás el de efectivo vacío, se usa el de lista.",
    tags: ["precio", "lista", "efectivo", "servicio", "tarifa"],
    section: "Administración",
  },
  {
    id: "servicio-unidad",
    title: "¿Qué es el campo \"Unidad\" de un servicio?",
    body: "Es la unidad de medida o cobro del servicio: cómo se cuenta lo que se vende. Por ejemplo \"sesión\", \"hora\" o \"zona\". Es informativo y ayuda a que los presupuestos sean claros. Si lo dejás vacío, no pasa nada.",
    tags: ["servicio", "unidad", "unit", "medida", "sesión", "campo"],
    section: "Administración",
  },
  {
    id: "servicio-proveedoras-tarifa",
    title: "Asignar proveedoras y su tarifa a un servicio",
    body: "Desde el modal del servicio podés indicar qué proveedoras lo realizan y, por cada una, el tipo de pago (por hora, porcentaje o fijo por servicio) y el monto. Si más adelante cambiás la tarifa de una proveedora, el sistema cierra el acuerdo anterior y crea uno nuevo, para que el historial quede auditable.",
    tags: ["servicio", "proveedora", "tarifa", "acuerdo", "pago", "vigencia"],
    section: "Administración",
  },
  {
    id: "servicio-requiere-maquina-operador",
    title: "\"Requiere máquina\" y \"Requiere operador\"",
    body: "Marcá \"Requiere máquina\" si el servicio necesita un equipo asignado para poder agendarse (la agenda valida que haya una máquina libre). Marcá \"Requiere operador\" si necesita sí o sí una proveedora con disponibilidad. Estos campos condicionan qué turnos se pueden reservar.",
    tags: ["servicio", "máquina", "operador", "requiere", "agenda"],
    section: "Administración",
  },
  {
    id: "promo-como-funciona",
    title: "¿Cómo armo una promo?",
    body: "Una promo agrupa varios servicios a un precio especial. Cargás los servicios que incluye y, por cada uno, elegís la proveedora que lo realiza y cuánto se le paga. El descuento puede ser un porcentaje sobre el subtotal o un monto fijo. Al guardar, el sistema congela el subtotal y el total final.",
    tags: ["promo", "promoción", "descuento", "armar", "servicios"],
    section: "Administración",
  },
  {
    id: "promo-margen-empresa",
    title: "¿Cuánto gana la empresa con una promo?",
    body: "El margen de la empresa es el total de la promo menos la suma de lo que se le paga a cada proveedora por los servicios incluidos. Por eso, al cargar la promo, indicás el pago a la proveedora de cada servicio: ese dato permite saber la ganancia real.",
    tags: ["promo", "margen", "ganancia", "proveedora", "pago", "empresa"],
    section: "Administración",
  },
  {
    id: "promo-monto-frizado",
    title: "¿Por qué el monto de la promo queda \"congelado\"?",
    body: "Cuando guardás una promo, el subtotal de los servicios y el total con descuento se guardan tal cual estaban en ese momento. Aunque después cambien los precios de los servicios, la promo conserva los números con los que se creó. Esto permite auditar exactamente cuánto se cobró.",
    tags: ["promo", "congelado", "frizado", "snapshot", "auditar", "precio"],
    section: "Administración",
  },
  {
    id: "mercadopago-cuentas",
    title: "Cuentas de MercadoPago de una proveedora",
    body: "Cada proveedora puede tener una o más cuentas de MercadoPago (alias y CVU). La cuenta de la empresa entra a través de la persona que es dueña, que también está cargada como proveedora. Las cargás desde el modal de la proveedora, en \"Nuevo proveedor\" o en \"Editar proveedor\".",
    tags: ["mercadopago", "mp", "alias", "cvu", "cuenta", "proveedora", "cobro"],
    section: "Administración",
  },
  {
    id: "maquinas-mantenimiento",
    title: "Mantenimiento de máquinas",
    body: "Cada máquina lleva un registro de mantenimientos (preventivo, correctivo o reparación) con fecha, costo y notas. Sirve para controlar el estado del equipo y los gastos asociados. Una máquina en estado \"mantenimiento\" no se ofrece para turnos.",
    tags: ["máquina", "mantenimiento", "equipo", "reparación", "costo"],
    section: "Administración",
  },
  {
    id: "sitio-web-visibles",
    title: "Qué se muestra en el sitio web",
    body: "En \"Sitio Web → Visibles\" elegís qué servicios y capacitaciones aparecen en la página pública. En \"Destacados\" marcás los que se muestran resaltados (por ejemplo, promos destacadas). Un servicio puede estar activo internamente pero no visible en la web.",
    tags: ["sitio web", "visible", "destacado", "público", "mostrar"],
    section: "Sitio Web",
  },
  {
    id: "config-usuarios-roles",
    title: "Usuarios y roles del sistema",
    body: "En Configuración → Usuarios (solo administradores) podés invitar usuarios y asignarles un rol: administrador (acceso total, incluida la gestión de usuarios), o roles de staff con permisos más acotados. Por seguridad, un administrador no puede quitarse su propio rol ni eliminarse a sí mismo.",
    tags: ["usuario", "rol", "permiso", "administrador", "staff", "configuración"],
    section: "Configuración",
  },
  {
    id: "config-datos-empresa-horarios",
    title: "Datos de la empresa y horarios de atención",
    body: "En Configuración → Datos de empresa cargás el nombre, contacto, redes y los textos que aparecen en la web. También definís el horario de apertura y cierre para cada día de la semana, que es la base de la agenda.",
    tags: ["empresa", "horario", "atención", "datos", "configuración", "contacto"],
    section: "Configuración",
  },
  {
    id: "agenda-reserva-expira",
    title: "Reservas que expiran",
    body: "Un turno puede crearse como \"reserva\" con un tiempo de vencimiento. Si no se confirma a tiempo, la reserva se cancela automáticamente y el horario vuelve a quedar disponible. Así se evita bloquear cupos que nadie terminó de confirmar.",
    tags: ["agenda", "reserva", "expira", "vencimiento", "turno", "cancelar"],
    section: "Agenda",
  },
];
