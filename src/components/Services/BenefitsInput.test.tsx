import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BenefitsInput } from "./BenefitsInput";

function montar(props: Partial<Parameters<typeof BenefitsInput>[0]> = {}) {
  const onChange = vi.fn();
  render(
    <BenefitsInput
      label="Beneficios"
      value=""
      onChange={onChange}
      sePublica
      {...props}
    />,
  );
  return { onChange };
}

describe("BenefitsInput", () => {
  // Lo que decide dónde escribe Laura cada cosa: Beneficios se publica en la
  // tarjeta de resultados de la web, los otros dos no se muestran en ningún
  // lado del sitio. Si el campo no lo dice, hay que adivinarlo.
  it("un campo que se publica lo dice", () => {
    montar({ sePublica: true });
    expect(screen.getByText(/se publica en la web/i)).toBeInTheDocument();
  });

  it("un campo interno dice que NO se publica", () => {
    montar({ label: "Contraindicaciones", sePublica: false });
    expect(screen.getByText(/no se publica/i)).toBeInTheDocument();
    expect(screen.queryByText(/^Se publica en la web/i)).not.toBeInTheDocument();
  });

  // El cartel viejo saltaba al primer tecleo en CUALQUIER servicio que ya
  // tuviera descripción —o sea, casi todos— para avisar algo que nadie temía,
  // y hablaba sólo de "la búsqueda", escondiendo que Beneficios se publica.
  it("no interrumpe con carteles al escribir", async () => {
    montar();
    await userEvent.type(screen.getByRole("textbox"), "Tonifica el músculo");
    expect(screen.queryByText(/complementarán/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/ya tiene descripción/i)).not.toBeInTheDocument();
  });

  it("propaga lo que se escribe y cuenta los caracteres", async () => {
    const { onChange } = montar({ value: "Hola" });
    expect(screen.getByText("4 / 500 caracteres")).toBeInTheDocument();
    await userEvent.type(screen.getByRole("textbox"), "!");
    expect(onChange).toHaveBeenCalledWith("Hola!");
  });

  it("muestra la ayuda de ejemplo cuando se la pasan", () => {
    montar({ description: "Ej: Reduce vello en 80%" });
    expect(screen.getByText(/Ej: Reduce vello en 80%/)).toBeInTheDocument();
  });
});
