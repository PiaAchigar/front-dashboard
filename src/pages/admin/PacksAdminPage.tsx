import { useMemo, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { can, type Role } from "../../lib/permissions";
import { ResourceManager, type Column } from "../../components/ResourceManager";
import { EntityDrawer } from "../../components/EntityDrawer";
import { Field, Select, TextArea, TextInput } from "../../components/form";
import { useToast } from "../../components/ui/Toast";
import { useAreas } from "../../hooks/useAreas";
import { useContextoDeArea } from "./contexto-de-area";
import { useServices } from "../../hooks/useServices";
import { idDeArea } from "../../lib/areas";
import {
  useArchiveCombo,
  useChequeoDeDuplicados,
  useCombosAdmin,
  useCreateCombo,
  useDeleteCombo,
  useRestoreCombo,
  useGuardarTarifario,
  useTarifarios,
  useUpdateComboAdmin,
  type ComboInput,
} from "../../hooks/useCombosAdmin";
import type { ComboAdmin, TarifarioDeArea } from "../../lib/api-types";

const money = (n: number | null | undefined) =>
  n == null ? "—" : `$${n.toLocaleString("es-AR")}`;

/**
 * El tarifario de packs del área, editable en el lugar.
 *
 * Va acá y no en Configuración por el mismo criterio que depilación, que edita
 * sus precios en `/admin/depilacion/precios`: la política se toca cuando estás
 * mirando los packs, no en una pantalla lejos.
 *
 * Cambiarla NO toca los packs con descuento propio ni lo ya vendido: la compra
 * congela su total. Sí cambia el precio que muestran los packs que la siguen, y
 * por eso el hook invalida la lista al guardar.
 */
function TarifarioDelArea({
  areaCategoryId,
  tarifario,
  puedeEditar,
}: {
  /** `null`/`undefined` mientras no se sepa el área: sin ella no se guarda. */
  areaCategoryId: string | null | undefined;
  tarifario: TarifarioDeArea | null;
  puedeEditar: boolean;
}) {
  const toast = useToast();
  const guardar = useGuardarTarifario();
  const [abierto, setAbierto] = useState(false);
  const [sesiones, setSesiones] = useState("");
  const [descuento, setDescuento] = useState("");
  const [redondeo, setRedondeo] = useState("");

  function abrir() {
    setSesiones(String(tarifario?.packSessions ?? 3));
    setDescuento(String(tarifario?.packDiscountPercentage ?? 15));
    setRedondeo(String(tarifario?.packRoundingBase ?? 1000));
    setAbierto(true);
  }

  async function confirmar() {
    if (!areaCategoryId) return;
    try {
      await guardar.mutateAsync({
        areaCategoryId,
        packSessions: Number(sesiones) || 0,
        packDiscountPercentage: Number(descuento) || 0,
        packRoundingBase: Number(redondeo) || 1,
      });
      toast.success("Tarifario actualizado");
      setAbierto(false);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  if (!tarifario && !puedeEditar) return null;

  return (
    <div className="mb-3 rounded-lg border border-surface-high bg-surface-low px-3 py-2 text-sm">
      {abierto ? (
        <div className="space-y-2">
          <p className="font-medium text-ink">Tarifario de packs de esta área</p>
          <div className="flex flex-wrap gap-3">
            <Field label="Veces por defecto">
              <TextInput
                inputMode="numeric"
                value={sesiones}
                onChange={(e) => setSesiones(e.target.value)}
              />
            </Field>
            <Field label="% de descuento">
              <TextInput
                inputMode="numeric"
                value={descuento}
                onChange={(e) => setDescuento(e.target.value)}
              />
            </Field>
            <Field label="Redondeo">
              <TextInput
                inputMode="numeric"
                value={redondeo}
                onChange={(e) => setRedondeo(e.target.value)}
              />
            </Field>
          </div>
          <p className="text-xs text-ink-soft">
            Cambia el precio de los packs que siguen esta política. Los que tienen descuento propio
            y todo lo ya vendido quedan como están.
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setAbierto(false)}
              className="rounded-full px-3 py-1 text-sm text-ink-soft hover:text-ink"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={confirmar}
              disabled={guardar.isPending}
              className="rounded-full bg-primary px-4 py-1 text-sm font-medium text-white transition-colors hover:bg-primary-dark disabled:opacity-60"
            >
              Guardar tarifario
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-ink-soft">
            {tarifario ? (
              <>
                Por defecto, un pack de esta área es de{" "}
                <strong className="text-ink">{tarifario.packSessions} veces</strong> con{" "}
                <strong className="text-ink">{tarifario.packDiscountPercentage}%</strong> de
                descuento, redondeando a {money(tarifario.packRoundingBase)}.
              </>
            ) : (
              "Esta área todavía no tiene tarifario de packs."
            )}
          </p>
          {puedeEditar && (
            <button
              type="button"
              onClick={abrir}
              className="shrink-0 rounded-full border border-surface-high px-3 py-1 text-sm text-ink transition-colors hover:border-primary/40 hover:text-primary"
            >
              {tarifario ? "Cambiar" : "Cargar"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** Qué repite el pack. Son excluyentes: o un combo, o un servicio suelto. */
type Repite = "combo" | "servicio";

type Form = {
  name: string;
  description: string;
  repite: Repite;
  /** El combo que repite, si `repite === "combo"`. */
  comboId: string;
  /** El servicio que repite, si `repite === "servicio"`. */
  serviceId: string;
  packSessions: string;
  /** Vacío = usa el descuento del área. */
  descuentoPropio: string;
  redondeoPropio: string;
  validityMonths: string;
  isVisibleWeb: boolean;
  displayOrder: string;
};

const EMPTY: Form = {
  name: "",
  description: "",
  repite: "combo",
  comboId: "",
  serviceId: "",
  packSessions: "",
  descuentoPropio: "",
  redondeoPropio: "",
  validityMonths: "12",
  isVisibleWeb: true,
  displayOrder: "0",
};

/**
 * Los packs de un área: repetir algo N veces con descuento.
 *
 * Es una pantalla aparte de Combos y no una variante de la misma porque las dos
 * preguntan cosas distintas. Un combo pregunta *qué entra*; un pack pregunta
 * *qué se repite y cuántas veces*. Meterlas en un formulario con ramas dejaba
 * la mitad de los campos apagados en cada caso.
 *
 * El precio NO se carga a mano: sale de repetir lo que el pack apunta y
 * aplicarle el descuento —el propio si lo tiene, el del área si no—. Por eso
 * `priceType` va siempre en 'percentage' con 0: el descuento del pack es el que
 * manda, y dejar además un descuento de combo daría dos rebajas encadenadas.
 */
export function PacksAdminPage({ area }: { area?: string } = {}) {
  const { role } = useAuth();
  const r = role as Role | null;
  const canEdit = can(r, "catalogo", "edit");
  const canManage = can(r, "catalogo", "manage");
  const toast = useToast();

  const contextoDeArea = useContextoDeArea();
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<ComboAdmin | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [formError, setFormError] = useState<string | null>(null);
  const [duplicados, setDuplicados] = useState<{ id: string; name: string }[]>([]);

  const { data: areas = [] } = useAreas();
  const areaCategoryId = area ? idDeArea(areas, area) : undefined;

  const {
    data: packs = [],
    isLoading,
    error,
  } = useCombosAdmin(showArchived, { areaCategoryId, kind: "pack" });
  // Los combos del área, que son lo que un pack puede repetir. Sólo los
  // activos: armar un pack de un combo archivado lo rechaza el backend.
  const { data: combosDelArea = [] } = useCombosAdmin(false, { areaCategoryId, kind: "combo" });
  const { data: services = [] } = useServices();
  const { data: tarifarios = [] } = useTarifarios();

  const tarifario = tarifarios.find((t) => t.areaCategoryId === areaCategoryId) ?? null;

  const create = useCreateCombo();
  const update = useUpdateComboAdmin();
  const archive = useArchiveCombo();
  const restore = useRestoreCombo();
  const hardDelete = useDeleteCombo();
  const chequearDuplicados = useChequeoDeDuplicados();

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return packs;
    return packs.filter((p) => (p.name ?? "").toLowerCase().includes(q));
  }, [packs, search]);

  const nombreDelCombo = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of combosDelArea) m.set(c.id, c.name ?? "—");
    return m;
  }, [combosDelArea]);

  const columns: Column<ComboAdmin>[] = [
    {
      key: "name",
      header: "Pack",
      width: 220,
      render: (p) => <span className="font-medium text-ink">{p.name ?? "—"}</span>,
    },
    {
      key: "repite",
      header: "Repite",
      width: 200,
      render: (p) => (
        <span className="text-ink-soft">
          {p.packOfComboId
            ? (nombreDelCombo.get(p.packOfComboId) ?? "un combo")
            : p.lines.map((l) => l.serviceName ?? "—").join(" + ") || "—"}
        </span>
      ),
    },
    {
      key: "veces",
      header: "Veces",
      width: 80,
      render: (p) => <span className="text-ink-soft">{p.packSessions ?? "—"}</span>,
    },
    {
      key: "unitario",
      header: "Por unidad",
      width: 120,
      render: (p) => <span className="text-ink-soft">{money(p.packUnitAmount)}</span>,
    },
    {
      key: "descuento",
      header: "Descuento",
      width: 130,
      render: (p) =>
        p.packEffectiveDiscount == null ? (
          <span className="text-ink-soft">—</span>
        ) : (
          <span className="text-ink-soft">
            {p.packEffectiveDiscount}%
            {p.packDiscountSource === "area" && (
              <span className="ml-1 text-xs text-ink-soft/70">(del área)</span>
            )}
          </span>
        ),
    },
    {
      key: "final",
      header: "Precio del pack",
      width: 140,
      render: (p) => <span className="font-medium text-ink">{money(p.finalAmount)}</span>,
    },
  ];

  function openCreate() {
    setEditing(null);
    setForm({
      ...EMPTY,
      // Arranca con las veces que dice el tarifario del área: es lo más común,
      // y quien quiera otra cosa lo cambia.
      packSessions: tarifario ? String(tarifario.packSessions) : "",
    });
    setFormError(null);
    setDuplicados([]);
    setDrawerOpen(true);
  }

  function openEdit(p: ComboAdmin) {
    setEditing(p);
    setForm({
      name: p.name ?? "",
      description: p.description ?? "",
      repite: p.packOfComboId ? "combo" : "servicio",
      comboId: p.packOfComboId ?? "",
      serviceId: p.lines[0]?.serviceId ?? "",
      packSessions: p.packSessions != null ? String(p.packSessions) : "",
      descuentoPropio: p.packDiscountPercentage != null ? String(p.packDiscountPercentage) : "",
      redondeoPropio: p.packRoundingBase != null ? String(p.packRoundingBase) : "",
      validityMonths: p.validityMonths != null ? String(p.validityMonths) : "12",
      isVisibleWeb: p.isVisibleWeb ?? true,
      displayOrder: p.displayOrder != null ? String(p.displayOrder) : "0",
    });
    setFormError(null);
    setDuplicados([]);
    setDrawerOpen(true);
  }

  /** El descuento propio va de a dos o ninguno, igual que en la base. */
  const tieneDescuentoPropio =
    form.descuentoPropio.trim() !== "" || form.redondeoPropio.trim() !== "";

  function buildPayload(): ComboInput {
    return {
      name: form.name.trim(),
      description: form.description.trim() || null,
      // El precio del pack sale de repetir lo que apunta; el descuento de
      // combo se deja en cero para no encadenar dos rebajas.
      priceType: "percentage",
      discountPercentage: 0,
      fixedPrice: null,
      validityMonths: Number(form.validityMonths) || 0,
      isVisibleWeb: form.isVisibleWeb,
      displayOrder: Number(form.displayOrder) || 0,
      areaCategoryId: areaCategoryId ?? "",
      kind: "pack",
      packOfComboId: form.repite === "combo" ? form.comboId || null : null,
      packSessions: Number(form.packSessions) || null,
      packDiscountPercentage: tieneDescuentoPropio ? Number(form.descuentoPropio) || 0 : null,
      packRoundingBase: tieneDescuentoPropio ? Number(form.redondeoPropio) || 1 : null,
      // Un pack de un combo no lleva renglones propios; uno de un servicio
      // suelto lleva exactamente uno.
      lines: form.repite === "servicio" && form.serviceId ? [{ serviceId: form.serviceId }] : [],
    };
  }

  async function save() {
    setFormError(null);
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, ...buildPayload() });
        toast.success("Pack actualizado");
      } else {
        if (duplicados.length === 0) {
          const res = await chequearDuplicados.mutateAsync(buildPayload());
          if (res.duplicados.length > 0) {
            setDuplicados(res.duplicados);
            return;
          }
        }
        await create.mutateAsync(buildPayload());
        toast.success("Pack creado");
      }
      setDrawerOpen(false);
    } catch (e) {
      setFormError((e as Error).message);
    }
  }

  const saving = create.isPending || update.isPending || chequearDuplicados.isPending;
  const eligioQueRepetir =
    form.repite === "combo" ? !!form.comboId : !!form.serviceId;
  const puedeGuardar =
    form.name.trim().length >= 1 &&
    !!areaCategoryId &&
    eligioQueRepetir &&
    Number(form.packSessions) >= 2 &&
    Number(form.validityMonths) >= 1;

  return (
    <>
      <ResourceManager<ComboAdmin>
        title="Pack"
        avisoSuperior={
          <TarifarioDelArea
            areaCategoryId={areaCategoryId}
            tarifario={tarifario}
            puedeEditar={canManage}
          />
        }
        slotAcciones={contextoDeArea?.slotAcciones ?? null}
        alturaLibre={!!contextoDeArea}
        rows={rows}
        columns={columns}
        loading={isLoading}
        error={error ? (error as Error).message : null}
        rowKey={(p) => p.id}
        isArchived={(p) => p.isActive === false}
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
        archiveName={(p) => p.name ?? "este pack"}
        hardDeleteName={(p) => p.name ?? "este pack"}
        onArchive={(p) =>
          archive.mutate(p.id, {
            onSuccess: () => toast.success("Pack archivado"),
            onError: (e: Error) => toast.error(e.message),
          })
        }
        onRestore={(p) =>
          restore.mutate(p.id, {
            onSuccess: () => toast.success("Pack restaurado"),
            onError: (e: Error) => toast.error(e.message),
          })
        }
        onHardDeletePreview={async () => ({ blocked: false, cascade: {} })}
        onHardDelete={(p) =>
          hardDelete.mutate(p.id, {
            onSuccess: () => toast.success("Pack eliminado definitivamente"),
            onError: (e: Error) => toast.error(e.message),
          })
        }
      />

      <EntityDrawer
        open={drawerOpen}
        title={editing ? "Editar pack" : `Nuevo pack${area ? ` — ${area}` : ""}`}
        error={formError}
        busy={saving}
        canSubmit={puedeGuardar}
        onSubmit={save}
        onClose={() => setDrawerOpen(false)}
      >
        {duplicados.length > 0 && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <p className="font-medium">Ya existe un pack igual —lo mismo, repetido las mismas veces:</p>
            <ul className="mt-1 list-inside list-disc">
              {duplicados.map((d) => (
                <li key={d.id}>{d.name}</li>
              ))}
            </ul>
            <p className="mt-1.5">Si igual querés crearlo, volvé a apretar Guardar.</p>
          </div>
        )}

        {editing && (
          <p className="rounded-lg border border-surface-high bg-surface-low px-3 py-2 text-sm text-ink-soft">
            De un pack guardado se edita el <strong>descuento</strong> y cómo se muestra. Qué
            repite y cuántas veces no se cambian: sería otro pack, y las compras viejas quedarían
            apuntando a algo que no es lo que se vendió.
          </p>
        )}

        <Field label="Nombre *" help='Como lo va a ver la vendedora. Por ejemplo "Combo Facial × 4".'>
          <TextInput
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            autoFocus
          />
        </Field>
        <Field label="Descripción">
          <TextArea
            rows={3}
            className="resize-y"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </Field>

        <div className="space-y-3 rounded-xl border border-surface-high p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">Qué repite</p>

          <Field label="Repite *">
            <Select
              value={form.repite}
              disabled={!!editing}
              onChange={(e) =>
                setForm({ ...form, repite: e.target.value as Repite, comboId: "", serviceId: "" })
              }
            >
              <option value="combo">Un combo</option>
              <option value="servicio">Un servicio suelto</option>
            </Select>
          </Field>

          {form.repite === "combo" ? (
            <Field
              label="Combo *"
              help={
                combosDelArea.length === 0
                  ? "Todavía no hay combos en esta área. Armá uno en la solapa Combos."
                  : undefined
              }
            >
              <Select
                value={form.comboId}
                disabled={!!editing}
                onChange={(e) => setForm({ ...form, comboId: e.target.value })}
              >
                <option value="">Elegí un combo…</option>
                {combosDelArea.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name ?? "—"} · {money(c.finalAmount)}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <Field label="Servicio *">
              <Select
                value={form.serviceId}
                disabled={!!editing}
                onChange={(e) => setForm({ ...form, serviceId: e.target.value })}
              >
                <option value="">Elegí un servicio…</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name ?? "—"}
                  </option>
                ))}
              </Select>
            </Field>
          )}

          <Field label="Cuántas veces *" help="Al menos 2: repetir una vez es el combo.">
            <TextInput
              inputMode="numeric"
              value={form.packSessions}
              disabled={!!editing}
              onChange={(e) => setForm({ ...form, packSessions: e.target.value })}
              placeholder="4"
            />
          </Field>
        </div>

        <div className="space-y-3 rounded-xl border border-surface-high p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">Descuento</p>
          {tarifario ? (
            <p className="text-sm text-ink-soft">
              Sin cargar nada, este pack usa el descuento del área:{" "}
              <strong className="text-ink">{tarifario.packDiscountPercentage}%</strong>, redondeando
              a {money(tarifario.packRoundingBase)}.
            </p>
          ) : (
            <p className="text-sm text-amber-700">
              Esta área todavía no tiene tarifario de packs. Cargá un descuento propio.
            </p>
          )}
          <div className="flex gap-3">
            <Field label="% propio" help="Vacío = el del área.">
              <TextInput
                inputMode="numeric"
                value={form.descuentoPropio}
                onChange={(e) => setForm({ ...form, descuentoPropio: e.target.value })}
                placeholder={tarifario ? String(tarifario.packDiscountPercentage) : "15"}
              />
            </Field>
            <Field label="Redondeo propio" help="A cuánto redondea el precio final.">
              <TextInput
                inputMode="numeric"
                value={form.redondeoPropio}
                onChange={(e) => setForm({ ...form, redondeoPropio: e.target.value })}
                placeholder={tarifario ? String(tarifario.packRoundingBase) : "1000"}
              />
            </Field>
          </div>
          {tieneDescuentoPropio &&
            (form.descuentoPropio.trim() === "" || form.redondeoPropio.trim() === "") && (
              <p className="text-xs text-amber-700">
                Cargá los dos o ninguno: con uno solo no hay precio que calcular.
              </p>
            )}
        </div>

        <div className="flex gap-3">
          <Field
            label="Vigencia (meses) *"
            help="Cuántos meses tiene la clienta para usar las sesiones, desde que compra."
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
      </EntityDrawer>
    </>
  );
}
