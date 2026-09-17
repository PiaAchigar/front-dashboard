/**
 * La lógica del formulario de Promos, sin JSX.
 *
 * Una promo tiene DOS listas y no hay que confundirlas: **qué está en oferta**
 * (los destinos) y **cuánto se le paga a cada proveedora** (los pagos). Un
 * combo no aporta un pago propio: aporta sus servicios a la segunda lista.
 */

import type { ComboAdmin } from "./api-types";

export type TipoDeDestino = "servicio" | "combo" | "depilacion";
export type DestinoDraft = { tipo: TipoDeDestino; id: string };
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

/** Todo lo que impide guardar, junto. De a uno obliga a adivinar qué falta. */
export function erroresDelFormulario(f: {
  name: string;
  destinos: readonly DestinoDraft[];
  isFeatured: boolean;
  isVisibleWeb: boolean;
}): string[] {
  const errores: string[] = [];
  if (!f.name.trim()) errores.push("Ponele un nombre a la promo");
  if (f.destinos.length === 0) {
    errores.push("Elegí al menos un servicio, combo o pack para poner en oferta");
  }
  if (f.isFeatured && !f.isVisibleWeb) {
    errores.push('Para destacarla en la home, tildá también "Mostrar en la web"');
  }
  return errores;
}
