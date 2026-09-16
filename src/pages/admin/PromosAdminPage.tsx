import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { can, type Role } from "../../lib/permissions";
import { ResourceManager, type Column } from "../../components/ResourceManager";
import { EntityDrawer } from "../../components/EntityDrawer";
import { Field, Select, TextArea, TextInput } from "../../components/form";
import { useToast } from "../../components/ui/Toast";
import { useServices } from "../../hooks/useServices";
import { useProvidersByService } from "../../hooks/useProvidersByService";
import { useCombosAdmin } from "../../hooks/useCombosAdmin";
import { useCombosDepilacion } from "../../hooks/useDepilacion";
import {
  useArchivePromotion,
  useCreatePromotion,
  useDeletePromotion,
  usePromotionsAdmin,
  useRestorePromotion,
  useUpdatePromotionAdmin,
  type PromotionInput,
} from "../../hooks/usePromotionsAdmin";
import type { PromotionAdmin } from "../../lib/api-types";
import {
  erroresDelFormulario,
  pagosParaEnviar,
  serviciosADesglosar,
  type DestinoDraft,
  type PagoDraft,
  type ServicioADesglosar,
  type TipoDeDestino,
} from "../../lib/promo-form";

const money = (n: number | null | undefined) =>
  n == null ? "—" : `$${n.toLocaleString("es-AR")}`;

type Form = {
  name: string;
  description: string;
  promotionType: "" | "percentage" | "fixed_amount";
  discountValue: string;
  validFrom: string;
  validUntil: string;
  isFeatured: boolean;
  isVisibleWeb: boolean;
  usageLimit: string;
  notes: string;
  destinos: DestinoDraft[];
  pagos: PagoDraft[];
};

const EMPTY: Form = {
  name: "",
  description: "",
  promotionType: "",
  discountValue: "",
  validFrom: "",
  validUntil: "",
  isFeatured: false,
  isVisibleWeb: false,
  usageLimit: "",
  notes: "",
  destinos: [],
  pagos: [],
};

/** Una opción tildable de un bloque de oferta. `tipo` pisa al del bloque que
 *  la contiene — así entra depilación dentro del bloque de Combos. */
type OpcionDeOferta = { id: string; nombre: string; tipo?: TipoDeDestino };

/**
 * Una lista de casillas para un bloque de "qué está en oferta" (Servicios,
 * Combos o Packs). Tres bloques separados en vez de un desplegable único:
 * Laura piensa en servicios, combos y packs como cosas distintas, y
 * mezclarlos la obliga a buscar a ciegas.
 */
function BloqueDeOferta({
  titulo,
  tipo,
  opciones,
  destinos,
  onToggle,
}: {
  titulo: string;
  tipo: TipoDeDestino;
  opciones: OpcionDeOferta[];
  destinos: DestinoDraft[];
  onToggle: (d: DestinoDraft) => void;
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">{titulo}</p>
      {opciones.length === 0 ? (
        <p className="mt-1 text-sm text-ink-soft">Nada cargado todavía.</p>
      ) : (
        <ul className="mt-1 space-y-1">
          {opciones.map((o) => {
            const t = o.tipo ?? tipo;
            const checked = destinos.some((d) => d.tipo === t && d.id === o.id);
            return (
              <li key={`${t}-${o.id}`}>
                <label className="flex items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggle({ tipo: t, id: o.id })}
                    className="h-4 w-4 accent-[var(--color-primary)]"
                  />
                  {o.nombre}
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/**
 * Una fila de "Pagos acordados": el servicio ya viene dado (sale de lo que
 * está en oferta, no se elige acá), y sólo se completa proveedora + monto.
 *
 * Pedido de Pia: cada fila muestra el nombre, de qué combo sale y su duración
 * estimada — los datos que hacen falta para saber que se va a poder agendar
 * — y avisa (sin bloquear) si el servicio no tiene ninguna proveedora: sin
 * ese aviso Laura pone en oferta algo que después nadie puede atender, y la
 * clienta paga por un turno que no existe.
 */
function FilaDePago({
  servicio,
  pago,
  onChange,
}: {
  servicio: ServicioADesglosar;
  pago: PagoDraft | undefined;
  onChange: (p: PagoDraft) => void;
}) {
  const { data: providers = [] } = useProvidersByService(servicio.serviceId);
  const { data: services = [] } = useServices();
  const detalle = services.find((s) => s.id === servicio.serviceId);
  const actual: PagoDraft = pago ?? {
    serviceId: servicio.serviceId,
    serviceProviderId: "",
    providerPayment: "",
  };

  return (
    <li className="space-y-2 rounded-lg border border-surface-high bg-white p-2.5">
      <div className="text-sm">
        <span className="font-medium text-ink">{servicio.serviceName ?? detalle?.name ?? "—"}</span>
        {servicio.deCombo && <span className="text-ink-soft"> · de {servicio.deCombo}</span>}
        {detalle?.estimatedDurationMinutes != null && (
          <span className="text-ink-soft"> · {detalle.estimatedDurationMinutes} min</span>
        )}
      </div>
      {providers.length === 0 && (
        // Avisa, no bloquea: puede que Laura arme la promo antes de asignar
        // proveedora, pero tiene que enterarse antes de publicarla.
        <p className="rounded bg-amber-50 px-2 py-1 text-xs text-amber-800">
          Este servicio no tiene proveedora asignada: no se va a poder agendar.
        </p>
      )}
      <div className="flex gap-2">
        <Field label="Proveedora">
          <Select
            value={actual.serviceProviderId}
            onChange={(e) => onChange({ ...actual, serviceProviderId: e.target.value })}
          >
            <option value="">Sin acuerdo especial</option>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.fullName ?? "—"}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="Se le paga ($)"
          help="Cuánto recibe esta proveedora por su servicio dentro de la promo. Opcional: si no se completa, rige el acuerdo de siempre."
        >
          <TextInput
            inputMode="numeric"
            value={actual.providerPayment}
            onChange={(e) => onChange({ ...actual, providerPayment: e.target.value })}
            placeholder="0"
          />
        </Field>
      </div>
    </li>
  );
}

/**
 * Cartel informativo (no bloqueante) arriba del listado: una promo no crea
 * servicios nuevos, solo combina los que ya están cargados. Si el servicio
 * que se busca no existe todavía, no va a aparecer en los bloques de oferta
 * más abajo — este aviso explica por qué antes de que la usuaria llegue a
 * ese punto y se quede sin entender.
 */
function PromoDependenciaAviso() {
  return (
    <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
      Una promo se arma con servicios y actividades que ya estén cargados. Si falta alguno,
      cargalo primero en{" "}
      <Link to="/admin/servicios" className="font-medium underline underline-offset-2">
        Servicios
      </Link>
      .
    </div>
  );
}

export function PromosAdminPage() {
  const { role } = useAuth();
  const r = role as Role | null;
  const canEdit = can(r, "catalogo", "edit");
  const canManage = can(r, "catalogo", "manage");
  const toast = useToast();

  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<PromotionAdmin | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: promos = [], isLoading, error } = usePromotionsAdmin(showArchived);
  const { data: services = [] } = useServices();
  // Sin `areaCategoryId`: acá hace falta el catálogo de combos/packs de TODAS
  // las áreas, no el de una sola.
  const { data: combos = [] } = useCombosAdmin(false, { kind: "combo" });
  const { data: packs = [] } = useCombosAdmin(false, { kind: "pack" });
  const { data: combosDepilacion = [] } = useCombosDepilacion();
  const create = useCreatePromotion();
  const update = useUpdatePromotionAdmin();
  const archive = useArchivePromotion();
  const restore = useRestorePromotion();
  const hardDelete = useDeletePromotion();

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return promos;
    return promos.filter((p) => (p.name ?? "").toLowerCase().includes(q));
  }, [promos, search]);

  // Los servicios que necesitan una fila de pago: los sueltos en oferta más
  // los que aportan los combos y packs en oferta (desglosados y sin repetir).
  const desglose = useMemo(
    () => serviciosADesglosar(form.destinos, [...combos, ...packs]),
    [form.destinos, combos, packs],
  );

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
      key: "oferta",
      header: "En oferta",
      width: 100,
      render: (p) => <span className="text-ink-soft">{p.destinos.length}</span>,
    },
    {
      key: "pagos",
      header: "Pagos acordados",
      width: 130,
      render: (p) => <span className="text-ink-soft">{p.pagos.length}</span>,
    },
    {
      key: "web",
      header: "Web",
      width: 130,
      render: (p) =>
        p.isFeatured ? (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary-dark">
            Destacada
          </span>
        ) : p.isVisibleWeb ? (
          <span className="text-ink-soft">Mostrada</span>
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
      isVisibleWeb: p.isVisibleWeb ?? false,
      usageLimit: p.usageLimit != null ? String(p.usageLimit) : "",
      notes: p.notes ?? "",
      destinos: p.destinos.map((d) => ({ tipo: d.tipo, id: d.id })),
      pagos: p.pagos.map((pg) => ({
        serviceId: pg.serviceId,
        serviceProviderId: pg.serviceProviderId,
        providerPayment: pg.providerPayment != null ? String(pg.providerPayment) : "",
      })),
    });
    setFormError(null);
    setDrawerOpen(true);
  }

  function alternarDestino(d: DestinoDraft) {
    setForm((f) => {
      const existe = f.destinos.some((x) => x.tipo === d.tipo && x.id === d.id);
      return {
        ...f,
        destinos: existe
          ? f.destinos.filter((x) => !(x.tipo === d.tipo && x.id === d.id))
          : [...f.destinos, d],
      };
    });
  }

  function actualizarPago(nuevo: PagoDraft) {
    setForm((f) => {
      const existe = f.pagos.some((p) => p.serviceId === nuevo.serviceId);
      return {
        ...f,
        pagos: existe
          ? f.pagos.map((p) => (p.serviceId === nuevo.serviceId ? nuevo : p))
          : [...f.pagos, nuevo],
      };
    });
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
      isVisibleWeb: form.isVisibleWeb,
      usageLimit: form.usageLimit.trim() === "" ? null : Number(form.usageLimit),
      notes: form.notes.trim() || null,
      destinos: form.destinos,
      pagos: pagosParaEnviar(form.pagos),
    };
  }

  async function save() {
    setFormError(null);
    // Se valida acá, antes de tocar la API: un guardado a medias (por ejemplo
    // sin nada en oferta) no es un estado que el backend deba rechazar, es
    // uno que la pantalla tiene que impedir de entrada.
    const errores = erroresDelFormulario({
      name: form.name,
      destinos: form.destinos,
      isFeatured: form.isFeatured,
      isVisibleWeb: form.isVisibleWeb,
    });
    if (errores.length > 0) {
      setFormError(errores.join(" "));
      return;
    }
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
        avisoSuperior={<PromoDependenciaAviso />}
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
        canCreate={canManage}
        canArchive={canManage}
        canHardDelete={canManage}
        onAdd={openCreate}
        onEdit={canEdit ? openEdit : undefined}
        archiving={archive.isPending}
        archiveName={(p) => p.name ?? "esta promo"}
        hardDeleteName={(p) => p.name ?? "esta promo"}
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
        onHardDeletePreview={async () => ({ blocked: false, cascade: {} })}
        onHardDelete={(p) =>
          hardDelete.mutate(p.id, {
            onSuccess: () => toast.success("Promo eliminada definitivamente"),
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
          <div className="flex flex-col justify-end gap-1 pb-2">
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={form.isVisibleWeb}
                onChange={(e) => setForm({ ...form, isVisibleWeb: e.target.checked })}
                className="h-4 w-4 accent-[var(--color-primary)]"
              />
              Mostrar en la web
            </label>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={form.isFeatured}
                onChange={(e) => setForm({ ...form, isFeatured: e.target.checked })}
                className="h-4 w-4 accent-[var(--color-primary)]"
              />
              Destacada en la web
            </label>
          </div>
        </div>
        {/* Dos tildes distintos, no uno solo con más énfasis: Mostrar publica en
            Servicios, Destacada además la sube al carrusel de la home. Por eso
            erroresDelFormulario avisa si se tilda Destacada sin Mostrar. */}
        <p className="-mt-2 text-xs text-ink-soft">
          Mostrar la publica en la página de Servicios. Destacada la sube además al carrusel de la
          home — sin Mostrar, Destacada no hace nada.
        </p>

        {/* Qué está en oferta. Tres bloques en vez de una lista sola: Laura
            piensa en servicios, combos y packs como cosas distintas, y
            mezclarlos en un desplegable único la obliga a buscar a ciegas. */}
        <div className="space-y-4 rounded-xl border border-surface-high p-3">
          <p className="text-xs text-ink-soft">
            Elegí uno o varios de cada bloque. Podés mezclar libremente: un servicio suelto, dos
            combos y un pack pueden estar en la misma promo.
          </p>
          <BloqueDeOferta
            titulo="Servicios en oferta"
            tipo="servicio"
            opciones={services.map((s) => ({ id: s.id, nombre: s.name ?? "—" }))}
            destinos={form.destinos}
            onToggle={alternarDestino}
          />
          <BloqueDeOferta
            titulo="Combos en oferta"
            tipo="combo"
            opciones={[
              ...combos.map((c) => ({ id: c.id, nombre: c.name ?? "—" })),
              ...combosDepilacion.map((c) => ({ id: c.id, nombre: c.name, tipo: "depilacion" as const })),
            ]}
            destinos={form.destinos}
            onToggle={alternarDestino}
          />
          <BloqueDeOferta
            titulo="Packs en oferta"
            tipo="combo"
            opciones={packs.map((c) => ({ id: c.id, nombre: c.name ?? "—" }))}
            destinos={form.destinos}
            onToggle={alternarDestino}
          />
        </div>

        {/* Cuánto se le paga a cada proveedora mientras el servicio está en
            promo. Es opcional: lo que quede vacío se paga por el acuerdo de
            siempre. Un combo no aporta un pago propio: aporta sus servicios a
            esta lista. */}
        <div className="space-y-2 rounded-xl border border-surface-high p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">
            Pagos acordados con las proveedoras
          </p>
          {desglose.length === 0 ? (
            <p className="text-sm text-ink-soft">
              Elegí algo en oferta y acá van a aparecer sus servicios.
            </p>
          ) : (
            <ul className="space-y-2">
              {desglose.map((s) => (
                <FilaDePago
                  key={s.serviceId}
                  servicio={s}
                  pago={form.pagos.find((p) => p.serviceId === s.serviceId)}
                  onChange={actualizarPago}
                />
              ))}
            </ul>
          )}
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
