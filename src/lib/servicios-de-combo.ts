import type { Service } from "./api-types";
import { filtrarServicios } from "./filtrar-servicios";

/**
 * Qué servicios se pueden meter en un combo o un pack del área.
 *
 * **La regla ya estaba, pero sólo en la base.** La migración 1.50.0 la dejó
 * escrita en el esquema de `combos`: *el área se ELIGE al crear, no se deduce
 * de los servicios: un combo vive en una sola, y combinar entre áreas es
 * trabajo de PROMOS*. La pestaña Servicios la cumplía; el armador de combos
 * no, y ofrecía los 120 servicios del catálogo. Así se armó un combo de
 * Estética con "Baby Botox", que es de Medicina (encontrado por Pia,
 * 2026-09-15).
 *
 * **Cruzar áreas no está mal por sí solo**: un servicio puede pertenecer a
 * varias a propósito —una limpieza facial con aparatología es cosmetología Y
 * medicina— y ahí sale en las dos listas, que es lo correcto. Lo que estaba
 * mal era ofrecer uno que no tiene nada que ver con el área del combo.
 *
 * **Los ya elegidos no se caen de la lista.** Un combo viejo puede tener un
 * servicio de otra área, y sacarlo del `<select>` lo haría aparecer como
 * *archivado* —que es el otro motivo por el que un servicio no está en la
 * lista— mandando a reemplazar algo que existe y está activo.
 */
export function serviciosParaCombo(
  servicios: Service[],
  area: string | undefined,
  yaElegidos: readonly (string | null | undefined)[] = [],
): Service[] {
  // Sin área no hay nada que acotar: es la pantalla general de combos.
  if (!area) return servicios;

  const delArea = new Set(filtrarServicios(servicios, { area }).map((s) => s.id));
  const elegidos = new Set(yaElegidos.filter((id): id is string => !!id));

  // Se filtra sobre la lista original y no se concatena, para que el orden
  // alfabético que ya trae no se rompa metiendo los de afuera al final.
  return servicios.filter((s) => delArea.has(s.id) || elegidos.has(s.id));
}
