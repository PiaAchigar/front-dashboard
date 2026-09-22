/**
 * La lógica del formulario de Promos, sin JSX.
 *
 * Una promo tiene DOS listas y no hay que confundirlas: **qué está en oferta**
 * (los destinos) y **cuánto se le paga a cada proveedora** (los pagos). Un
 * combo no aporta un pago propio: aporta sus servicios a la segunda lista.
 */

import type { ComboAdmin } from "./api-types";

export type TipoDeDestino = "servicio" | "combo" | "depilacion";
export type DestinoDraft = {
  tipo: TipoDeDestino;
  id: string;
  /** Cuántas unidades se lleva la clienta. Sólo se usa (y se muestra) cuando
   *  la promo es un paquete; en una de descuento no significa nada. */
  cantidad?: number;
};
export type PagoDraft = {
  serviceId: string;
  serviceProviderId: string;
  providerPayment: string;
};

export type ServicioADesglosar = {
  serviceId: string;
  serviceName: string | null;
  /** El combo del que salió, o `null` si es un servicio suelto en oferta. */
  deCombo: string | null;
};

/**
 * Lo que se pudo abrir de la oferta, y lo que no.
 *
 * `sinResolver` existe porque no es lo mismo "este combo no aporta servicios"
 * que "no sé nada de este combo". La segunda es ignorancia de la pantalla —el
 * combo se archivó y no vino en la lista, o la lista todavía está cargando— y
 * `pagosVigentes` no puede podar un pago por ignorancia.
 */
export type Desglose = {
  servicios: ServicioADesglosar[];
  /** Destinos que la pantalla no pudo abrir: el combo no vino en la lista. */
  sinResolver: DestinoDraft[];
};

/**
 * De qué combo salen los servicios de un destino.
 *
 * Un **pack que repite un combo** no tiene renglones propios: sus servicios
 * viven en el combo original. Mirar `pack.lines` devuelve vacío, que es
 * exactamente lo que hacía que un pack en oferta mostrara "Elegí algo en
 * oferta" con algo ya elegido. Misma regla que el backend
 * (`comboDelQueSalenLosServicios`), y como allá: `packOfComboId` sólo
 * significa algo en un pack, un combo común con la columna sucia se sigue
 * mirando a sí mismo.
 */
function comboDelQueSalenLosServicios(
  combo: ComboAdmin,
  porId: Map<string, ComboAdmin>,
): ComboAdmin | undefined {
  if (combo.kind === "pack" && combo.packOfComboId) return porId.get(combo.packOfComboId);
  return combo;
}

/**
 * Los servicios que necesitan una fila de pago, a partir de lo que está en
 * oferta.
 *
 * Un servicio que aparece en dos combos de la misma promo sale UNA vez: el
 * acuerdo es con la proveedora por ese servicio, no por el combo.
 */
export function serviciosADesglosar(
  destinos: readonly DestinoDraft[],
  combos: readonly ComboAdmin[],
): Desglose {
  const porId = new Map(combos.map((c) => [c.id, c]));
  const vistos = new Map<string, ServicioADesglosar>();
  const sinResolver: DestinoDraft[] = [];

  for (const d of destinos) {
    if (d.tipo === "servicio") {
      if (!vistos.has(d.id)) vistos.set(d.id, { serviceId: d.id, serviceName: null, deCombo: null });
      continue;
    }
    // Un combo de depilación son zonas, no servicios con proveedora propia:
    // no hay desglose posible y eso NO es ignorancia, así que no va a
    // `sinResolver`. La pantalla lo dice en una línea.
    if (d.tipo === "depilacion") continue;

    const combo = porId.get(d.id);
    if (!combo) {
      sinResolver.push(d);
      continue;
    }
    const origen = comboDelQueSalenLosServicios(combo, porId);
    if (!origen) {
      // Un pack cuyo combo original no vino en la lista: los servicios
      // existen, esta pantalla no los ve.
      sinResolver.push(d);
      continue;
    }
    for (const l of origen.lines) {
      if (!l.serviceId || vistos.has(l.serviceId)) continue;
      vistos.set(l.serviceId, {
        serviceId: l.serviceId,
        serviceName: l.serviceName,
        // El nombre que Laura tildó, no el del combo que el pack repite: es
        // el que ella está mirando en la lista de arriba.
        deCombo: combo.name,
      });
    }
  }
  return { servicios: [...vistos.values()], sinResolver };
}

/**
 * Los pagos cuyo servicio sigue en oferta, descartando los huérfanos.
 *
 * Un pago queda huérfano cuando Laura carga proveedora y monto para un
 * servicio y DESPUÉS destilda el destino que lo traía (el servicio suelto, o
 * el combo/pack del que salía): `form.pagos` no se entera solo de ese
 * destilde, así que sin esta poda el pago viejo se manda igual en el próximo
 * guardado — un acuerdo de pago para algo que ya no está en oferta, que
 * Laura nunca vio ni confirmó en esa vuelta.
 *
 * Se poda acá, al armar lo que se manda, y no en cada tilde/destilde del
 * formulario: si Laura destilda por error y vuelve a tildar en la misma
 * edición, recupera lo que ya había cargado en vez de perderlo.
 */
export function pagosVigentes(pagos: readonly PagoDraft[], desglose: Desglose): PagoDraft[] {
  // Con un destino sin resolver no se poda NADA. La poda sólo es legítima
  // cuando la pantalla conoce toda la oferta: si un combo destino se archivó
  // después de armar la promo, sus servicios desaparecen del desglose y esta
  // función los leería como huérfanos — corregir una coma en la descripción
  // guardaría la promo sin esos pagos, y la plata de las proveedoras
  // cambiaría en silencio. Un pago de más se ve y se borra; uno que se perdió
  // solo, no.
  if (desglose.sinResolver.length > 0) return [...pagos];
  const ids = new Set(desglose.servicios.map((s) => s.serviceId));
  return pagos.filter((p) => ids.has(p.serviceId));
}

/**
 * Los pagos listos para mandar al backend.
 *
 * El pago es OPCIONAL: lo que Laura no completa se paga por el acuerdo de
 * siempre. Una fila a medio llenar no es un pago y no se manda — el backend
 * rechazaría el guardado entero por ella.
 *
 * No filtra por destinos vigentes: eso es trabajo de `pagosVigentes`, que se
 * corre antes. Esta función sólo decide qué fila cuenta como pago completo.
 */
export function pagosParaEnviar(
  pagos: readonly PagoDraft[],
): { serviceId: string; serviceProviderId: string; providerPayment: number }[] {
  return pagos.flatMap((p) => {
    const monto = p.providerPayment.trim();
    if (!p.serviceProviderId || monto === "") return [];
    const n = Number(monto);
    if (!Number.isFinite(n) || n < 0) return [];
    return [{ serviceId: p.serviceId, serviceProviderId: p.serviceProviderId, providerPayment: n }];
  });
}

/**
 * Lo que la pantalla ya tiene cargado, reducido a lo que hace falta para saber
 * si una cosa tiene precio.
 *
 * Se tipa por estructura y no con `Service` / `ComboAdmin` / `ComboDepilacion`
 * para que esto se pueda testear con objetos de tres campos en vez de armar un
 * catálogo entero.
 */
export type CatalogoDePromo = {
  servicios: readonly { id: string; name: string | null; unitPriceList: number | null; unitPriceCash: number | null }[];
  /** Combos y packs juntos: en `promotion_target` los dos son `combo_id`. */
  combos: readonly { id: string; name: string | null; finalAmount: number }[];
  depilacion: readonly { id: string; name: string; fixedPrice: number | null }[];
};

/**
 * Las cosas en oferta cuyo precio NO se puede resolver, por nombre.
 *
 * Mismas reglas que `preciosDeListaDe` del backend, que es quien después
 * cotiza — si no coincidieran, la pantalla dejaría pasar algo que la venta
 * rechaza, o al revés:
 *
 *   servicio     `unit_price_list`, y si no hay, `unit_price_cash`
 *   combo/pack   `finalAmount` (en un pack ya viene × sesiones)
 *   depilación   `fixed_price` Y NADA MÁS — un pack `guardado` (zonas a
 *                elección) nunca lo tiene, y la fórmula sobre zonas es un
 *                precio que la venta del paquete no usa nunca
 *
 * **Lo que la pantalla no conoce no se marca.** Un destino que no está en
 * ninguna de las tres listas puede ser un combo archivado (las listas piden
 * sólo los activos) o las listas todavía cargando. Marcarlo bloquearía editar
 * una promo vieja por una descripción. Mismo criterio que `pagosVigentes`: no
 * se decide nada por ignorancia. El backend lo vuelve a chequear al cotizar, y
 * también nombrándolo.
 */
export function destinosSinPrecio(
  destinos: readonly DestinoDraft[],
  catalogo: CatalogoDePromo,
): string[] {
  const servicios = new Map(catalogo.servicios.map((s) => [s.id, s]));
  const combos = new Map(catalogo.combos.map((c) => [c.id, c]));
  const depilacion = new Map(catalogo.depilacion.map((d) => [d.id, d]));

  const sinPrecio: string[] = [];
  const nombrar = (nombre: string | null, id: string) => nombre?.trim() || `(sin nombre, ${id})`;

  for (const d of destinos) {
    if (d.tipo === "servicio") {
      const s = servicios.get(d.id);
      if (!s) continue;
      // `??` y no `||`: replica `precioDeServicio` del backend.
      const precio = s.unitPriceList ?? s.unitPriceCash;
      if (precio == null || precio <= 0) sinPrecio.push(nombrar(s.name, d.id));
      continue;
    }
    if (d.tipo === "combo") {
      const c = combos.get(d.id);
      if (!c) continue;
      if (!(c.finalAmount > 0)) sinPrecio.push(nombrar(c.name, d.id));
      continue;
    }
    const p = depilacion.get(d.id);
    if (!p) continue;
    if (p.fixedPrice == null || p.fixedPrice <= 0) sinPrecio.push(nombrar(p.name, d.id));
  }
  return sinPrecio;
}

/** Todo lo que impide guardar, junto. De a uno obliga a adivinar qué falta. */
export function erroresDelFormulario(
  form: {
    name: string;
    destinos: readonly DestinoDraft[];
    isFeatured: boolean;
    isVisibleWeb: boolean;
    promotionType: string;
    precioDelPaquete: string;
  },
  /**
   * El catálogo cargado, para chequear que toda parte del paquete tenga
   * precio. Opcional sólo para no obligar a los tests de las otras reglas a
   * armarlo: la pantalla siempre lo pasa.
   */
  catalogo?: CatalogoDePromo,
): string[] {
  const errores: string[] = [];
  if (!form.name.trim()) errores.push("Ponele un nombre a la promo");
  if (form.destinos.length === 0) {
    errores.push("Elegí al menos un servicio, combo o pack para poner en oferta");
  }
  if (form.isFeatured && !form.isVisibleWeb) {
    errores.push('Para destacarla en la home, tildá también "Mostrar en la web"');
  }
  if (form.promotionType === "paquete") {
    const precio = Number(form.precioDelPaquete);
    if (!form.precioDelPaquete.trim() || !Number.isFinite(precio) || precio <= 0) {
      errores.push("una promo que se vende como paquete necesita un precio");
    }
    if (form.destinos.length === 0) {
      errores.push("un paquete tiene que llevar al menos una cosa adentro");
    }
    // Toda parte del paquete tiene que tener precio: es lo que se reparte
    // entre las líneas de la compra. Sin esto Laura tildaba un pack de
    // depilación `guardado` (que nunca tiene `fixed_price`) o un servicio sin
    // precio, guardaba sin resistencia, la promo aparecía en la solapa Promos
    // del CRM, y recién ahí explotaba — con la clienta delante.
    //
    // Sólo en el paquete: en una promo de DESCUENTO los destinos dicen sobre
    // qué aplica el %, no qué lleva adentro, y el precio sale de lo que se
    // esté vendiendo en ese momento.
    if (catalogo) {
      const sinPrecio = destinosSinPrecio(form.destinos, catalogo);
      if (sinPrecio.length > 0) {
        errores.push(
          `sin precio cargado: ${sinPrecio.join(", ")}. Un paquete reparte su precio entre ` +
            "las cosas que lleva, así que todas tienen que tener el suyo — cargáselo o sacalas de la oferta.",
        );
      }
    }
  }
  return errores;
}
