import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Field, Select, TextInput } from "./form";

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

  it("con help, muestra el tooltip y funciona igual sobre un Select", () => {
    render(
      <Field label="Tipo" help={AYUDA}>
        <Select value="a" onChange={() => {}}>
          <option value="a">A</option>
        </Select>
      </Field>,
    );
    expect(screen.getByLabelText("Tipo").tagName).toBe("SELECT");
    expect(screen.getByRole("tooltip", { hidden: true })).toHaveTextContent(AYUDA);
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
});
