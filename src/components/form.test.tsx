import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Field, Select, TextInput } from "./form";
import { posicionDelGlobo } from "../lib/tooltip-position";

const AYUDA = "El número más chico va primero.";

describe("Field", () => {
  it("sin help, la etiqueta envuelve al campo y lo nombra", () => {
    render(
      <Field label="Orden">
        <TextInput value="" onChange={() => {}} />
      </Field>,
    );
    expect(screen.getByLabelText("Orden")).toBeInTheDocument();
  });

  it("con help, el texto del tooltip NO se pega al nombre del campo", () => {
    render(
      <Field label="Orden" help={AYUDA}>
        <TextInput value="" onChange={() => {}} />
      </Field>,
    );

    // Esta es la regresión que se quiere evitar: con el tooltip adentro del
    // <label>, el campo pasa a llamarse "Orden El número más chico va
    // primero." y deja de encontrarse por su nombre real.
    expect(screen.getByLabelText("Orden")).toBeInTheDocument();
  });

  it("con help, la explicación queda accesible como descripción del campo", () => {
    render(
      <Field label="Orden" help={AYUDA}>
        <TextInput value="" onChange={() => {}} />
      </Field>,
    );

    const input = screen.getByLabelText("Orden");
    const descrito = input.getAttribute("aria-describedby");
    expect(descrito).toBeTruthy();
    expect(document.getElementById(descrito!)).toHaveTextContent(AYUDA);
  });

  it("con help, funciona igual sobre un Select", () => {
    render(
      <Field label="Tipo" help={AYUDA}>
        <Select value="a" onChange={() => {}}>
          <option value="a">A</option>
        </Select>
      </Field>,
    );
    expect(screen.getByLabelText("Tipo").tagName).toBe("SELECT");
  });

  it("el globo aparece al pasar el mouse y se va al sacarlo", async () => {
    const user = userEvent.setup();
    render(
      <Field label="Orden" help={AYUDA}>
        <TextInput value="" onChange={() => {}} />
      </Field>,
    );

    expect(screen.queryByRole("tooltip", { hidden: true })).not.toBeInTheDocument();

    const ayuda = screen.getByRole("button", { name: "Ayuda" });
    await user.hover(ayuda);
    expect(screen.getByRole("tooltip", { hidden: true })).toHaveTextContent(AYUDA);

    await user.unhover(ayuda);
    expect(screen.queryByRole("tooltip", { hidden: true })).not.toBeInTheDocument();
  });

  it("el globo también se abre con el teclado", async () => {
    const user = userEvent.setup();
    render(
      <Field label="Orden" help={AYUDA}>
        <TextInput value="" onChange={() => {}} />
      </Field>,
    );

    await user.tab();
    expect(screen.getByRole("button", { name: "Ayuda" })).toHaveFocus();
    expect(screen.getByRole("tooltip", { hidden: true })).toHaveTextContent(AYUDA);
  });

  it("el globo se dibuja fuera del contenedor que scrollea, para no quedar recortado", async () => {
    const user = userEvent.setup();
    render(
      <div data-testid="scroller" style={{ overflowY: "auto", height: 100 }}>
        <Field label="Orden" help={AYUDA}>
          <TextInput value="" onChange={() => {}} />
        </Field>
      </div>,
    );

    await user.hover(screen.getByRole("button", { name: "Ayuda" }));
    const globo = screen.getByRole("tooltip", { hidden: true });
    // Este es el bug que se arregló: si el globo cuelga del contenedor con
    // overflow, ese contenedor lo recorta.
    expect(screen.getByTestId("scroller")).not.toContainElement(globo);
    expect(globo).toHaveStyle({ position: "fixed" });
  });

  it("el botón de ayuda no envía el formulario que lo contiene", async () => {
    const user = userEvent.setup();
    let enviados = 0;
    render(
      <form onSubmit={(e) => { e.preventDefault(); enviados += 1; }}>
        <Field label="Orden" help={AYUDA}>
          <TextInput value="" onChange={() => {}} />
        </Field>
      </form>,
    );

    await user.click(screen.getByRole("button", { name: "Ayuda" }));
    expect(enviados).toBe(0);
  });

  it("respeta el id propio del campo en vez de pisarlo", () => {
    render(
      <Field label="Orden" help={AYUDA}>
        <TextInput id="mi-id" value="" onChange={() => {}} />
      </Field>,
    );
    expect(screen.getByLabelText("Orden")).toHaveAttribute("id", "mi-id");
  });

  it("dos campos con help en la misma pantalla no comparten ids", () => {
    render(
      <>
        <Field label="Uno" help="Ayuda uno">
          <TextInput value="" onChange={() => {}} />
        </Field>
        <Field label="Dos" help="Ayuda dos">
          <TextInput value="" onChange={() => {}} />
        </Field>
      </>,
    );

    const uno = screen.getByLabelText("Uno");
    const dos = screen.getByLabelText("Dos");
    expect(uno.id).not.toBe(dos.id);
    expect(uno.getAttribute("aria-describedby")).not.toBe(dos.getAttribute("aria-describedby"));
    expect(
      document.getElementById(uno.getAttribute("aria-describedby")!),
    ).toHaveTextContent("Ayuda uno");
  });

  // Regresión: `sr-only` es position:absolute, y un absoluto se recorta contra
  // su bloque contenedor. Sin un ancestro posicionado dentro del componente,
  // ese bloque contenedor es el <html>, el span se escapa de cualquier
  // contenedor con overflow y estira el alto del documento — que fue
  // exactamente el segundo scroll que apareció en la pantalla de Precios.
  // happy-dom no calcula layout, así que lo que se fija acá es la estructura
  // que lo evita.
  it("la copia sr-only vive dentro de un ancestro posicionado", () => {
    render(
      <Field label="Orden" help={AYUDA}>
        <TextInput value="" onChange={() => {}} />
      </Field>,
    );

    const input = screen.getByLabelText("Orden");
    const srOnly = document.getElementById(input.getAttribute("aria-describedby")!);
    expect(srOnly).toHaveClass("sr-only");
    expect(srOnly!.closest(".relative")).not.toBeNull();
  });
});

describe("posicionDelGlobo", () => {
  const VENTANA = { alto: 900, ancho: 1440 };
  // El "?" del campo Orden en el drawer de Zonas, medido en producción.
  const ANCLA = { top: 153, bottom: 166, left: 700, width: 13 };

  it("se abre arriba del ícono cuando ahí entra", () => {
    const { top } = posicionDelGlobo(ANCLA, 80, VENTANA);
    // 153 − 8 − 80 = 65: arriba, sin tocar el borde.
    expect(top).toBe(65);
    expect(top).toBeGreaterThanOrEqual(0);
  });

  it("EL BUG: con un globo alto no lo empuja fuera de la ventana, lo pasa abajo", () => {
    // 167px es el alto real del tooltip de "Orden". Arriba no entra
    // (153 − 8 − 167 = −22), así que tiene que ir abajo del ícono.
    const { top } = posicionDelGlobo(ANCLA, 167, VENTANA);
    expect(top).toBe(174); // 166 + 8
    expect(top).toBeGreaterThanOrEqual(0);
    expect(top + 167).toBeLessThanOrEqual(VENTANA.alto);
  });

  it("cuando no entra ni arriba ni abajo, queda pegado al borde pero adentro", () => {
    // Ventana chica: 320 de alto, globo de 167. Ni arriba ni abajo alcanza.
    const ventana = { alto: 320, ancho: 1440 };
    const { top } = posicionDelGlobo(ANCLA, 167, ventana);
    expect(top).toBeGreaterThanOrEqual(0);
    expect(top + 167).toBeLessThanOrEqual(ventana.alto);
  });

  it("un globo más alto que la ventana entera arranca en el borde, no en negativo", () => {
    const { top } = posicionDelGlobo(ANCLA, 2000, { alto: 400, ancho: 1440 });
    expect(top).toBe(8);
  });

  it("se centra en el ícono cuando hay lugar a los costados", () => {
    const { left } = posicionDelGlobo(ANCLA, 80, VENTANA);
    // 700 + 6,5 − 130 = 576,5
    expect(left).toBeCloseTo(576.5);
  });

  it("no se sale por los costados", () => {
    const pegadoIzq = posicionDelGlobo({ ...ANCLA, left: 2 }, 80, VENTANA);
    expect(pegadoIzq.left).toBeGreaterThanOrEqual(0);

    const pegadoDer = posicionDelGlobo({ ...ANCLA, left: 1435 }, 80, VENTANA);
    expect(pegadoDer.left + 260).toBeLessThanOrEqual(VENTANA.ancho);
  });
});
