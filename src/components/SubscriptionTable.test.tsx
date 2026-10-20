import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("../lib/api-client", () => ({ apiFetch: vi.fn(() => new Promise(() => {})) }));
vi.mock("../hooks/useToken", () => ({ useToken: () => "tok" }));

import { SubscriptionTable } from "./SubscriptionTable";
import type { SubscriptionWithAttendance } from "../pages/admin/SubscriptionsAdminPage";

const fila = (o: Partial<SubscriptionWithAttendance>): SubscriptionWithAttendance => ({
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
  notes: null,
  attendedThisMonth: 0,
  scheduledThisMonth: 0,
  classesRemainingThisMonth: 8,
  paidDate: null,
  paidStatus: "pending",
  customerName: "Ana Pérez",
  cuotaDelMes: 20000,
  debeDelMes: 5000,
  ...o,
});

describe("SubscriptionTable cuota y deuda", () => {
  it("con deuda muestra 'Debe $5.000' y el botón Cobrar", () => {
    render(<SubscriptionTable subscriptions={[fila({})]} onSelectSubscription={vi.fn()} onRefresh={vi.fn()} />);
    expect(screen.getByText("Cuota del mes")).toBeInTheDocument();
    // Monto (monthlyAmount) y Cuota del mes coinciden acá: dos celdas.
    expect(screen.getAllByText("$20.000", { selector: "td" })).toHaveLength(2);
    expect(screen.getByText("Debe $5.000")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cobrar" })).toBeInTheDocument();
  });

  it("sin deuda muestra 'Al día' y no hay botón Cobrar", () => {
    render(
      <SubscriptionTable subscriptions={[fila({ debeDelMes: 0 })]} onSelectSubscription={vi.fn()} onRefresh={vi.fn()} />,
    );
    expect(screen.getByText("Al día")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cobrar" })).not.toBeInTheDocument();
  });

  it("suscripción cancelada con deuda: no hay botón Cobrar", () => {
    render(
      <SubscriptionTable subscriptions={[fila({ status: "cancelled" })]} onSelectSubscription={vi.fn()} onRefresh={vi.fn()} />,
    );
    expect(screen.queryByRole("button", { name: "Cobrar" })).not.toBeInTheDocument();
  });

  it("Cobrar abre el modal sin seleccionar la fila", async () => {
    const onSelect = vi.fn();
    render(<SubscriptionTable subscriptions={[fila({})]} onSelectSubscription={onSelect} onRefresh={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Cobrar" }));
    expect(screen.getByText(/Cobrar cuota/)).toBeInTheDocument();
    expect(onSelect).not.toHaveBeenCalled();
  });
});

describe("SubscriptionTable columna Horarios", () => {
  it("muestra los horarios del mes separados por ' · '", () => {
    render(
      <SubscriptionTable
        subscriptions={[fila({ horariosDelMes: ["Lun 10:00", "Mié 10:00"] })]}
        onSelectSubscription={vi.fn()}
        onRefresh={vi.fn()}
      />,
    );
    expect(screen.getByRole("columnheader", { name: "Horarios" })).toBeInTheDocument();
    expect(screen.getByText("Lun 10:00 · Mié 10:00")).toBeInTheDocument();
  });

  it("sin horarios muestra 'Sin anotar este mes'", () => {
    render(
      <SubscriptionTable subscriptions={[fila({ horariosDelMes: [] })]} onSelectSubscription={vi.fn()} onRefresh={vi.fn()} />,
    );
    expect(screen.getByText("Sin anotar este mes")).toBeInTheDocument();
  });
});
