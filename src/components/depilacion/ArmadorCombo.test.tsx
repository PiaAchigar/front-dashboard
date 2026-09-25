import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ArmadorCombo } from "./ArmadorCombo";
import type {
  DepilationConfig,
  Exclusion,
  PackFijo,
  ZonaParaCotizar,
} from "../../lib/depilation-pricing";

/** Los valores sembrados del PDF (mismos que depilation-pricing.test.ts), así
 *  los números concretos del brief (task-8) dan exacto. */
// Mujer y hombre iguales acá a propósito: este archivo no prueba la
// bifurcación por sexo del precio (eso lo prueba depilation-pricing.test.ts),
// solo necesita que los números coincidan con los ya probados ahí.
const CONFIG: DepilationConfig = {
  precioLista: {
    mujer: { grande: 19000, mediana: 17000, chica: 12000 },
    hombre: { grande: 19000, mediana: 17000, chica: 12000 },
  },
  minutosPrecio: {
    mujer: { grande: 10, mediana: 7, chica: 5 },
    hombre: { grande: 10, mediana: 7, chica: 5 },
  },
  tarifaEscalon1: 1200,
  tarifaEscalon2: 1000,
  minutosTurno: {
    mujer: { grande: 9, mediana: 6, chica: 3 },
    hombre: { grande: 10, mediana: 8, chica: 5 },
  },
  redondeoTurno: 5,
  turnoMinimo: 10,
  packSesiones: 3,
  packDescuentoPct: 15,
  packRedondeo: 1000,
};

// Las 10 zonas del pack fijo "Cuerpo Full" (spec §4.7) + un par grande que se
// excluye entre sí, para probar el bloqueo.
const ZONAS: ZonaParaCotizar[] = [
  { id: "pierna-entera", nombre: "Pierna entera", categoria: "grande" },
  { id: "media-pierna", nombre: "Media pierna", categoria: "grande" },
  { id: "rostro-completo", nombre: "Rostro completo", categoria: "grande" },
  { id: "espalda", nombre: "Espalda", categoria: "grande" },
  { id: "brazos", nombre: "Brazos", categoria: "grande" },
  { id: "gluteos", nombre: "Glúteos", categoria: "grande" },
  { id: "axila", nombre: "Axila", categoria: "chica" },
  { id: "cavado", nombre: "Cavado", categoria: "chica" },
  { id: "tira-de-cola", nombre: "Tira de cola", categoria: "chica" },
  { id: "linea-alba", nombre: "Línea alba", categoria: "chica" },
  { id: "empeine", nombre: "Empeine y dedos de los pies", categoria: "chica" },
];

const EXCLUSIONES: Exclusion[] = [
  { zonaId: "pierna-entera", excluyeA: "media-pierna" },
  { zonaId: "media-pierna", excluyeA: "pierna-entera" },
];

const PACKS: PackFijo[] = [
  {
    id: "cuerpo-full",
    nombre: "Cuerpo Full",
    zonasBase: [
      "pierna-entera",
      "rostro-completo",
      "espalda",
      "brazos",
      "gluteos",
      "axila",
      "cavado",
      "tira-de-cola",
      "linea-alba",
      "empeine",
    ],
    zonasAEleccion: 0,
    precioFijo: 65000,
    duracionFija: null,
  },
];

const ZONAS_CUERPO_FULL = [
  "Pierna entera",
  "Rostro completo",
  "Espalda",
  "Brazos",
  "Glúteos",
  "Axila",
  "Cavado",
  "Tira de cola",
  "Línea alba",
  "Empeine y dedos de los pies",
];

const props = { zonas: ZONAS, exclusiones: EXCLUSIONES, config: CONFIG, packs: PACKS };

describe("ArmadorCombo", () => {
  it("muestra el desglose con el motivo de cada línea", async () => {
    render(<ArmadorCombo {...props} />);
    await userEvent.click(screen.getByLabelText("Pierna entera"));
    await userEvent.click(screen.getByLabelText("Cavado"));

    expect(screen.getByText("$19.000")).toBeInTheDocument();
    expect(screen.getByText(/precio de lista/i)).toBeInTheDocument();
    expect(screen.getByText("$6.000")).toBeInTheDocument();
    expect(screen.getByText(/2ª zona/i)).toBeInTheDocument();
  });

  it("deshabilita Media pierna cuando está tildada Pierna entera, con el motivo", async () => {
    render(<ArmadorCombo {...props} />);
    await userEvent.click(screen.getByLabelText("Pierna entera"));

    const checkbox = screen.getByLabelText("Media pierna");
    const motivo = screen.getByText(/ya incluida en Pierna entera/i);
    expect(checkbox).toBeDisabled();
    expect(motivo).toBeInTheDocument();
    // No alcanza con que las dos cosas estén en pantalla: un lector de
    // pantalla solo anuncia "por qué" si el checkbox apunta al motivo con
    // aria-describedby. Sin esto se anuncia "deshabilitado" y nada más.
    expect(checkbox).toHaveAttribute("aria-describedby", motivo.id);
  });

  it("no deja tildar una zona bloqueada", async () => {
    render(<ArmadorCombo {...props} />);
    await userEvent.click(screen.getByLabelText("Pierna entera"));
    // Media pierna quedó disabled: un click no debería sumarla a la selección.
    await userEvent.click(screen.getByLabelText("Media pierna"));

    expect(screen.getByLabelText("Media pierna")).not.toBeChecked();
    // El total sigue siendo solo el de Pierna entera, no el de las dos.
    expect(screen.getByTestId("total")).toHaveTextContent("$19.000");
  });

  it("avisa cuando la selección coincide con un pack fijo, y el total pasa a ser el del pack", async () => {
    render(<ArmadorCombo {...props} />);
    for (const nombre of ZONAS_CUERPO_FULL) {
      await userEvent.click(screen.getByLabelText(nombre));
    }

    expect(screen.getByText(/Cuerpo Full/)).toBeInTheDocument();
    expect(screen.getByText(/\$65\.000 en vez de \$86\.000/)).toBeInTheDocument();

    // El Total mostrado tiene que ser el precio fijo ($65.000), no el de la
    // fórmula ($86.000) — es la regla 3 del diseño ("se aplica solo"), y es
    // lo que un cartel-solo-de-texto no puede probar: un total que se quedó
    // pegado a la fórmula deja el cartel diciendo una cosa y el número de
    // abajo otra.
    expect(screen.getByTestId("total")).toHaveTextContent("$65.000");
    expect(screen.getByTestId("total")).not.toHaveTextContent("$86.000");

    // Y el pack de 3 tiene que salir de ESE total ($65.000 × 3 × 0,85 →
    // $165.750 → redondea a $166.000; ahorro $29.000), no del de la fórmula.
    expect(screen.getByText("$166.000")).toBeInTheDocument();
    expect(screen.getByText(/Ahorrás \$29\.000/)).toBeInTheDocument();
  });

  /**
   * Ronda de arreglos 3 (Minor 1). El precio de un pack fijo lo carga Laura
   * para MUJER; el de hombre se deriva de la relación de minutos del pack
   * (`precioDePackFijo`). El armador mostraba el fijo crudo, así que "Cuerpo
   * Full" decía $65.000 con el selector en Hombre mientras el modal de
   * Vender del CRM cotizaba $81.000 para el mismo hombre.
   *
   * 5 grandes + 5 chicas: mujer 5×9 + 5×3 = 60, hombre 5×10 + 5×5 = 75.
   * 65.000 × 75/60 = 81.250 → redondeo de 1.000 → $81.000.
   */
  it("el pack fijo le cobra a un hombre el precio de hombre", async () => {
    render(<ArmadorCombo {...props} />);
    for (const nombre of ZONAS_CUERPO_FULL) {
      await userEvent.click(screen.getByLabelText(nombre));
    }
    expect(screen.getByTestId("total")).toHaveTextContent("$65.000");

    await userEvent.click(screen.getByLabelText("Hombre"));
    expect(screen.getByTestId("total")).toHaveTextContent("$81.000");
    // El cartel del pack dice el mismo número que el Total: dos números
    // distintos en la misma tarjeta son peor que uno solo equivocado.
    expect(screen.getByText(/\$81\.000 en vez de/)).toBeInTheDocument();
    // Y el pack de 3 sale de ESE total: 81.000 × 3 × 0,85 = 206.550 → 207.000.
    expect(screen.getByText("$207.000")).toBeInTheDocument();
  });

  /**
   * Ronda de arreglos 3 (Minor 2). Las zonas "a elección" del pack que se
   * está editando no se tildan acá (`choiceZoneCount` es un campo del
   * formulario de arriba) pero ocupan agenda igual: el backend las suma como
   * fantasmas chicas en `assembleDepilationCombo`. Sin esto, la fila del
   * listado decía 30 min y el armador, para el mismo pack, 25.
   */
  it("las zonas a elección del pack suman a la duración, aunque no se tilden", async () => {
    const { rerender } = render(<ArmadorCombo {...props} zonasAEleccion={0} />);
    await userEvent.click(screen.getByLabelText("Pierna entera"));
    await userEvent.click(screen.getByLabelText("Cavado"));
    await userEvent.click(screen.getByLabelText("Axila"));
    expect(screen.getByTestId("duracion")).toHaveTextContent("15 min"); // 9+3+3

    rerender(<ArmadorCombo {...props} zonasAEleccion={2} />);
    // +2 chicas fantasma (3 c/u) = 21 → redondeo de 5 → 20.
    expect(screen.getByTestId("duracion")).toHaveTextContent("20 min");
  });

  it("cambia la duración al cambiar el sexo", async () => {
    render(<ArmadorCombo {...props} />);
    await userEvent.click(screen.getByLabelText("Pierna entera"));
    await userEvent.click(screen.getByLabelText("Cavado"));
    await userEvent.click(screen.getByLabelText("Axila"));

    expect(screen.getByTestId("duracion")).toHaveTextContent("15 min"); // mujer 9+3+3
    await userEvent.click(screen.getByLabelText("Hombre"));
    expect(screen.getByTestId("duracion")).toHaveTextContent("20 min"); // hombre 10+5+5
  });

  it("el pack de 3 muestra el ahorro", async () => {
    render(<ArmadorCombo {...props} />);
    await userEvent.click(screen.getByLabelText("Pierna entera"));
    await userEvent.click(screen.getByLabelText("Cavado"));
    await userEvent.click(screen.getByLabelText("Axila"));

    // total 30.000 → pack 3 sesiones × 15% off = 76.500 → redondea a 77.000;
    // ahorro = 30.000 × 3 − 77.000 = 13.000.
    expect(screen.getByText("$77.000")).toBeInTheDocument();
    expect(screen.getByText(/Ahorrás \$13\.000/)).toBeInTheDocument();
  });

  it("sin selección no hay pack de 3 ni desglose, solo el aviso de elegir zonas", () => {
    render(<ArmadorCombo {...props} />);
    expect(screen.getByText(/Elegí al menos una zona/i)).toBeInTheDocument();
    expect(screen.queryByText(/Ahorrás/)).not.toBeInTheDocument();
    expect(screen.getByTestId("duracion")).toHaveTextContent("0 min");
  });

  it("avisa a onCambio con la selección, la cotización y la duración", async () => {
    const onCambio = vi.fn();
    render(<ArmadorCombo {...props} onCambio={onCambio} />);
    await userEvent.click(screen.getByLabelText("Pierna entera"));

    const ultimaLlamada = onCambio.mock.calls.at(-1)?.[0];
    expect(ultimaLlamada).toMatchObject({
      zonaIds: ["pierna-entera"],
      sexo: "mujer",
      duracionMinutos: 10, // 9 → piso de 10
      packFijo: null,
    });
    expect(ultimaLlamada.cotizacion.total).toBe(19000);
  });
});
