import { describe, expect, it } from "vitest";
import {
  erroresDelFormulario,
  pagosParaEnviar,
  pagosVigentes,
  serviciosADesglosar,
  type Desglose,
  type DestinoDraft,
  type ServicioADesglosar,
} from "./promo-form";

const combo = (id: string, nombre: string, servicios: [string, string][]) =>
  ({
    id,
    name: nombre,
    kind: "combo",
    packOfComboId: null,
    lines: servicios.map(([sid, sname]) => ({
      id: `l-${sid}`,
      serviceId: sid,
      serviceName: sname,
      serviceIsActive: true,
      sessionsIncluded: 1,
      servicePrice: null,
    })),
  }) as never;

/** Un pack que REPITE un combo: no tiene renglones propios, sus servicios
 *  salen del combo original. Es la forma más común de pack. */
const packDeCombo = (id: string, nombre: string, comboId: string) =>
  ({ id, name: nombre, kind: "pack", packOfComboId: comboId, lines: [] }) as never;

/** Un pack armado con sus propios servicios: mira sus renglones, como un combo. */
const packSuelto = (id: string, nombre: string, servicios: [string, string][]) => {
  const c = combo(id, nombre, servicios) as unknown as Record<string, unknown>;
  return { ...c, kind: "pack", packOfComboId: null } as never;
};

const COMBOS = [
  combo("c1", "Combo Facial", [["s1", "Limpieza"], ["s2", "Baby Botox"]]),
  combo("c2", "Combo Express", [["s2", "Baby Botox"]]),
];

describe("serviciosADesglosar", () => {
  it("un combo en oferta abre sus servicios para cargarles el pago", () => {
    const r = serviciosADesglosar([{ tipo: "combo", id: "c1" }], COMBOS);
    expect(r.servicios.map((x) => x.serviceId)).toEqual(["s1", "s2"]);
    expect(r.servicios[0]!.deCombo).toBe("Combo Facial");
  });

  it("un servicio suelto en oferta también lleva su fila de pago", () => {
    const r = serviciosADesglosar([{ tipo: "servicio", id: "s9" }], COMBOS);
    expect(r.servicios).toHaveLength(1);
    expect(r.servicios[0]).toMatchObject({ serviceId: "s9", deCombo: null });
  });

  it("un servicio que está en dos combos aparece UNA sola vez", () => {
    // El acuerdo es con la proveedora por ese servicio, no por el combo.
    const r = serviciosADesglosar(
      [{ tipo: "combo", id: "c1" }, { tipo: "combo", id: "c2" }],
      COMBOS,
    );
    expect(r.servicios.filter((x) => x.serviceId === "s2")).toHaveLength(1);
  });

  it("depilación no desglosa servicios, y eso NO es un destino sin resolver", () => {
    // Un combo de depilación son zonas, no servicios con proveedora propia:
    // no hay desglose posible. No es ignorancia de la pantalla, así que no
    // puede frenar la poda de los pagos huérfanos.
    const r = serviciosADesglosar([{ tipo: "depilacion", id: "d1" }], COMBOS);
    expect(r.servicios).toEqual([]);
    expect(r.sinResolver).toEqual([]);
  });

  it("un combo que no vino en la lista no rompe la pantalla, pero se anota", () => {
    const r = serviciosADesglosar([{ tipo: "combo", id: "fantasma" }], COMBOS);
    expect(r.servicios).toEqual([]);
    expect(r.sinResolver).toEqual([{ tipo: "combo", id: "fantasma" }]);
  });

  it("un pack que repite un combo abre los servicios del combo original", () => {
    // Un pack con packOfComboId no tiene renglones propios: mirar pack.lines
    // devolvía vacío y la pantalla decía "Elegí algo en oferta" con un pack ya
    // elegido. Es la forma más común de pack.
    const lista = [...COMBOS, packDeCombo("p1", "Pack Facial x4", "c1")];
    const r = serviciosADesglosar([{ tipo: "combo", id: "p1" }], lista);
    expect(r.servicios.map((x) => x.serviceId)).toEqual(["s1", "s2"]);
    expect(r.sinResolver).toEqual([]);
  });

  it("el pago dice de qué PACK sale, no del combo que el pack repite", () => {
    // Es el nombre que Laura tildó arriba: el otro la obliga a deducir.
    const lista = [...COMBOS, packDeCombo("p1", "Pack Facial x4", "c1")];
    const r = serviciosADesglosar([{ tipo: "combo", id: "p1" }], lista);
    expect(r.servicios[0]!.deCombo).toBe("Pack Facial x4");
  });

  it("un pack armado con servicios propios sigue mirando sus renglones", () => {
    const lista = [...COMBOS, packSuelto("p2", "Pack Suelto", [["s7", "Masaje"]])];
    const r = serviciosADesglosar([{ tipo: "combo", id: "p2" }], lista);
    expect(r.servicios.map((x) => x.serviceId)).toEqual(["s7"]);
  });

  it("un pack cuyo combo original no vino en la lista queda sin resolver", () => {
    const r = serviciosADesglosar(
      [{ tipo: "combo", id: "p1" }],
      [packDeCombo("p1", "Pack Facial x4", "archivado")],
    );
    expect(r.servicios).toEqual([]);
    expect(r.sinResolver).toEqual([{ tipo: "combo", id: "p1" }]);
  });

  it("el mismo servicio por dos caminos (el combo y su pack) sale una vez", () => {
    const lista = [...COMBOS, packDeCombo("p1", "Pack Facial x4", "c1")];
    const r = serviciosADesglosar(
      [{ tipo: "combo", id: "c1" }, { tipo: "combo", id: "p1" }],
      lista,
    );
    expect(r.servicios.map((x) => x.serviceId)).toEqual(["s1", "s2"]);
  });
});

describe("pagosParaEnviar", () => {
  it("deja afuera las filas sin proveedora o sin monto", () => {
    // El pago es opcional: lo que Laura no complete se paga por el acuerdo de
    // siempre. Mandar filas a medio llenar las rechazaría el backend entero.
    const r = pagosParaEnviar([
      { serviceId: "s1", serviceProviderId: "p1", providerPayment: "5000" },
      { serviceId: "s2", serviceProviderId: "", providerPayment: "3000" },
      { serviceId: "s3", serviceProviderId: "p3", providerPayment: "" },
    ]);
    expect(r).toEqual([{ serviceId: "s1", serviceProviderId: "p1", providerPayment: 5000 }]);
  });

  it("un pago de cero sí se manda", () => {
    // Laura puede acordar que ese servicio en promo no se le paga.
    const r = pagosParaEnviar([{ serviceId: "s1", serviceProviderId: "p1", providerPayment: "0" }]);
    expect(r).toEqual([{ serviceId: "s1", serviceProviderId: "p1", providerPayment: 0 }]);
  });
});

describe("pagosVigentes", () => {
  const servicios: ServicioADesglosar[] = [
    { serviceId: "s1", serviceName: "Limpieza", deCombo: "Combo Facial" },
    { serviceId: "s2", serviceName: "Baby Botox", deCombo: "Combo Facial" },
  ];
  const desglose: Desglose = { servicios, sinResolver: [] };

  it("un pago cuyo servicio sigue en oferta se conserva", () => {
    const pagos = [{ serviceId: "s1", serviceProviderId: "p1", providerPayment: "5000" }];
    expect(pagosVigentes(pagos, desglose)).toEqual(pagos);
  });

  it("un pago huérfano —su servicio ya no está en oferta— se descarta", () => {
    // Laura tildó el Combo Facial, cargó el pago de Baby Botox y después
    // destildó el combo: la fila desapareció de la pantalla, pero sin esta
    // poda el pago viejo se mandaría igual en el próximo guardado.
    const pagos = [
      { serviceId: "s1", serviceProviderId: "p1", providerPayment: "5000" },
      { serviceId: "s9", serviceProviderId: "p9", providerPayment: "1000" },
    ];
    expect(pagosVigentes(pagos, desglose)).toEqual([
      { serviceId: "s1", serviceProviderId: "p1", providerPayment: "5000" },
    ]);
  });

  it("nada en oferta poda todos los pagos", () => {
    const pagos = [{ serviceId: "s1", serviceProviderId: "p1", providerPayment: "5000" }];
    expect(pagosVigentes(pagos, { servicios: [], sinResolver: [] })).toEqual([]);
  });

  it("con un destino sin resolver no se poda NADA", () => {
    // El combo destino se archivó y no vino en la lista: sus servicios no
    // están en el desglose, pero no son huérfanos — la pantalla no sabe nada
    // de ellos. Podarlos haría que corregir una coma en la descripción
    // guardara la promo sin esos pagos, y la plata de las proveedoras
    // cambiara en silencio.
    const pagos = [
      { serviceId: "s1", serviceProviderId: "p1", providerPayment: "5000" },
      { serviceId: "s9", serviceProviderId: "p9", providerPayment: "1000" },
    ];
    const conHueco: Desglose = { servicios, sinResolver: [{ tipo: "combo", id: "archivado" }] };
    expect(pagosVigentes(pagos, conHueco)).toEqual(pagos);
  });

  it("sin destinos sin resolver la poda sigue funcionando", () => {
    // El caso que pagosVigentes existe para cubrir no se pierde por la guarda.
    const pagos = [{ serviceId: "s9", serviceProviderId: "p9", providerPayment: "1000" }];
    expect(pagosVigentes(pagos, desglose)).toEqual([]);
  });
});

describe("erroresDelFormulario", () => {
  const base = { name: "Promo", destinos: [{ tipo: "combo", id: "c1" }] as DestinoDraft[], isFeatured: false, isVisibleWeb: false };

  it("una promo completa no tiene errores", () => {
    expect(erroresDelFormulario(base)).toEqual([]);
  });

  it("sin nombre no se guarda", () => {
    expect(erroresDelFormulario({ ...base, name: "  " })).toContain("Ponele un nombre a la promo");
  });

  it("sin nada en oferta no se guarda", () => {
    // Una promo sin destinos no significa "aplica a todo".
    expect(erroresDelFormulario({ ...base, destinos: [] })).toContain(
      "Elegí al menos un servicio, combo o pack para poner en oferta",
    );
  });

  it("destacada sin mostrar en la web avisa", () => {
    // Destacada sube la promo al carrusel de la home, pero si no se publica no
    // aparece en ningún lado: tildar sólo Destacada no hace nada.
    expect(erroresDelFormulario({ ...base, isFeatured: true, isVisibleWeb: false })).toContain(
      'Para destacarla en la home, tildá también "Mostrar en la web"',
    );
  });

  it("destacada con mostrar en la web está bien", () => {
    expect(erroresDelFormulario({ ...base, isFeatured: true, isVisibleWeb: true })).toEqual([]);
  });
});
