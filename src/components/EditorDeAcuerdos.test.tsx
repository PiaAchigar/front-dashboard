import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EditorDeAcuerdos, type FilaDeAcuerdo } from "./EditorDeAcuerdos";

const TIPOS_TRES = [
  { value: "per_hour" as const, label: "Por hora" },
  { value: "percentage" as const, label: "Porcentaje (%)" },
  { value: "fixed_per_service" as const, label: "Fijo por servicio" },
];

describe("EditorDeAcuerdos", () => {
  it("ofrece exactamente los tipos de pago que recibe", async () => {
    render(
      <EditorDeAcuerdos
        filas={[{ serviceProviderId: "p1", paymentType: "per_hour", rate: "100" }]}
        onChange={() => {}}
        proveedoras={[{ id: "p1", fullName: "Romina" }]}
        tiposDePago={[
          { value: "fixed_per_service", label: "Monto fijo por sesión" },
          { value: "per_hour", label: "Por hora" },
        ]}
      />,
    );
    const opciones = screen.getAllByRole("option").map((o) => o.textContent);
    expect(opciones).toContain("Por hora");
    expect(opciones).not.toContain("Porcentaje (%)");
  });

  it("dibuja el pie de fila cuando se lo dan", () => {
    render(
      <EditorDeAcuerdos
        filas={[{ serviceProviderId: "p1", paymentType: "per_hour", rate: "28000" }]}
        onChange={() => {}}
        proveedoras={[{ id: "p1", fullName: "Romina" }]}
        tiposDePago={[{ value: "per_hour", label: "Por hora" }]}
        pieDeFila={(f) => <span>pie:{f.rate}</span>}
      />,
    );
    expect(screen.getByText("pie:28000")).toBeInTheDocument();
  });

  it("sin pieDeFila no dibuja nada extra bajo la fila", () => {
    render(
      <EditorDeAcuerdos
        filas={[{ serviceProviderId: "p1", paymentType: "per_hour", rate: "100" }]}
        onChange={() => {}}
        proveedoras={[{ id: "p1", fullName: "Romina" }]}
        tiposDePago={TIPOS_TRES}
      />,
    );
    expect(screen.queryByText(/pie:/)).not.toBeInTheDocument();
  });

  it("muestra la nota cuando se la pasan", () => {
    render(
      <EditorDeAcuerdos
        filas={[]}
        onChange={() => {}}
        proveedoras={[]}
        tiposDePago={TIPOS_TRES}
        nota="Sin porcentaje: el servicio ancla no tiene precio."
      />,
    );
    expect(
      screen.getByText("Sin porcentaje: el servicio ancla no tiene precio."),
    ).toBeInTheDocument();
  });

  it("sin filas muestra el mensaje de 'sin proveedoras asignadas'", () => {
    render(
      <EditorDeAcuerdos
        filas={[]}
        onChange={() => {}}
        proveedoras={[]}
        tiposDePago={TIPOS_TRES}
      />,
    );
    expect(screen.getByText("Sin proveedoras asignadas.")).toBeInTheDocument();
  });

  it("la etiqueta de tarifa es (%) sólo cuando el tipo es percentage", () => {
    render(
      <EditorDeAcuerdos
        filas={[
          { serviceProviderId: "p1", paymentType: "percentage", rate: "10" },
          { serviceProviderId: "p2", paymentType: "per_hour", rate: "100" },
        ]}
        onChange={() => {}}
        proveedoras={[
          { id: "p1", fullName: "Romina" },
          { id: "p2", fullName: "Laura" },
        ]}
        tiposDePago={TIPOS_TRES}
      />,
    );
    expect(screen.getByText("Tarifa (%)")).toBeInTheDocument();
    expect(screen.getByText("Tarifa ($)")).toBeInTheDocument();
  });

  it("agregar proveedora suma una fila vacía vía onChange", async () => {
    const onChange = vi.fn();
    render(
      <EditorDeAcuerdos
        filas={[]}
        onChange={onChange}
        proveedoras={[{ id: "p1", fullName: "Romina" }]}
        tiposDePago={TIPOS_TRES}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /agregar proveedora/i }));
    expect(onChange).toHaveBeenCalledWith([{ serviceProviderId: "", paymentType: "", rate: "" }]);
  });

  it("quitar proveedora saca la fila vía onChange", async () => {
    const onChange = vi.fn();
    const filas: FilaDeAcuerdo[] = [
      { serviceProviderId: "p1", paymentType: "per_hour", rate: "100" },
    ];
    render(
      <EditorDeAcuerdos
        filas={filas}
        onChange={onChange}
        proveedoras={[{ id: "p1", fullName: "Romina" }]}
        tiposDePago={TIPOS_TRES}
      />,
    );
    await userEvent.click(screen.getByTitle("Quitar proveedora"));
    expect(onChange).toHaveBeenCalledWith([]);
  });
});
