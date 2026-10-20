import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
