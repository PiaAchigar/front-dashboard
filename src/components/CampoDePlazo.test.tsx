import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { CampoDePlazo } from "./CampoDePlazo";

function Probe({ obligatorio, onChange }: { obligatorio: boolean; onChange: (v: string) => void }) {
  const [v, setV] = useState("");
  return (
    <CampoDePlazo
      valor={v}
      obligatorio={obligatorio}
      onChange={(x) => {
        setV(x);
        onChange(x);
      }}
    />
  );
}

describe("CampoDePlazo", () => {
  it("manda el número de semanas", async () => {
    const onChange = vi.fn();
    render(<Probe obligatorio={false} onChange={onChange} />);
    await userEvent.type(screen.getByLabelText("Semanas para usarlo"), "5");
    expect(onChange).toHaveBeenLastCalledWith("5");
  });

  it("el (?) muestra el texto", () => {
    render(<Probe obligatorio={false} onChange={() => {}} />);
    expect(screen.getByRole("button", { name: "Ayuda" })).toBeInTheDocument();
    expect(screen.getByText(/empieza a contar el día de la compra/i)).toBeInTheDocument();
    expect(screen.getByText(/aplazar desde su ficha en el CRM/i)).toBeInTheDocument();
  });

  it("sin 'no vence' cuando es obligatorio", () => {
    const { unmount } = render(<Probe obligatorio={true} onChange={() => {}} />);
    expect(screen.queryByText(/no vence/i)).toBeNull();
    unmount();
    render(<Probe obligatorio={false} onChange={() => {}} />);
    expect(screen.getByText(/Si lo dejás vacío, no vence/i)).toBeInTheDocument();
  });
});
