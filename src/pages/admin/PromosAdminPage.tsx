import { useMemo, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { ResourceManager, type Column } from "../../components/ResourceManager";
import { EntityDrawer } from "../../components/EntityDrawer";
import { Field, Select, TextArea, TextInput } from "../../components/form";
import { Plus, Trash } from "../../components/icons";
import { useToast } from "../../components/ui/Toast";
import { useServices } from "../../hooks/useServices";
import { useProvidersByService } from "../../hooks/useProvidersByService";
import {
  useArchivePromotion,
  useCreatePromotion,
  usePromotionsAdmin,
  useRestorePromotion,
  useUpdatePromotionAdmin,
  type PromotionInput,
} from "../../hooks/usePromotionsAdmin";
import type { PromotionAdmin } from "../../lib/api-types";

const STAFF = ["admin", "manager", "operator"];

const money = (n: number | null | undefined) =>
  n == null ? "—" : `$${n.toLocaleString("es-AR")}`;

// Línea en edición: todo string para los inputs controlados.
type DraftLine = {
  serviceId: string;
  serviceProviderId: string;
  providerPayment: string;
};

type Form = {
  name: string;
  description: string;
  promotionType: "" | "percentage" | "fixed_amount";
  discountValue: string;
  validFrom: string;
  validUntil: string;
  isFeatured: boolean;
  usageLimit: string;
  notes: string;
  lines: DraftLine[];
};

const EMPTY: Form = {
  name: "",
  description: "",
  promotionType: "",
  discountValue: "",
  validFrom: "",
  validUntil: "",
  isFeatured: false,
  usageLimit: "",
  notes: "",
  lines: [],
};

const EMPTY_LINE: DraftLine = { serviceId: "", serviceProviderId: "", providerPayment: "" };

// Mismo cálculo que el backend (lib/promo-pricing) para previsualizar el monto frizado.
function applyDiscount(
  subtotal: number,
  type: Form["promotionType"],
  value: number | null,
): number {
  if (type === "percentage" && value != null) return Math.max(0, subtotal - (subtotal * value) / 100);
  if (type === "fixed_amount" && value != null) return Math.max(0, subtotal - value);
  return subtotal;
}

/** Una fila de servicio dentro de la promo: servicio → proveedora (del servicio) → pago. */
function LineRow({
  line,
  services,
  onChange,
  onRemove,
}: {
  line: DraftLine;
  services: { id: string; name: string | null }[];
  onChange: (l: DraftLine) => void;
  onRemove: () => void;
}) {
  const { data: providers = [] } = useProvidersByService(line.serviceId || null);

  return (
    <li className="space-y-2 rounded-lg border border-surface-high bg-white p-2.5">
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <Field label="Servicio">
            <Select
              value={line.serviceId}
              onChange={(e) =>
                // al cambiar de servicio se resetea la proveedora elegida
                onChange({ ...line, serviceId: e.target.value, serviceProviderId: "" })
              }
            >
              <option value="">Elegí un servicio…</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name ?? "—"}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <button
          type="button"
          onClick={onRemove}
          title="Quitar servicio"
          className="mt-6 shrink-0 rounded p-1.5 text-ink-soft transition-colors hover:bg-surface-high hover:text-red-700"
        >
          <Trash size={15} />
        </button>
      </div>
      <div className="flex gap-2">
        <Field label="Proveedora">
          <Select
            value={line.serviceProviderId}
            disabled={!line.serviceId}
            onChange={(e) => onChange({ ...line, serviceProviderId: e.target.value })}
          >
            <option value="">{line.serviceId ? "Elegí proveedora…" : "Elegí servicio primero"}</option>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.fullName ?? "—"}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="Se le paga ($)"
          help="Cuánto recibe esta proveedora por su servicio dentro de la promo. La empresa gana el total de la promo menos la suma de estos pagos."
        >
          <TextInput
            inputMode="numeric"
            value={line.providerPayment}
            onChange={(e) => onChange({ ...line, providerPayment: e.target.value })}
            placeholder="0"
          />
        </Field>
      </div>
    </li>
  );
}

export function PromosAdminPage() {
  const { role } = useAuth();
  const isStaff = STAFF.includes(role ?? "");
  const isAdmin = role === "admin";
  const toast = useToast();

  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<PromotionAdmin | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: promos = [], isLoading, error } = usePromotionsAdmin(showArchived);
  const { data: services = [] } = useServices();
  const create = useCreatePromotion();
  const update = useUpdatePromotionAdmin();
  const archive = useArchivePromotion();
  const restore = useRestorePromotion();

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return promos;
    return promos.filter((p) => (p.name ?? "").toLowerCase().includes(q));
  }, [promos, search]);

  // Previsualización del snapshot mientras se edita (precio de lista de cada servicio elegido).
  const priceById = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of services) m.set(s.id, s.unitPriceList ?? 0);
    return m;
  }, [services]);

  const subtotalPreview = form.lines.reduce((acc, l) => acc + (priceById.get(l.serviceId) ?? 0), 0);
  const discountValue = form.discountValue.trim() === "" ? null : Number(form.discountValue);
  const finalPreview = applyDiscount(subtotalPreview, form.promotionType, discountValue);

  const columns: Column<PromotionAdmin>[] = [
    {
      key: "name",
      header: "Promo",
      width: 220,
      render: (p) => <span className="font-medium text-ink">{p.name ?? "—"}</span>,
    },
    {
      key: "type",
      header: "Descuento",
      width: 140,
      render: (p) =>
        p.promotionType === "percentage"
          ? `${p.discountPercentage ?? 0}%`
          : p.promotionType === "fixed_amount"
            ? money(p.discountAmount)
            : "—",
    },
    {
      key: "subtotal",
      header: "Subtotal",
      width: 120,
      render: (p) => <span className="text-ink-soft">{money(p.servicesSubtotal)}</span>,
    },
    {
      key: "final",
      header: "Total promo",
      width: 120,
      render: (p) => <span className="font-medium text-ink">{money(p.finalAmount)}</span>,
    },
    {
      key: "featured",
      header: "Destacada",
      width: 110,
      render: (p) =>
        p.isFeatured ? (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary-dark">
            Destacada
          </span>
        ) : (
          <span className="text-ink-soft">—</span>
        ),
    },
  ];

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setFormError(null);
    setDrawerOpen(true);
  }

  function openEdit(p: PromotionAdmin) {
    setEditing(p);
    setForm({
      name: p.name ?? "",
      description: p.description ?? "",
      promotionType: (p.promotionType as Form["promotionType"]) ?? "",
      discountValue:
        p.promotionType === "percentage"
          ? String(p.discountPercentage ?? "")
          : p.promotionType === "fixed_amount"
            ? String(p.discountAmount ?? "")
            : "",
      validFrom: p.validFrom ?? "",
      validUntil: p.validUntil ?? "",
      isFeatured: p.isFeatured ?? false,
      usageLimit: p.usageLimit != null ? String(p.usageLimit) : "",
      notes: p.notes ?? "",
      lines: p.lines.map((l) => ({
        serviceId: l.serviceId ?? "",
        serviceProviderId: l.serviceProviderId ?? "",
        providerPayment: l.providerPayment != null ? String(l.providerPayment) : "",
      })),
    });
    setFormError(null);
    setDrawerOpen(true);
  }

  function buildPayload(): PromotionInput {
    const value = form.discountValue.trim() === "" ? null : Number(form.discountValue);
    return {
      name: form.name.trim(),
      description: form.description.trim() || null,
      promotionType: form.promotionType || null,
      discountPercentage: form.promotionType === "percentage" ? value : null,
      discountAmount: form.promotionType === "fixed_amount" ? value : null,
      validFrom: form.validFrom || null,
      validUntil: form.validUntil || null,
      isFeatured: form.isFeatured,
      usageLimit: form.usageLimit.trim() === "" ? null : Number(form.usageLimit),
      notes: form.notes.trim() || null,
      lines: form.lines
        .filter((l) => l.serviceId)
        .map((l) => ({
          serviceId: l.serviceId,
          serviceProviderId: l.serviceProviderId || null,
          providerPayment: l.providerPayment.trim() === "" ? null : Number(l.providerPayment),
        })),
    };
  }

  async function save() {
    setFormError(null);
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, ...buildPayload() });
        toast.success("Promo actualizada");
      } else {
        await create.mutateAsync(buildPayload());
        toast.success("Promo creada");
      }
      setDrawerOpen(false);
    } catch (e) {
      setFormError((e as Error).message);
    }
  }

  const saving = create.isPending || update.isPending;

  return (
    <>
      <ResourceManager<PromotionAdmin>
        title="Promo"
        rows={rows}
        columns={columns}
        loading={isLoading}
        error={error ? (error as Error).message : null}
        rowKey={(p) => p.id}
        isArchived={(p) => p.status === "inactive"}
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Buscar por nombre…"
        showArchived={showArchived}
        onToggleArchived={setShowArchived}
        canCreate={isAdmin}
        canArchive={isAdmin}
        onAdd={openCreate}
        onEdit={isStaff ? openEdit : undefined}
        archiving={archive.isPending}
        archiveName={(p) => p.name ?? "esta promo"}
        onArchive={(p) =>
          archive.mutate(p.id, {
            onSuccess: () => toast.success("Promo archivada"),
            onError: (e: Error) => toast.error(e.message),
          })
        }
        onRestore={(p) =>
          restore.mutate(p.id, {
            onSuccess: () => toast.success("Promo restaurada"),
            onError: (e: Error) => toast.error(e.message),
          })
        }
      />

      <EntityDrawer
        open={drawerOpen}
        title={editing ? "Editar promo" : "Nueva promo"}
        error={formError}
        busy={saving}
        canSubmit={form.name.trim().length >= 1}
        onSubmit={save}
        onClose={() => setDrawerOpen(false)}
      >
        <Field label="Nombre *">
          <TextInput
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            autoFocus
          />
        </Field>
        <Field label="Descripción">
          <TextArea
            rows={2}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </Field>

        <div className="flex gap-3">
          <Field
            label="Tipo de descuento"
            help="Porcentaje aplica un % sobre el subtotal de los servicios. Monto fijo resta un valor en pesos. El total se congela al guardar."
          >
            <Select
              value={form.promotionType}
              onChange={(e) =>
                setForm({ ...form, promotionType: e.target.value as Form["promotionType"] })
              }
            >
              <option value="">Sin descuento</option>
              <option value="percentage">Porcentaje (%)</option>
              <option value="fixed_amount">Monto fijo ($)</option>
            </Select>
          </Field>
          <Field label={form.promotionType === "percentage" ? "Porcentaje" : "Monto"}>
            <TextInput
              inputMode="numeric"
              value={form.discountValue}
              disabled={form.promotionType === ""}
              onChange={(e) => setForm({ ...form, discountValue: e.target.value })}
              placeholder={form.promotionType === "percentage" ? "20" : "5000"}
            />
          </Field>
        </div>

        <div className="flex gap-3">
          <Field label="Válida desde">
            <TextInput
              type="date"
              value={form.validFrom}
              onChange={(e) => setForm({ ...form, validFrom: e.target.value })}
            />
          </Field>
          <Field label="Válida hasta">
            <TextInput
              type="date"
              value={form.validUntil}
              onChange={(e) => setForm({ ...form, validUntil: e.target.value })}
            />
          </Field>
        </div>

        <div className="flex gap-3">
          <Field label="Límite de usos">
            <TextInput
              inputMode="numeric"
              value={form.usageLimit}
              onChange={(e) => setForm({ ...form, usageLimit: e.target.value })}
              placeholder="Sin límite"
            />
          </Field>
          <label className="flex items-center gap-2 self-end pb-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={form.isFeatured}
              onChange={(e) => setForm({ ...form, isFeatured: e.target.checked })}
              className="h-4 w-4 accent-[var(--color-primary)]"
            />
            Destacada en la web
          </label>
        </div>

        {/* Servicios de la promo: cada uno con su proveedora y lo que se le paga */}
        <div className="space-y-3 rounded-xl border border-surface-high p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">
            Servicios incluidos
          </p>
          {form.lines.length === 0 ? (
            <p className="text-sm text-ink-soft">Sin servicios. Agregá al menos uno.</p>
          ) : (
            <ul className="space-y-2">
              {form.lines.map((l, i) => (
                <LineRow
                  key={i}
                  line={l}
                  services={services}
                  onChange={(nl) =>
                    setForm({ ...form, lines: form.lines.map((x, idx) => (idx === i ? nl : x)) })
                  }
                  onRemove={() =>
                    setForm({ ...form, lines: form.lines.filter((_, idx) => idx !== i) })
                  }
                />
              ))}
            </ul>
          )}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setForm({ ...form, lines: [...form.lines, { ...EMPTY_LINE }] })}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-primary-dark"
            >
              <Plus size={15} />
              Agregar servicio
            </button>
          </div>

          {/* Preview del snapshot que se va a frizar al guardar */}
          <div className="flex justify-between border-t border-surface-high pt-2 text-sm">
            <span className="text-ink-soft">Subtotal servicios</span>
            <span className="text-ink">{money(subtotalPreview)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="font-medium text-ink">Total promo</span>
            <span className="font-semibold text-ink">{money(finalPreview)}</span>
          </div>
        </div>
        <Field label="Notas">
          <TextArea
            rows={2}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </Field>
      </EntityDrawer>
    </>
  );
}
