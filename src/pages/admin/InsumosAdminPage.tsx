import { useMemo, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { can, type Role } from "../../lib/permissions";
import { ResourceManager, type Column } from "../../components/ResourceManager";
import { EntityDrawer } from "../../components/EntityDrawer";
import { Checkbox, Field, TextArea, TextInput } from "../../components/form";
import { useToast } from "../../components/ui/Toast";
import { money } from "../../lib/format";
import { etiquetaDeStock, paraReponer, textoDelAviso } from "../../lib/insumos";
import { margenDesdePrecio, precioDesdeMargen } from "../../lib/margen";
import {
  useArchiveInsumo,
  useCreateInsumo,
  useInsumos,
  useRestoreInsumo,
  useUpdateInsumo,
  type Insumo,
} from "../../hooks/useInsumos";

type Form = {
  name: string;
  code: string;
  unitType: string;
  quantityInStock: string;
  minimumStock: string;
  unitCost: string;
  supplierInfo: string;
  description: string;
  seVende: boolean;
  unitPrice: string;
};

const EMPTY: Form = {
  name: "",
  code: "",
  unitType: "",
  quantityInStock: "",
  minimumStock: "",
  unitCost: "",
  supplierInfo: "",
  description: "",
  seVende: false,
  unitPrice: "",
};

const num = (s: string) => (s.trim() === "" ? null : Number(s));

/** Unidades sugeridas. Es un datalist, no un select: si Laura necesita otra, la escribe. */
const UNIDADES = ["unidad", "caja", "ml", "gr", "par", "rollo", "ampolla", "frasco"];

export function InsumosAdminPage() {
  const { role } = useAuth();
  const r = role as Role | null;
  const canEdit = can(r, "catalogo", "edit");
  const canManage = can(r, "catalogo", "manage");
  const toast = useToast();

  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [soloFaltantes, setSoloFaltantes] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Insumo | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [formError, setFormError] = useState<string | null>(null);
  // El margen no se guarda en la base: se deriva de costo y precio. Vive en el
  // formulario porque mientras se escribe puede quedar en un estado que no
  // corresponde todavía a ningún precio ("1", camino a "150").
  const [margen, setMargen] = useState("");

  const { data: insumos = [], isLoading, error } = useInsumos(showArchived);
  const create = useCreateInsumo();
  const update = useUpdateInsumo();
  const archive = useArchiveInsumo();
  const restore = useRestoreInsumo();

  const faltantes = useMemo(() => paraReponer(insumos), [insumos]);
  const aviso = textoDelAviso(insumos);

  const rows = useMemo(() => {
    const base = soloFaltantes ? faltantes : insumos;
    const q = search.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      (i) =>
        (i.name ?? "").toLowerCase().includes(q) ||
        (i.code ?? "").toLowerCase().includes(q) ||
        (i.supplierInfo ?? "").toLowerCase().includes(q),
    );
  }, [insumos, faltantes, soloFaltantes, search]);

  const columns: Column<Insumo>[] = [
    {
      key: "name",
      header: "Insumo",
      width: 240,
      render: (i) => (
        <div>
          <span className="font-medium text-ink">{i.name ?? "—"}</span>
          {i.code && <span className="ml-2 text-xs text-ink-soft">{i.code}</span>}
        </div>
      ),
    },
    {
      key: "stock",
      header: "Stock",
      width: 170,
      render: (i) => {
        const et = etiquetaDeStock(i.nivel);
        return (
          <div className="flex items-center gap-2">
            <span className="tabular-nums font-medium text-ink">
              {i.quantityInStock ?? "—"}
              {i.unitType && <span className="ml-1 font-normal text-ink-soft">{i.unitType}</span>}
            </span>
            <span className={`rounded-full px-2 py-0.5 text-xs ${et.clase}`}>{et.texto}</span>
          </div>
        );
      },
    },
    {
      key: "min",
      header: "Mínimo",
      width: 90,
      // 0 y "sin mínimo" son lo mismo para el aviso, y mostrar un 0 hace pensar
      // que está configurado. Ver `nivelDeStock` en el backend.
      render: (i) => (i.minimumStock ? <span className="tabular-nums">{i.minimumStock}</span> : "—"),
    },
    {
      key: "cost",
      header: "Costo",
      width: 120,
      render: (i) => (i.unitCost != null ? <span className="tabular-nums">{money(i.unitCost)}</span> : "—"),
    },
    {
      key: "venta",
      header: "Venta",
      width: 110,
      // Sin esta columna hay que abrir cada insumo para saber cuáles se venden.
      render: (i) =>
        i.unitPrice != null ? (
          <span className="tabular-nums text-ink">{money(i.unitPrice)}</span>
        ) : (
          <span className="text-ink-soft">No</span>
        ),
    },
    {
      key: "sup",
      header: "Proveedor",
      width: 200,
      render: (i) => <span className="text-ink-soft">{i.supplierInfo ?? "—"}</span>,
    },
  ];

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setMargen("");
    setFormError(null);
    setDrawerOpen(true);
  }

  function openEdit(i: Insumo) {
    setEditing(i);
    setForm({
      name: i.name ?? "",
      code: i.code ?? "",
      unitType: i.unitType ?? "",
      quantityInStock: i.quantityInStock?.toString() ?? "",
      minimumStock: i.minimumStock?.toString() ?? "",
      unitCost: i.unitCost?.toString() ?? "",
      supplierInfo: i.supplierInfo ?? "",
      description: i.description ?? "",
      // Tener precio de venta ES ser producto vendible: no hace falta otra
      // columna para saberlo.
      seVende: i.unitPrice != null,
      unitPrice: i.unitPrice?.toString() ?? "",
    });
    const m = margenDesdePrecio(i.unitCost, i.unitPrice);
    setMargen(m == null ? "" : String(m));
    setFormError(null);
    setDrawerOpen(true);
  }

  function save() {
    const payload = {
      name: form.name.trim(),
      code: form.code.trim() || null,
      unitType: form.unitType.trim() || null,
      quantityInStock: num(form.quantityInStock),
      minimumStock: num(form.minimumStock),
      unitCost: num(form.unitCost),
      supplierInfo: form.supplierInfo.trim() || null,
      description: form.description.trim() || null,
      // Destildar "se vende" borra el precio: es justamente lo que lo saca del
      // circuito de venta. Dejarlo cargado haría que siguiera facturándose.
      unitPrice: form.seVende ? num(form.unitPrice) : null,
    };
    const handlers = {
      onSuccess: () => {
        toast.success(editing ? "Insumo actualizado" : "Insumo creado");
        setDrawerOpen(false);
      },
      onError: (e: Error) => setFormError(e.message),
    };
    if (editing) update.mutate({ id: editing.id, ...payload }, handlers);
    else create.mutate(payload, handlers);
  }

  const saving = create.isPending || update.isPending;
  const costoNum = num(form.unitCost);

  return (
    <>
      <ResourceManager<Insumo>
        title="Insumos"
        rows={rows}
        columns={columns}
        loading={isLoading}
        error={error ? (error as Error).message : null}
        avisoSuperior={
          aviso && !showArchived ? (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm">
              <span className="font-medium text-amber-900">{aviso}</span>
              <button
                type="button"
                onClick={() => setSoloFaltantes((v) => !v)}
                className="font-medium text-amber-900 underline hover:no-underline"
              >
                {soloFaltantes ? "Ver todos" : `Ver los ${faltantes.length}`}
              </button>
            </div>
          ) : null
        }
        rowKey={(i) => i.id}
        isArchived={(i) => i.isActive === false}
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Buscar por nombre, código o proveedor…"
        showArchived={showArchived}
        onToggleArchived={(v) => {
          setShowArchived(v);
          // El filtro de faltantes no tiene sentido sobre los archivados: son
          // insumos que ya no se usan, reponerlos no es una tarea.
          setSoloFaltantes(false);
        }}
        canCreate={canManage}
        canArchive={canManage}
        onAdd={openCreate}
        onEdit={canEdit ? openEdit : undefined}
        archiving={archive.isPending}
        archiveName={(i) => i.name ?? "este insumo"}
        onArchive={(i) =>
          archive.mutate(i.id, {
            onSuccess: () => toast.success("Insumo archivado"),
            onError: (e: Error) => toast.error(e.message),
          })
        }
        onRestore={(i) =>
          restore.mutate(i.id, {
            onSuccess: () => toast.success("Insumo restaurado"),
            onError: (e: Error) => toast.error(e.message),
          })
        }
      />

      <EntityDrawer
        open={drawerOpen}
        title={editing ? "Editar insumo" : "Nuevo insumo"}
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
            placeholder="Ej: Gasas estériles"
            autoFocus
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Unidad">
            <TextInput
              list="unidades-insumo"
              value={form.unitType}
              onChange={(e) => setForm({ ...form, unitType: e.target.value })}
              placeholder="caja, ml, par…"
            />
            <datalist id="unidades-insumo">
              {UNIDADES.map((u) => (
                <option key={u} value={u} />
              ))}
            </datalist>
          </Field>
          <Field label="Código">
            <TextInput
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              placeholder="Opcional"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Stock actual">
            <TextInput
              type="number"
              value={form.quantityInStock}
              onChange={(e) => setForm({ ...form, quantityInStock: e.target.value })}
              placeholder="—"
            />
          </Field>
          <Field label="Avisarme cuando baje a">
            <TextInput
              type="number"
              min={0}
              value={form.minimumStock}
              onChange={(e) => setForm({ ...form, minimumStock: e.target.value })}
              placeholder="Sin aviso"
            />
          </Field>
        </div>

        {/* La nota va visible y no en un tooltip: costo y precio de venta son el
            error fácil de cometer acá, y un aviso que hay que descubrir no
            evita nada. */}
        <div>
          <Field label="Costo por unidad">
            <TextInput
              type="number"
              min={0}
              step="0.01"
              value={form.unitCost}
              onChange={(e) => {
                // Si cambia el costo, el margen que se mostraba ya no
                // corresponde a este precio: se recalcula en vez de quedar
                // mintiendo.
                const m = margenDesdePrecio(num(e.target.value), num(form.unitPrice));
                setForm({ ...form, unitCost: e.target.value });
                setMargen(m == null ? "" : String(m));
              }}
              placeholder="—"
            />
          </Field>
          <p className="mt-1 text-xs text-ink-soft">
            Lo que <strong>cuesta</strong> comprarlo, no lo que se cobra. Sirve para saber cuánto
            sale cada tratamiento.
          </p>
        </div>

        {/* ── También se vende ────────────────────────────────────────────
            `products` es la misma tabla que usa la facturación, así que un
            insumo puede además venderse. Lo que lo hace vendible es tener
            precio: no hace falta otra columna. */}
        <div className="rounded-xl border border-surface-high bg-surface-low p-3">
          <Checkbox
            label="También se vende a las clientas"
            checked={form.seVende}
            onChange={(v) => setForm({ ...form, seVende: v, unitPrice: v ? form.unitPrice : "" })}
          />
          {form.seVende && (
            <div className="mt-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="% sobre el costo">
                  <TextInput
                    type="number"
                    step="0.1"
                    value={margen}
                    onChange={(e) => {
                      const p = precioDesdeMargen(costoNum, num(e.target.value));
                      setMargen(e.target.value);
                      setForm((f) => ({ ...f, unitPrice: p == null ? f.unitPrice : String(p) }));
                    }}
                    placeholder={costoNum == null ? "Cargá el costo" : "Ej: 100"}
                    disabled={costoNum == null}
                  />
                </Field>
                <Field label="Precio de venta">
                  <TextInput
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.unitPrice}
                    onChange={(e) => {
                      // Los dos campos se calculan uno al otro: Laura escribe
                      // el que tenga a mano, no el que le pidamos.
                      const m = margenDesdePrecio(costoNum, num(e.target.value));
                      setForm({ ...form, unitPrice: e.target.value });
                      setMargen(m == null ? "" : String(m));
                    }}
                    placeholder="—"
                  />
                </Field>
              </div>
              <p className="mt-1 text-xs text-ink-soft">
                {costoNum == null
                  ? "Cargá primero el costo por unidad para calcular el precio."
                  : "Escribí el porcentaje o el precio: el otro se completa solo."}
              </p>
            </div>
          )}
        </div>

        <Field label="Proveedor">
          <TextInput
            value={form.supplierInfo}
            onChange={(e) => setForm({ ...form, supplierInfo: e.target.value })}
            placeholder="Nombre, teléfono, lo que sirva"
          />
        </Field>

        <Field label="Notas">
          <TextArea
            rows={2}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </Field>
      </EntityDrawer>
    </>
  );
}
