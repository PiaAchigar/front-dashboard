import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EditorDeAcuerdos, type FilaDeAcuerdo } from "./EditorDeAcuerdos";

const TIPOS_TRES = [
  { value: "per_hour" as const, label: "Por hora" },
  { value: "percentage" as const, label: "Porcentaje (%)" },
  { value: "fixed_per_service" as const, label: "Fijo por servicio" },
];

/** Envoltorio con estado real, para probar `patch` de punta a punta: sin esto
 *  cada `onChange` se verifica contra la prop `filas` fija con la que se
 *  montó el test, no contra lo que el usuario ya tipeó, y no detecta un
 *  índice equivocado ni una propagación a medias. */
function EditorConEstado({
  initial,
  proveedoras,
  tiposDePago,
}: {
  initial: FilaDeAcuerdo[];
  proveedoras: { id: string; fullName: string | null }[];
  tiposDePago: typeof TIPOS_TRES;
}) {
  const [filas, setFilas] = useState(initial);
  return (
    <EditorDeAcuerdos
      filas={filas}
      onChange={setFilas}
      proveedoras={proveedoras}
      tiposDePago={tiposDePago}
    />
  );
}

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

  // Revisión final, G6. Quien puede VER las comisiones pero no editarlas
  // (`operator` llega a la pestaña de Comisión con dos clicks) tenía un editor
  // sin ningún `disabled`: cambiaba tarifas y quitaba proveedoras, y recién al
  // final descubría que no hay botón de Guardar y que todo se tiró.
  describe("soloLectura", () => {
    it("apaga los dos desplegables, la tarifa, el tacho y el botón de agregar", () => {
      render(
        <EditorDeAcuerdos
          filas={[{ serviceProviderId: "p1", paymentType: "per_hour", rate: "100" }]}
          onChange={() => {}}
          proveedoras={[{ id: "p1", fullName: "Romina" }]}
          tiposDePago={TIPOS_TRES}
          soloLectura
        />,
      );
      expect(screen.getByLabelText("Proveedora")).toBeDisabled();
      expect(screen.getByLabelText("Tipo de pago")).toBeDisabled();
      expect(screen.getByPlaceholderText("0")).toBeDisabled();
      expect(screen.getByTitle("Quitar proveedora")).toBeDisabled();
      expect(screen.getByRole("button", { name: /agregar proveedora/i })).toBeDisabled();
    });

    it("el dato se sigue viendo: sólo lectura no es lo mismo que invisible", () => {
      render(
        <EditorDeAcuerdos
          filas={[{ serviceProviderId: "p1", paymentType: "per_hour", rate: "28000" }]}
          onChange={() => {}}
          proveedoras={[{ id: "p1", fullName: "Romina" }]}
          tiposDePago={TIPOS_TRES}
          soloLectura
        />,
      );
      expect(screen.getByLabelText("Proveedora")).toHaveValue("p1");
      expect(screen.getByPlaceholderText("0")).toHaveValue("28000");
    });

    it("por defecto NO es sólo lectura: la pantalla de Servicios sigue editando", () => {
      render(
        <EditorDeAcuerdos
          filas={[{ serviceProviderId: "p1", paymentType: "per_hour", rate: "100" }]}
          onChange={() => {}}
          proveedoras={[{ id: "p1", fullName: "Romina" }]}
          tiposDePago={TIPOS_TRES}
        />,
      );
      expect(screen.getByLabelText("Proveedora")).toBeEnabled();
      expect(screen.getByPlaceholderText("0")).toBeEnabled();
      expect(screen.getByTitle("Quitar proveedora")).toBeEnabled();
    });
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

  describe("propagación de ediciones (patch)", () => {
    const DOS_FILAS: FilaDeAcuerdo[] = [
      { serviceProviderId: "p1", paymentType: "per_hour", rate: "100" },
      { serviceProviderId: "p2", paymentType: "per_hour", rate: "200" },
    ];
    const PROVEEDORAS = [
      { id: "p1", fullName: "Romina" },
      { id: "p2", fullName: "Laura" },
    ];

    it("editar la tarifa de la fila 2 no toca la fila 1 (protege contra off-by-one en el índice)", async () => {
      render(
        <EditorConEstado
          initial={DOS_FILAS}
          proveedoras={PROVEEDORAS}
          tiposDePago={TIPOS_TRES}
        />,
      );
      const tarifas = screen.getAllByPlaceholderText("0");
      expect(tarifas).toHaveLength(2);

      await userEvent.clear(tarifas[1]);
      await userEvent.type(tarifas[1], "250");

      expect(tarifas[0]).toHaveValue("100");
      expect(tarifas[1]).toHaveValue("250");
    });

    it("editar la proveedora de una fila se propaga (select)", async () => {
      render(
        <EditorConEstado
          initial={[{ serviceProviderId: "", paymentType: "per_hour", rate: "100" }]}
          proveedoras={PROVEEDORAS}
          tiposDePago={TIPOS_TRES}
        />,
      );
      await userEvent.selectOptions(screen.getByLabelText("Proveedora"), "p2");
      expect(screen.getByLabelText("Proveedora")).toHaveValue("p2");
    });

    it("editar el tipo de pago de una fila se propaga (select) y actualiza la etiqueta de tarifa", async () => {
      render(
        <EditorConEstado
          initial={[{ serviceProviderId: "p1", paymentType: "per_hour", rate: "100" }]}
          proveedoras={PROVEEDORAS}
          tiposDePago={TIPOS_TRES}
        />,
      );
      expect(screen.getByText("Tarifa ($)")).toBeInTheDocument();
      await userEvent.selectOptions(screen.getByLabelText("Tipo de pago"), "percentage");
      expect(screen.getByLabelText("Tipo de pago")).toHaveValue("percentage");
      expect(screen.getByText("Tarifa (%)")).toBeInTheDocument();
    });

    it("editar la tarifa de la única fila se propaga (input)", async () => {
      render(
        <EditorConEstado
          initial={[{ serviceProviderId: "p1", paymentType: "per_hour", rate: "100" }]}
          proveedoras={PROVEEDORAS}
          tiposDePago={TIPOS_TRES}
        />,
      );
      const tarifa = screen.getByPlaceholderText("0");
      await userEvent.clear(tarifa);
      await userEvent.type(tarifa, "999");
      expect(tarifa).toHaveValue("999");
    });

    it("agregar una fila deja las existentes intactas y la nueva vacía", async () => {
      render(
        <EditorConEstado
          initial={DOS_FILAS}
          proveedoras={PROVEEDORAS}
          tiposDePago={TIPOS_TRES}
        />,
      );
      await userEvent.click(screen.getByRole("button", { name: /agregar proveedora/i }));

      const tarifas = screen.getAllByPlaceholderText("0");
      expect(tarifas).toHaveLength(3);
      expect(tarifas[0]).toHaveValue("100");
      expect(tarifas[1]).toHaveValue("200");
      expect(tarifas[2]).toHaveValue("");

      const proveedoraSelects = screen.getAllByLabelText("Proveedora");
      expect(proveedoraSelects[2]).toHaveValue("");
    });

    it("quitar la fila del medio saca sólo esa", async () => {
      const TRES_FILAS: FilaDeAcuerdo[] = [
        { serviceProviderId: "p1", paymentType: "per_hour", rate: "100" },
        { serviceProviderId: "p2", paymentType: "per_hour", rate: "200" },
        { serviceProviderId: "p1", paymentType: "fixed_per_service", rate: "300" },
      ];
      render(
        <EditorConEstado
          initial={TRES_FILAS}
          proveedoras={PROVEEDORAS}
          tiposDePago={TIPOS_TRES}
        />,
      );
      const botonesQuitar = screen.getAllByTitle("Quitar proveedora");
      expect(botonesQuitar).toHaveLength(3);

      await userEvent.click(botonesQuitar[1]);

      const tarifas = screen.getAllByPlaceholderText("0");
      expect(tarifas).toHaveLength(2);
      expect(tarifas[0]).toHaveValue("100");
      expect(tarifas[1]).toHaveValue("300");
    });
  });
  // Ronda de arreglos 1, punto 6: `etiquetaTarifa` la fija la pantalla que usa
  // el editor (Depilación le dice "Cuánto cobra" porque es el idioma del resto
  // de esa pantalla), pero el porcentaje no es una preferencia de vocabulario:
  // son puntos porcentuales, no pesos. Un llamador que fije la etiqueta Y
  // ofrezca porcentaje vería un "($)" arriba de un 40 que no son pesos.
  describe("etiqueta de la tarifa", () => {
    it("el porcentaje le gana a la etiqueta que fija la pantalla", () => {
      render(
        <EditorDeAcuerdos
          filas={[{ serviceProviderId: "p1", paymentType: "percentage", rate: "40" }]}
          onChange={() => {}}
          proveedoras={[{ id: "p1", fullName: "Romina" }]}
          tiposDePago={TIPOS_TRES}
          etiquetaTarifa="Cuánto cobra ($)"
        />,
      );
      expect(screen.getByLabelText("Tarifa (%)")).toBeInTheDocument();
      expect(screen.queryByLabelText("Cuánto cobra ($)")).not.toBeInTheDocument();
    });

    // Revisión final, G4. El arreglo del "20.000" que valía $20 vive SÓLO en la
    // pantalla de Comisión, y este test es el que dice por qué no puede subir
    // acá: el editor compartido lo usa también ServiciosAdminPage, donde
    // `percentage` existe y "12.5" es doce y medio por ciento legítimo. Si
    // alguien mete la normalización de miles en este componente, "12.5" pasa a
    // ser 125% y esto se pone rojo.
    it("no toca el punto decimal de un porcentaje: 12.5 sigue siendo 12.5", async () => {
      render(
        <EditorConEstado
          initial={[{ serviceProviderId: "p1", paymentType: "percentage", rate: "" }]}
          proveedoras={[{ id: "p1", fullName: "Romina" }]}
          tiposDePago={TIPOS_TRES}
        />,
      );
      const tarifa = screen.getByPlaceholderText("0");
      await userEvent.type(tarifa, "12.5");

      expect(tarifa).toHaveValue("12.5");
      // Y lo que ServiciosAdminPage manda al servidor sale de ese mismo texto.
      expect(Number((tarifa as HTMLInputElement).value)).toBe(12.5);
    });

    it("sin porcentaje, la etiqueta que fija la pantalla manda", () => {
      render(
        <EditorDeAcuerdos
          filas={[{ serviceProviderId: "p1", paymentType: "per_hour", rate: "28000" }]}
          onChange={() => {}}
          proveedoras={[{ id: "p1", fullName: "Romina" }]}
          tiposDePago={TIPOS_TRES}
          etiquetaTarifa="Cuánto cobra ($)"
        />,
      );
      expect(screen.getByLabelText("Cuánto cobra ($)")).toBeInTheDocument();
    });
  });
});
