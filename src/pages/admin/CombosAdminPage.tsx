import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { can, type Role } from "../../lib/permissions";
import { ResourceManager, type Column } from "../../components/ResourceManager";
import { EntityDrawer } from "../../components/EntityDrawer";
import { Field, Select, TextArea, TextInput } from "../../components/form";
import { Plus, Trash } from "../../components/icons";
import { useToast } from "../../components/ui/Toast";
import { useServices } from "../../hooks/useServices";
import { computeComboFinalPrice, computeComboSubtotal } from "../../lib/combo-pricing";
import {
  useArchiveCombo,
  useChequeoDeDuplicados,
  useCombosAdmin,
  useCreateCombo,
  useDeleteCombo,
  useRestoreCombo,
  useUpdateComboAdmin,
  type ComboInput,
} from "../../hooks/useCombosAdmin";
import { useAreas } from "../../hooks/useAreas";
import { idDeArea } from "../../lib/areas";
import type { ComboAdmin } from "../../lib/api-types";

const money = (n: number | null | undefined) =>
  n == null ? "—" : `$${n.toLocaleString("es-AR")}`;

/** Línea en edición: todo string, porque son inputs controlados. */
type DraftLine = {
  serviceId: string;
  /** Sólo lectura desde la 1.50.0: el formulario ya no lo edita (spec §4.3).
   *  Se conserva para poder mostrar lo que traiga un combo viejo. */
  sessionsIncluded: string;
  /**
   * Nombre del servicio tal como vino del combo guardado. Sólo se usa para
   * identificar la fila cuando ese servicio ya se archivó y por lo tanto no
   * aparece entre las opciones del <Select> (que solo lista activos): sin
   * esto la fila queda muda y la usuaria no sabe qué está reemplazando.
   */
  serviceName: string | null;
  /**
   * Precio del servicio tal como vino del combo guardado (congelado al
   * cargarlo). `useServices()` sólo trae servicios activos: si esta línea
   * quedó archivada, no aparece ahí y el precio "en vivo" da $0, lo que
   * arruina el subtotal del preview y dispara el cartel de "sale más caro"
   * aunque nada haya cambiado. Este valor es el respaldo para ese caso.
   */
  servicePrice: number | null;
};

type Form = {
  name: string;
  description: string;
  priceType: "fixed" | "percentage";
  priceValue: string;
  validityMonths: string;
  isVisibleWeb: boolean;
  displayOrder: string;
  /** §4.4 — los servicios se hacen en la misma visita. */
  servicesTogether: boolean;
  lines: DraftLine[];
};

const EMPTY: Form = {
  name: "",
  description: "",
  priceType: "fixed",
  priceValue: "",
  validityMonths: "12",
  isVisibleWeb: true,
  displayOrder: "0",
  // Desmarcado por decisión de Pia (2026-09-10): ante un descuido de quien
  // carga, que quede la opción MÁS libre de agendar. Al revés bloquearía
  // turnos que sí se podían dar.
  servicesTogether: false,
  lines: [],
};

const EMPTY_LINE: DraftLine = {
  serviceId: "",
  sessionsIncluded: "",
  serviceName: null,
  servicePrice: null,
};

/** Una fila del combo: servicio + cuántas sesiones de ese servicio incluye. */
function LineRow({
  line,
  services,
  precio,
  bloqueado,
  onChange,
  onRemove,
}: {
  line: DraftLine;
  services: { id: string; name: string | null }[];
  precio: number;
  /** La composición de un combo guardado no se edita (spec §4.2). */
  bloqueado: boolean;
  onChange: (l: DraftLine) => void;
  onRemove: () => void;
}) {
  // El <Select> sólo lista servicios activos. Si esta línea trae un
  // serviceId que ya no está entre ellos, es porque el servicio se archivó
  // — usamos el nombre guardado para que la fila diga a quién hay que
  // reemplazar en vez de aparecer vacía.
  const isArchivedSelection =
    !!line.serviceId && !services.some((s) => s.id === line.serviceId);

  return (
    <li className="space-y-2 rounded-lg border border-surface-high bg-white p-2.5">
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <Field label="Servicio">
            {isArchivedSelection && (
              <p className="mb-1.5 rounded bg-amber-50 px-2 py-1 text-xs text-amber-800">
                Servicio archivado: <strong>{line.serviceName ?? "sin nombre guardado"}</strong>.
                Elegí un reemplazo.
              </p>
            )}
            <Select
              value={line.serviceId}
              disabled={bloqueado}
              onChange={(e) =>
                onChange({ ...line, serviceId: e.target.value, serviceName: null })
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
        {!bloqueado && (
          <button
            type="button"
            onClick={onRemove}
            title="Quitar servicio"
            className="mt-6 shrink-0 rounded p-1.5 text-ink-soft transition-colors hover:bg-surface-high hover:text-red-700"
          >
            <Trash size={15} />
          </button>
        )}
      </div>
      {/* El campo "sesiones" se sacó en la 1.50.0 (spec §4.3): un combo es UNA
          sesión de cada servicio. Repetir es trabajo de un pack, y tener dos
          formas de armar lo mismo hacía imposible explicar por qué algo
          aparecía en una solapa y no en la otra. */}
      <p className="text-sm text-ink-soft">{precio > 0 ? money(precio) : "—"}</p>
    </li>
  );
}

/**
 * Cartel informativo (no bloqueante) arriba del listado: un combo no crea
 * servicios nuevos, solo combina los que ya están cargados. Si el servicio
 * que se busca no existe todavía, no va a aparecer en el selector de líneas
 * más abajo — este aviso explica por qué antes de que la usuaria llegue a
 * ese punto y se quede sin entender.
 */
function ComboDependenciaAviso() {
  return (
    <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
      Un combo se arma con servicios y actividades que ya estén cargados. Si falta alguno,
      cargalo primero en{" "}
      <Link to="/admin/servicios" className="font-medium underline underline-offset-2">
        Servicios
      </Link>
      .
    </div>
  );
}

/**
 * Los combos de un área.
 *
 * `area` es el NOMBRE de la categoría ("Estética"), igual que en
 * `ServiciosAdminPage`, porque es lo que sabe la ruta. La traducción a id la
 * hace `idDeArea`.
 */
export function CombosAdminPage({ area }: { area?: string } = {}) {
  const { role } = useAuth();
  const r = role as Role | null;
  const canEdit = can(r, "catalogo", "edit");
  const canManage = can(r, "catalogo", "manage");
  const toast = useToast();

  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<ComboAdmin | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: areas = [] } = useAreas();
  const areaCategoryId = idDeArea(areas, area);
  const {
    data: combos = [],
    isLoading,
    error,
  } = useCombosAdmin(showArchived, { areaCategoryId, kind: "combo" });
  const { data: services = [] } = useServices();
  const chequearDuplicados = useChequeoDeDuplicados();
  const [duplicados, setDuplicados] = useState<{ id: string; name: string }[]>([]);
  const create = useCreateCombo();
  const update = useUpdateComboAdmin();
  const archive = useArchiveCombo();
  const restore = useRestoreCombo();
  const hardDelete = useDeleteCombo();

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return combos;
    return combos.filter((c) => (c.name ?? "").toLowerCase().includes(q));
  }, [combos, search]);

  const priceById = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of services) m.set(s.id, s.unitPriceList ?? 0);
    return m;
  }, [services]);

  // Precio a usar en el preview: el "en vivo" de useServices() si el servicio
  // sigue activo, y si no, el que trajo el combo guardado (servicePrice de la
  // línea) — evita que un servicio archivado valga $0 en el preview.
  const precioPreview = (l: DraftLine) => priceById.get(l.serviceId) ?? l.servicePrice ?? 0;

  // Preview en vivo: mismo cálculo que combo-pricing.ts del backend.
  // Una sesión de cada servicio (spec §4.3): el subtotal es la suma de los
  // precios, sin multiplicar por nada.
  const subtotalPreview = computeComboSubtotal(
    form.lines.map((l) => ({ servicePrice: precioPreview(l), sessionsIncluded: 1 })),
  );
  const priceValue = form.priceValue.trim() === "" ? null : Number(form.priceValue);
  const finalPreview = computeComboFinalPrice(
    subtotalPreview,
    form.priceType,
    form.priceType === "fixed" ? priceValue : null,
    form.priceType === "percentage" ? priceValue : null,
  );

  const columns: Column<ComboAdmin>[] = [
    {
      key: "name",
      header: "Combo",
      width: 240,
      render: (c) => (
        <div>
          <span className="font-medium text-ink">{c.name ?? "—"}</span>
          {c.hasInactiveService && (
            <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
              No se publica: tiene un servicio archivado
            </span>
          )}
        </div>
      ),
    },
    {
      key: "servicios",
      header: "Servicios",
      width: 90,
      render: (c) => <span className="text-ink-soft">{c.lines.length}</span>,
    },
    {
      key: "juntos",
      header: "Se hacen",
      width: 130,
      render: (c) =>
        c.lines.length < 2 ? (
          <span className="text-ink-soft">—</span>
        ) : c.servicesTogether ? (
          <span
            className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary-dark"
            title="Hay que agendarlos el mismo día"
          >
            Juntos
          </span>
        ) : (
          <span className="text-xs text-ink-soft">Por separado</span>
        ),
    },
    {
      key: "subtotal",
      header: "Subtotal",
      width: 120,
      render: (c) => <span className="text-ink-soft">{money(c.servicesSubtotal)}</span>,
    },
    {
      key: "final",
      header: "Precio combo",
      width: 130,
      render: (c) => <span className="font-medium text-ink">{money(c.finalAmount)}</span>,
    },
    {
      key: "vigencia",
      header: "Vigencia",
      width: 100,
      render: (c) => (
        <span className="text-ink-soft">
          {c.validityMonths != null ? `${c.validityMonths} meses` : "—"}
        </span>
      ),
    },
    {
      key: "web",
      header: "En la web",
      width: 100,
      render: (c) =>
        c.isVisibleWeb ? (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary-dark">
            Visible
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
    setDuplicados([]);
    setDrawerOpen(true);
  }

  function openEdit(c: ComboAdmin) {
    setEditing(c);
    setForm({
      name: c.name ?? "",
      description: c.description ?? "",
      priceType: (c.priceType as Form["priceType"]) ?? "fixed",
      priceValue:
        c.priceType === "fixed"
          ? String(c.fixedPrice ?? "")
          : String(c.discountPercentage ?? ""),
      validityMonths: c.validityMonths != null ? String(c.validityMonths) : "12",
      isVisibleWeb: c.isVisibleWeb ?? true,
      displayOrder: c.displayOrder != null ? String(c.displayOrder) : "0",
      servicesTogether: c.servicesTogether,
      lines: c.lines.map((l) => ({
        serviceId: l.serviceId ?? "",
        sessionsIncluded: l.sessionsIncluded != null ? String(l.sessionsIncluded) : "",
        serviceName: l.serviceName ?? null,
        servicePrice: l.servicePrice ?? null,
      })),
    });
    setFormError(null);
    setDuplicados([]);
    setDrawerOpen(true);
  }

  function buildPayload(): ComboInput {
    const value = form.priceValue.trim() === "" ? null : Number(form.priceValue);
    return {
      name: form.name.trim(),
      description: form.description.trim() || null,
      priceType: form.priceType,
      fixedPrice: form.priceType === "fixed" ? value : null,
      discountPercentage: form.priceType === "percentage" ? value : null,
      validityMonths: Number(form.validityMonths) || 0,
      isVisibleWeb: form.isVisibleWeb,
      displayOrder: Number(form.displayOrder) || 0,
      areaCategoryId: areaCategoryId ?? "",
      kind: "combo",
      // "Se hacen juntos" con un solo servicio no significa nada, y el backend
      // lo rechaza: no se manda.
      servicesTogether: form.lines.length >= 2 ? form.servicesTogether : false,
      // Sin `sessionsIncluded`: el backend lo pone en 1 (spec §4.3).
      lines: form.lines.filter((l) => l.serviceId).map((l) => ({ serviceId: l.serviceId })),
    };
  }

  /**
   * Guarda, avisando primero si ya existe uno igual.
   *
   * El aviso corta el primer intento y muestra qué encontró; el segundo click
   * guarda igual. Es un aviso, no un candado: Pia pidió *"que el sistema le
   * avise"*, no que le prohíba. Bloquear obligaría a adivinar los casos
   * legítimos que todavía no aparecieron.
   *
   * Sólo al crear: editar un combo guardado no cambia su composición, así que
   * no puede volverse duplicado de nada.
   */
  async function save() {
    setFormError(null);
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, ...buildPayload() });
        toast.success("Combo actualizado");
      } else {
        if (duplicados.length === 0) {
          const r = await chequearDuplicados.mutateAsync(buildPayload());
          if (r.duplicados.length > 0) {
            setDuplicados(r.duplicados);
            return;
          }
        }
        await create.mutateAsync(buildPayload());
        toast.success("Combo creado");
      }
      setDrawerOpen(false);
    } catch (e) {
      setFormError((e as Error).message);
    }
  }

  const saving = create.isPending || update.isPending || chequearDuplicados.isPending;
  // El botón se habilita sólo si el combo puede existir: nombre, al menos un
  // servicio, un área y el precio que su tipo exige.
  const lineasValidas = form.lines.filter((l) => l.serviceId).length;
  const puedeGuardar =
    form.name.trim().length >= 1 &&
    lineasValidas >= 1 &&
    !!areaCategoryId &&
    form.priceValue.trim() !== "" &&
    Number(form.validityMonths) >= 1;

  return (
    <>
      <ResourceManager<ComboAdmin>
        title="Combo"
        avisoSuperior={<ComboDependenciaAviso />}
        rows={rows}
        columns={columns}
        loading={isLoading}
        error={error ? (error as Error).message : null}
        rowKey={(c) => c.id}
        isArchived={(c) => c.isActive === false}
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Buscar por nombre…"
        showArchived={showArchived}
        onToggleArchived={setShowArchived}
        canCreate={canManage}
        canArchive={canManage}
        canHardDelete={canManage}
        onAdd={openCreate}
        onEdit={canEdit ? openEdit : undefined}
        archiving={archive.isPending}
        archiveName={(c) => c.name ?? "este combo"}
        hardDeleteName={(c) => c.name ?? "este combo"}
        onArchive={(c) =>
          archive.mutate(c.id, {
            onSuccess: () => toast.success("Combo archivado"),
            onError: (e: Error) => toast.error(e.message),
          })
        }
        onRestore={(c) =>
          restore.mutate(c.id, {
            onSuccess: () => toast.success("Combo restaurado"),
            onError: (e: Error) => toast.error(e.message),
          })
        }
        onHardDeletePreview={async () => ({ blocked: false, cascade: {} })}
        onHardDelete={(c) =>
          hardDelete.mutate(c.id, {
            onSuccess: () => toast.success("Combo eliminado definitivamente"),
            onError: (e: Error) => toast.error(e.message),
          })
        }
      />

      <EntityDrawer
        open={drawerOpen}
        title={editing ? "Editar combo" : `Nuevo combo${area ? ` — ${area}` : ""}`}
        error={formError}
        busy={saving}
        canSubmit={puedeGuardar}
        onSubmit={save}
        onClose={() => setDrawerOpen(false)}
      >
        {duplicados.length > 0 && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <p className="font-medium">
              {duplicados.length === 1
                ? "Ya existe un combo con estos mismos servicios:"
                : "Ya existen combos con estos mismos servicios:"}
            </p>
            <ul className="mt-1 list-inside list-disc">
              {duplicados.map((d) => (
                <li key={d.id}>{d.name}</li>
              ))}
            </ul>
            <p className="mt-1.5">
              Si igual querés crearlo, volvé a apretar Guardar. Ojo que dos combos iguales con
              precios distintos son un problema en el mostrador.
            </p>
          </div>
        )}

        {editing && (
          <p className="rounded-lg border border-surface-high bg-surface-low px-3 py-2 text-sm text-ink-soft">
            De un combo guardado se edita el <strong>precio</strong> y cómo se muestra. Los
            servicios que lo forman no se cambian: sería otro combo, y las compras viejas
            quedarían apuntando a algo que no es lo que se vendió. Si está mal cargado, borralo y
            armalo de nuevo.
          </p>
        )}

        <Field label="Nombre *">
          <TextInput
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            autoFocus
          />
        </Field>
        <Field label="Descripción">
          <TextArea
            rows={4}
            className="resize-y"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </Field>

        <div className="flex gap-3">
          <Field
            label="Tipo de precio *"
            help="Precio fijo: el combo cuesta ese monto. Porcentaje: se descuenta ese % del subtotal de los servicios."
          >
            <Select
              value={form.priceType}
              onChange={(e) =>
                setForm({ ...form, priceType: e.target.value as Form["priceType"], priceValue: "" })
              }
            >
              <option value="fixed">Precio fijo ($)</option>
              <option value="percentage">% de descuento</option>
            </Select>
          </Field>
          <Field label={form.priceType === "fixed" ? "Precio del combo *" : "Porcentaje *"}>
            <TextInput
              inputMode="numeric"
              value={form.priceValue}
              onChange={(e) => setForm({ ...form, priceValue: e.target.value })}
              placeholder={form.priceType === "fixed" ? "120000" : "20"}
            />
          </Field>
        </div>

        <div className="flex gap-3">
          <Field
            label="Vigencia (meses) *"
            help="Cuántos meses tiene la clienta para usar las sesiones, contados desde el día que compra el combo."
          >
            <TextInput
              inputMode="numeric"
              value={form.validityMonths}
              onChange={(e) => setForm({ ...form, validityMonths: e.target.value })}
              placeholder="12"
            />
          </Field>
          <Field label="Orden en la web">
            <TextInput
              inputMode="numeric"
              value={form.displayOrder}
              onChange={(e) => setForm({ ...form, displayOrder: e.target.value })}
              placeholder="0"
            />
          </Field>
          <label className="flex items-center gap-2 self-end pb-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={form.isVisibleWeb}
              onChange={(e) => setForm({ ...form, isVisibleWeb: e.target.checked })}
              className="h-4 w-4 accent-[var(--color-primary)]"
            />
            Mostrar en la web
          </label>
        </div>

        {/* Servicios del combo: cada uno con su propia cantidad de sesiones */}
        <div className="space-y-3 rounded-xl border border-surface-high p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">
            Servicios del combo
          </p>
          <p className="text-xs text-ink-soft">Una sesión de cada uno.</p>
          {form.lines.length === 0 ? (
            <p className="text-sm text-ink-soft">Sin servicios. Agregá al menos uno.</p>
          ) : (
            <ul className="space-y-2">
              {form.lines.map((l, i) => (
                <LineRow
                  key={i}
                  line={l}
                  services={services}
                  precio={precioPreview(l)}
                  bloqueado={!!editing}
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
          {!editing && (
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
          )}

          {/* §4.4 — Cómo se consume el combo. Sólo aparece con dos o más
              servicios: con uno solo no hay nada que juntar. */}
          {form.lines.length >= 2 && (
            <div className="rounded-lg border border-surface-high bg-surface-low p-2.5">
              <label className="flex items-start gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={form.servicesTogether}
                  onChange={(e) => setForm({ ...form, servicesTogether: e.target.checked })}
                  className="mt-0.5 h-4 w-4 accent-[var(--color-primary)]"
                />
                <span>
                  <span className="font-medium">Se hacen juntos</span>
                  <span className="mt-0.5 block text-xs text-ink-soft">
                    {form.servicesTogether
                      ? "La clienta viene una sola vez y recibe todo. Hay que agendar los servicios el mismo día — no hace falta que sean seguidos."
                      : "Cada servicio se agenda cuando la clienta quiera, en días distintos si le conviene."}
                  </span>
                </span>
              </label>
            </div>
          )}

          <div className="flex justify-between border-t border-surface-high pt-2 text-sm">
            <span className="text-ink-soft">Subtotal (servicios sueltos)</span>
            <span className="text-ink">{money(subtotalPreview)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="font-medium text-ink">Precio del combo</span>
            <span className="font-semibold text-ink">{money(finalPreview)}</span>
          </div>
          {finalPreview < subtotalPreview && (
            <p className="text-xs text-ink-soft">
              La clienta ahorra {money(subtotalPreview - finalPreview)}.
            </p>
          )}
          {finalPreview > subtotalPreview && (
            <p className="text-xs text-amber-700">
              El combo sale más caro que los servicios sueltos. Revisá el precio.
            </p>
          )}
        </div>
      </EntityDrawer>
    </>
  );
}
