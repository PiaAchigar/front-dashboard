import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const apiFetch = vi.fn();
vi.mock("../lib/api-client", () => ({ apiFetch: (...a: unknown[]) => apiFetch(...a) }));
vi.mock("../hooks/useToken", () => ({ useToken: () => "tok" }));
vi.mock("./ui/Toast", () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn() }) }));

import { SubscriptionDetailsModal } from "./SubscriptionDetailsModal";
import type { SubscriptionWithAttendance } from "../pages/admin/SubscriptionsAdminPage";

const sub = (o: Partial<SubscriptionWithAttendance> = {}): SubscriptionWithAttendance => ({
  id: "s1",
  customerId: "c1",
  activityId: "a1",
  activityName: "Pilates",
  activityType: "class",
  classesPerMonth: 8,
  subscriptionStartDate: "2026-01-01",
  subscriptionEndDate: null,
  monthlyAmount: 20000,
  status: "active",
  notes: "algo",
  attendedThisMonth: 0,
  scheduledThisMonth: 0,
  classesRemainingThisMonth: 8,
  paidDate: null,
  paidStatus: "pending",
  customerName: "Ana",
  cuotaDelMes: 20000,
  debeDelMes: 0,
  ...o,
});

beforeEach(() => {
  vi.useRealTimers();
  apiFetch.mockReset();
  apiFetch.mockResolvedValue({});
});

describe("SubscriptionDetailsModal", () => {
  it("ya no tiene el tilde 'Pagado'", () => {
    render(<SubscriptionDetailsModal subscription={sub()} onClose={vi.fn()} onUpdate={vi.fn()} />);
    expect(screen.queryByLabelText("Pagado")).not.toBeInTheDocument();
  });

  it("si ya está pagado deja el texto '✅ Pagado el …'", () => {
    render(
      <SubscriptionDetailsModal
        subscription={sub({ paidDate: "2026-10-05", paidStatus: "paid" })}
        onClose={vi.fn()}
        onUpdate={vi.fn()}
      />,
    );
    expect(screen.getByText(/✅ Pagado el 5\/10\/2026/)).toBeInTheDocument();
  });

  it("guarda estado y notas sin mandar paidDate", async () => {
    render(<SubscriptionDetailsModal subscription={sub()} onClose={vi.fn()} onUpdate={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    const body = JSON.parse(apiFetch.mock.calls[0][2].body);
    expect(body).toEqual({ status: "active", notes: "algo" });
  });
});

describe("SubscriptionDetailsModal Renovar", () => {
  afterEach(() => vi.useRealTimers());

  // 15/10/2026 12:00 ART: el mes siguiente es noviembre.
  const fijarHoy = () => vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-15T15:00:00Z") });

  it("el botón nombra el mes siguiente y manda { mes } de ese mes", async () => {
    fijarHoy();
    apiFetch.mockResolvedValue({ anotadas: 8, sinLugar: [], superaPlan: false, clasesDelMes: 8 });
    render(<SubscriptionDetailsModal subscription={sub()} onClose={vi.fn()} onUpdate={vi.fn()} />);
    await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).click(screen.getByRole("button", { name: "Renovar noviembre" }));
    expect(apiFetch.mock.calls[0][0]).toBe("/api/training-subscriptions/s1/renovar");
    expect(apiFetch.mock.calls[0][2].method).toBe("POST");
    expect(JSON.parse(apiFetch.mock.calls[0][2].body)).toEqual({ mes: "2026-11" });
  });

  it("muestra cuántas clases quedó anotada y recarga la lista", async () => {
    fijarHoy();
    const onUpdate = vi.fn();
    apiFetch.mockResolvedValue({ anotadas: 7, sinLugar: [], superaPlan: false, clasesDelMes: 7 });
    render(<SubscriptionDetailsModal subscription={sub()} onClose={vi.fn()} onUpdate={onUpdate} />);
    await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).click(screen.getByRole("button", { name: "Renovar noviembre" }));
    expect(await screen.findByText("Quedó anotada en 7 clases")).toBeInTheDocument();
    expect(screen.queryByText(/Sin lugar/)).toBeNull();
    expect(onUpdate).toHaveBeenCalled();
  });

  it("muestra 'Sin lugar' con fechas dd/mm y 'Supera las N clases del plan'", async () => {
    fijarHoy();
    apiFetch.mockResolvedValue({
      anotadas: 8,
      sinLugar: ["2026-11-03T13:00:00.000Z", "2026-11-10T13:00:00.000Z"],
      superaPlan: true,
      clasesDelMes: 9,
    });
    render(<SubscriptionDetailsModal subscription={sub({ classesPerMonth: 8 })} onClose={vi.fn()} onUpdate={vi.fn()} />);
    await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).click(screen.getByRole("button", { name: "Renovar noviembre" }));
    expect(await screen.findByText("Sin lugar: 03/11, 10/11")).toBeInTheDocument();
    expect(screen.getByText("Supera las 8 clases del plan")).toBeInTheDocument();
  });

  it("muestra el mensaje del error tal cual", async () => {
    apiFetch.mockRejectedValue(new Error("No hay horarios en el mes anterior"));
    render(<SubscriptionDetailsModal subscription={sub()} onClose={vi.fn()} onUpdate={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /^Renovar / }));
    await waitFor(() => expect(screen.getByText("No hay horarios en el mes anterior")).toBeInTheDocument());
  });

  it("también hay Renovar en actividades de máquina (Thermo Bike tiene horarios)", () => {
    render(<SubscriptionDetailsModal subscription={sub({ activityType: "machine" })} onClose={vi.fn()} onUpdate={vi.fn()} />);
    expect(screen.getByRole("button", { name: /^Renovar / })).toBeInTheDocument();
  });
});
