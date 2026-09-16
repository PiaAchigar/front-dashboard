import { describe, expect, it } from "vitest";
import {
  erroresDelFormulario,
  pagosParaEnviar,
  pagosVigentes,
  serviciosADesglosar,
  type DestinoDraft,
  type ServicioADesglosar,
} from "./promo-form";

const combo = (id: string, nombre: string, servicios: [string, string][]) =>
  ({
    id,
    name: nombre,
    lines: servicios.map(([sid, sname]) => ({
      id: `l-${sid}`,
      serviceId: sid,
      serviceName: sname,
      serviceIsActive: true,
      sessionsIncluded: 1,
      servicePrice: null,
    })),
  }) as never;

const COMBOS = [
  combo("c1", "Combo Facial", [["s1", "Limpieza"], ["s2", "Baby Botox"]]),
  combo("c2", "Combo Express", [["s2", "Baby Botox"]]),
];

describe("serviciosADesglosar", () => {
  it("un combo en oferta abre sus servicios para cargarles el pago", () => {
    const r = serviciosADesglosar([{ tipo: "combo", id: "c1" }], COMBOS);
    expect(r.map((x) => x.serviceId)).toEqual(["s1", "s2"]);
    expect(r[0]!.deCombo).toBe("Combo Facial");
  });

  it("un servicio suelto en oferta también lleva su fila de pago", () => {
    const r = serviciosADesglosar([{ tipo: "servicio", id: "s9" }], COMBOS);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ serviceId: "s9", deCombo: null });
  });

  it("un servicio que está en dos combos aparece UNA sola vez", () => {
    // El acuerdo es con la proveedora por ese servicio, no por el combo.
    const r = serviciosADesglosar(
      [{ tipo: "combo", id: "c1" }, { tipo: "combo", id: "c2" }],
      COMBOS,
    );
    expect(r.filter((x) => x.serviceId === "s2")).toHaveLength(1);
  });

  it("depilación no desglosa servicios", () => {
    // Un combo de depilación son zonas, no servicios con proveedora propia.
    expect(serviciosADesglosar([{ tipo: "depilacion", id: "d1" }], COMBOS)).toEqual([]);
  });

  it("un combo que ya no existe no rompe la pantalla", () => {
    expect(serviciosADesglosar([{ tipo: "combo", id: "fantasma" }], COMBOS)).toEqual([]);
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
  const desglose: ServicioADesglosar[] = [
    { serviceId: "s1", serviceName: "Limpieza", deCombo: "Combo Facial" },
    { serviceId: "s2", serviceName: "Baby Botox", deCombo: "Combo Facial" },
  ];

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
    expect(pagosVigentes(pagos, [])).toEqual([]);
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
