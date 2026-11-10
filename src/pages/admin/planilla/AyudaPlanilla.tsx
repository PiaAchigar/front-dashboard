import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, HelpCircle } from "../../../components/icons";

/**
 * La ayuda de la Planilla Excel (pedido de Pia, 2026-11-10): "todos los detalles".
 * Escrita para Laura, en castellano llano. Mismo patrón que la de Actualizar precios.
 */

const VISTA = "ayuda-planilla-vista";

/** La primera vez en esta computadora: true una sola vez, y queda anotado. */
function usePrimeraVez(): boolean {
  const [primera] = useState(() => {
    try {
      return !localStorage.getItem(VISTA);
    } catch {
      return false;
    }
  });
  useEffect(() => {
    if (!primera) return;
    try {
      localStorage.setItem(VISTA, "1");
    } catch {
      // Sin almacenamiento: late cada vez, no pasa nada.
    }
  }, [primera]);
  return primera;
}

/** El (?) del título. La primera vez da tres latidos de luz para decir "acá estoy". */
export function BotonAyudaPlanilla({ abierta, onClick }: { abierta: boolean; onClick: () => void }) {
  const late = usePrimeraVez();
  return (
    <button
      type="button"
      aria-label="Cómo usar la planilla"
      aria-expanded={abierta}
      title="Ayuda"
      onClick={onClick}
      className={[
        "shrink-0 rounded-full p-1.5 transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        abierta ? "bg-primary/10 text-primary" : "text-ink-soft hover:bg-surface-high hover:text-ink",
        late ? "ayuda-latido" : "",
      ].join(" ")}
    >
      <HelpCircle size={20} aria-hidden />
    </button>
  );
}

/** Ocupa el lugar de la pantalla; lo que Laura había subido sigue cargado detrás. */
export function AyudaPlanilla({ onVolver }: { onVolver: () => void }) {
  const arriba = useRef<HTMLDivElement>(null);
  useEffect(() => {
    arriba.current?.scrollIntoView?.({ block: "start" });
  }, []);

  return (
    <div ref={arriba} className="space-y-4 text-sm text-ink">
      <BotonVolver onClick={onVolver} />

      <section className="space-y-2">
        <h2 className="text-base font-semibold">Para qué sirve</h2>
        <p>
          Cargar o corregir muchos servicios de una sola vez, en una planilla de Excel, en vez de abrir la
          ficha de uno por uno. Sirve, por ejemplo, para pasar una lista de servicios nuevos, o para
          cambiar precios, duraciones o descripciones de varios juntos.
        </p>
        <p>
          <b>No reemplaza la ficha</b> de cada servicio: las dos formas conviven. Lo que cargues por la
          planilla lo ves en la ficha, y lo que cambies en la ficha aparece la próxima vez que bajes la
          planilla.
        </p>
      </section>

      <Tema titulo="Cómo se usa, paso a paso" abierto>
        <ol className="list-decimal space-y-1 pl-5">
          <li>
            Tocá <b>Descargar planilla</b>. Baja un archivo con los servicios que tiene hoy esta área.
          </li>
          <li>Abrilo en Excel o en Google Sheets y completá o corregí lo que necesites.</li>
          <li>
            Guardalo como <b>Microsoft Excel (.xlsx)</b>. Sólo se aceptan archivos .xlsx, no sirven los
            .csv.
          </li>
          <li>Arrastrá el archivo a la zona de subida (o tocala para elegirlo).</li>
          <li>
            Mirá la <b>vista previa</b>: te muestra qué se va a crear y qué cambia, y todavía no se guardó
            nada.
          </li>
          <li>
            Si está todo bien, tocá <b>Guardar</b> y confirmá.
          </li>
        </ol>
        <p>
          La planilla es de <b>un área</b>: la de Estética sólo sirve para Estética. Si subís la de otra
          área, el sistema te avisa y no la lee.
        </p>
      </Tema>

      <Tema titulo="Si usás Google Sheets">
        <p>
          Subí el archivo a Google Drive, abrilo con Google Sheets y editalo ahí. Cuando termines, bajalo
          con <b>Archivo → Descargar → Microsoft Excel (.xlsx)</b>.
        </p>
        <p>
          Es <b>un solo archivo</b> con todas las pestañas adentro: no hay que subir uno por pestaña. Las
          pestañas se mantienen al bajarlo.
        </p>
      </Tema>

      <Tema titulo="Las pestañas y qué va en cada columna">
        <p>
          El archivo tiene cuatro pestañas visibles. Las columnas se reconocen por su título, así que podés
          cambiarlas de lugar, pero <b>no les cambies el nombre</b> ni las borres.
        </p>

        <p className="font-medium">Servicios (una fila por servicio)</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <b>id (no tocar)</b>: lo completa el sistema, así que <b>no toques la columna id</b>. Una fila que
            tiene id es un servicio que ya existe; una fila <b>sin id</b> es un servicio <b>nuevo</b>.
          </li>
          <li>
            <b>Nombre</b>: obligatorio. No puede haber dos servicios con el mismo nombre en el archivo.
          </li>
          <li>
            <b>Código</b>, <b>Unidad</b> (por ejemplo, sesión): texto libre, hasta 50 letras.
          </li>
          <li>
            <b>Descripción</b>, <b>Beneficios</b>, <b>Contraindicaciones</b>, <b>Instrucciones
            especiales</b>: texto, hasta 2.000 letras cada uno.
          </li>
          <li>
            <b>Precio lista</b> y <b>Precio efectivo</b>: números, sin el signo $. Pueden tener decimales
            y no pueden ser negativos.
          </li>
          <li>
            <b>Duración (min)</b>: minutos, número entero.
          </li>
          <li>
            <b>Requiere operadora</b>, <b>Requiere máquina</b>, <b>Visible en la web</b>, <b>Destacado en
            el home</b>: Sí o No. Elegilo del desplegable de la celda.
          </li>
          <li>
            <b>Máquina</b>: elegila del desplegable, tiene que ser una máquina que existe en el sistema.
          </li>
          <li>
            <b>Orden web (destacados)</b>: número entero. Sólo importa en los servicios destacados, en
            los demás se deja vacío.
          </li>
        </ul>

        <p className="font-medium">Proveedoras (una fila por servicio y proveedora)</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <b>Servicio</b>: el nombre del servicio, igual que en la pestaña Servicios (también sirve para
            los servicios nuevos que estés agregando).
          </li>
          <li>
            <b>Proveedora</b>: elegila del desplegable.
          </li>
          <li>
            <b>Tipo de pago</b>: <b>Por hora</b>, <b>Porcentaje (%)</b> o <b>Fijo por servicio</b>.
          </li>
          <li>
            <b>Tarifa</b>: lo que cobra, según el tipo de pago. Tiene que ser mayor que 0.
          </li>
        </ul>

        <p className="font-medium">Insumos (una fila por servicio e insumo)</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <b>Servicio</b> e <b>Insumo</b>: del desplegable.
          </li>
          <li>
            <b>Cantidad</b>: lo que se gasta por servicio. Acepta decimales (por ejemplo, 1,5) y tiene que
            ser mayor que 0.
          </li>
        </ul>

        <p className="font-medium">Categorías web (una fila por servicio y categoría)</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <b>Servicio</b> y <b>Categoría web</b>. La categoría se muestra con su camino completo, por
            ejemplo «Dermatología › Estética › Rostro», porque hay nombres que se repiten en distintas
            ramas.
          </li>
        </ul>
      </Tema>

      <Tema titulo="Borrar una fila no borra nada" abierto>
        <p>
          Si sacás una fila de la planilla, el sistema <b>no borra</b> nada. Eso vale para los servicios,
          las proveedoras, los insumos y las categorías.
        </p>
        <p>
          Con la planilla se puede <b>agregar</b> y <b>cambiar</b>. Para eliminar un servicio, sacarle una
          proveedora, un insumo o una categoría, hacelo desde el sistema, en la ficha del servicio.
        </p>
      </Tema>

      <Tema titulo="Las categorías y las áreas se crean desde el dashboard" abierto>
        <p>
          Las <b>categorías</b> y las <b>áreas</b> se crean y se editan <b>sólo desde el dashboard</b>, en
          la pantalla Categorías. La planilla no las crea.
        </p>
        <p>
          La pestaña Categorías web sólo dice en cuáles de las que ya existen está cada servicio. Un
          servicio nuevo necesita <b>al menos una categoría</b> web: si no le ponés ninguna, te lo marca
          como error.
        </p>
      </Tema>

      <Tema titulo="Si dejás una celda vacía">
        <p>
          En los campos de texto (código, descripción, unidad, beneficios, contraindicaciones,
          instrucciones y máquina), <b>vaciar la celda borra ese dato</b>. La vista previa te lo muestra
          antes de guardar, como «Beneficios: … → (vacío)».
        </p>
        <p>
          Los <b>precios</b> y la <b>duración</b> no pueden quedar vacíos, ni tampoco los Sí/No de un
          servicio que ya existe. Es porque, por ejemplo, sin precio efectivo las proveedoras que cobran
          por porcentaje quedarían cobrando $0. El orden web sí puede quedar vacío.
        </p>
        <p>
          Un servicio <b>nuevo</b> necesita nombre, precio de lista, precio efectivo, duración y al menos
          una categoría web. Si dejás un Sí/No vacío, toma el mismo valor que tendría al crearlo desde la
          ficha.
        </p>
      </Tema>

      <Tema titulo="Si bajaste la planilla hace rato (conflictos)">
        <p>
          El archivo recuerda cómo estaba todo cuando lo bajaste. Al subirlo, el sistema aplica{" "}
          <b>sólo lo que vos cambiaste</b>. Lo que no tocaste no pisa nada, aunque desde el sistema lo
          hayan cambiado mientras tanto.
        </p>
        <p>
          Si cambiaste una celda en la planilla y <b>esa misma cosa</b> también la cambió alguien en el
          sistema después de que bajaste el archivo, aparece como un <b>conflicto</b>. Por ejemplo: «el
          precio cambió en el sistema después de que bajaste la planilla: ahora es X, en la planilla pusiste
          Y». En ese caso no se guarda nada: bajá una planilla nueva y volvé a hacer ese cambio.
        </p>
      </Tema>

      <Tema titulo="Si hay errores no se guarda nada" abierto>
        <p>
          Si en la vista previa aparece <b>algún error</b>, en rojo y con la pestaña y la fila, el botón
          Guardar queda apagado y <b>no se guarda nada</b>, ni siquiera lo que estaba bien. Corregí el
          archivo y volvé a subirlo.
        </p>
        <p>Cuando Guardar está prendido, se guarda todo junto.</p>
      </Tema>

      <Tema titulo="Los precios y las tarifas">
        <p>
          Cambiar precios por la planilla funciona como la pantalla <b>Actualizar precios</b>: queda
          registrado quién lo hizo, cuándo, y el precio de lista y de efectivo de cada servicio antes y
          después. Los servicios nuevos no tienen registro, porque no tenían un precio anterior.
        </p>
        <p>
          La vista previa también te avisa qué <b>combos y packs</b> incluyen los servicios que cambian de
          precio. Esos no se actualizan solos: hay que revisarlos.
        </p>
        <p>
          Si cambiás el tipo de pago o la tarifa de una proveedora, la anterior <b>queda en el
          historial</b>: no se pierde, sólo deja de estar vigente.
        </p>
      </Tema>

      <Tema titulo="Lo que no está en la planilla">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            El <b>IVA</b> no está en la planilla. Los servicios nuevos se crean sin IVA y los que ya
            existen no se tocan. En la ficha del servicio sigue estando.
          </li>
          <li>
            <b>Depilación</b> todavía no tiene planilla. Sus servicios se cargan desde su propia
            pantalla.
          </li>
        </ul>
      </Tema>

      <Tema titulo="Quién la puede usar">
        <p>
          Sólo los usuarios <b>admin</b> y <b>manager</b>. El resto no ve el botón Planilla Excel.
        </p>
      </Tema>

      <BotonVolver onClick={onVolver} />
    </div>
  );
}

function BotonVolver({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="-ml-2 flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-primary-dark transition-colors hover:bg-surface-high focus-visible:outline-2 focus-visible:outline-primary"
    >
      <ChevronLeft size={16} aria-hidden />
      Volver
    </button>
  );
}

/** Lo que no hace falta leer de entrada: cerrado, se abre al tocarlo. Lo más importante viene abierto. */
function Tema({ titulo, children, abierto = false }: { titulo: string; children: ReactNode; abierto?: boolean }) {
  return (
    <details open={abierto} className="group rounded-xl border border-surface-highest bg-white">
      <summary className="cursor-pointer list-none px-3 py-2 font-medium marker:hidden">
        <span className="mr-1.5 inline-block text-ink-soft transition-transform group-open:rotate-90">›</span>
        {titulo}
      </summary>
      <div className="space-y-2 px-3 pb-3">{children}</div>
    </details>
  );
}
