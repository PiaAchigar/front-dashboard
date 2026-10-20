import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const apiFetch = vi.fn();
vi.mock("../lib/api-client", () => ({ apiFetch: (...a: unknown[]) => apiFetch(...a) }));
vi.mock("../hooks/useToken", () => ({ useToken: () => "tok" }));

import { CobrarCuotaModal } from "./CobrarCuotaModal";

const cuota = { billingCycleId: null, mes: "2026-10", cuota: 20000, pagado: 15000, debe: 5000, isPaid: false };

function montar(onCobrado = vi.fn()) {
  render(
    <CobrarCuotaModal
      subscriptionId="sub-1"
      nombre="Ana Pérez"
      actividad="Pilates"
      mes="2026-10"
      onCobrado={onCobrado}
      onClose={vi.fn()}
    />,
  );
  return onCobrado;
}

beforeEach(() => {
  apiFetch.mockReset();
  apiFetch.mockResolvedValueOnce(cuota);
});

describe("CobrarCuotaModal", () => {
  it("muestra cuota, pagado y Debe, con el monto precargado en Debe", async () => {
    montar();
    expect(await screen.findByText("Debe")).toBeInTheDocument();
    expect(apiFetch.mock.calls[0][0]).toBe("/api/training-subscriptions/sub-1/cuota?mes=2026-10");
    expect(screen.getAllByText("$5.000").length).toBeGreaterThan(0);
    expect(screen.getByLabelText("Monto")).toHaveValue(5000);
    expect(screen.getByRole("button", { name: "Cobrar $5.000" })).toBeEnabled();
  });

  it("manda {mes, amount, method, wantsInvoice} y llama onCobrado", async () => {
    apiFetch.mockResolvedValueOnce({ cuota: { ...cuota, pagado: 20000, debe: 0 } });
    const onCobrado = montar();
    await screen.findByText("Debe");
    await userEvent.selectOptions(screen.getByLabelText("Medio de pago"), "bank_transfer");
    await userEvent.click(screen.getByLabelText("Lleva factura"));
    await userEvent.click(screen.getByRole("button", { name: "Cobrar $5.000" }));
    await waitFor(() => expect(onCobrado).toHaveBeenCalledOnce());
    const [path, token, opts] = apiFetch.mock.calls[1];
    expect(path).toBe("/api/training-subscriptions/sub-1/cobrar");
    expect(token).toBe("tok");
    expect(opts.method).toBe("POST");
    expect(JSON.parse(opts.body)).toEqual({
      mes: "2026-10",
      amount: 5000,
      method: "bank_transfer",
      wantsInvoice: true,
    });
  });

  it("un monto mayor a Debe deshabilita el botón", async () => {
    montar();
    await screen.findByText("Debe");
    const input = screen.getByLabelText("Monto");
    await userEvent.clear(input);
    await userEvent.type(input, "5001");
    expect(screen.getByText("No puede superar lo que debe")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Cobrar/ })).toBeDisabled();
  });

  it("un monto 0 deshabilita el botón", async () => {
    montar();
    await screen.findByText("Debe");
    const input = screen.getByLabelText("Monto");
    await userEvent.clear(input);
    await userEvent.type(input, "0");
    expect(screen.getByRole("button", { name: /^Cobrar/ })).toBeDisabled();
  });

  it("muestra tal cual el error de la API y no llama onCobrado", async () => {
    apiFetch.mockRejectedValueOnce(new Error("La suscripción está cancelada"));
    const onCobrado = montar();
    await screen.findByText("Debe");
    await userEvent.click(screen.getByRole("button", { name: "Cobrar $5.000" }));
    expect(await screen.findByText("La suscripción está cancelada")).toBeInTheDocument();
    expect(onCobrado).not.toHaveBeenCalled();
  });
});
