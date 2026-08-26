import { useMemo, useState } from "react";
import { useAuth } from "../../../auth/AuthContext";
import { can, type Role } from "../../../lib/permissions";
import { ArmadorCombo, type ArmadorComboState } from "../../../components/depilacion/ArmadorCombo";
import { EntityDrawer } from "../../../components/EntityDrawer";
import { Checkbox, Field, TextArea, TextInput } from "../../../components/form";
import { ResourceManager, type Column } from "../../../components/ResourceManager";
import { useToast } from "../../../components/ui/Toast";
import { money } from "../../../lib/format";
import {
  calcularPrecioPack,
  politicaDePack,
  type PackFijo,
  type ZonaParaCotizar,
  type Exclusion,
} from "../../../lib/depilation-pricing";
import type { ComboDepilacion } from "../../../lib/api-types";
import {
  useArchivarComboDepilacion,
  useComboDepilacionDeleteImpact,
  useCombosDepilacion,
  useDepilacionConfig,
  useGuardarComboDepilacion,
  useHardDeleteComboDepilacion,
  useZonas,
} from "../../../hooks/useDepilacion";

type Form = {
  name: string;
  description: string;
  isPublishedWeb: boolean;
  /** Solo se usa editando un pack fijo. Un combo guardado no tiene precio
   *  propio: el suyo sale siempre de la fórmula. */
  fixedPrice: string;
  /** `false` = este combo usa el pack global de la pantalla Precios. Hace
   *  falta un interruptor aparte porque "usar el global" se guarda como tres
   *  columnas vacías, y eso no se puede expresar con campos de texto: sin
   *  esto, cualquiera termina tipeando los mismos números del global en cada
   *  combo, que es justo lo que se quiere evitar. */
  packPropio: boolean;
  packSessions: string;
  packDiscountPercentage: string;
  packRoundingBase: string;
};

const EMPTY: Form = {
  name: "",
  description: "",
  isPublishedWeb: false,
  fixedPrice: "",
  packPropio: false,
  packSessions: "",
  packDiscountPercentage: "",
  packRoundingBase: "",
};

/** "" es inválido (un pack fijo necesita precio). Acepta enteros >= 0 con
 *  puntos o espacios de miles ("65.000"); cualquier otra cosa devuelve null
 *  para que el llamador muestre el error sin llegar a la API. */
function parsePrecio(raw: string): number | null {
  const limpio = raw.trim().replace(/[.\s]/g, "");
  if (limpio === "" || !/^\d+$/.test(limpio)) return null;
  return Number(limpio);
}

/** Entero >= 0. "" y cualquier cosa no numérica devuelven null para que el
 *  llamador muestre el error sin llegar a la API. */
function parseEntero(raw: string): number | null {
  const limpio = raw.trim();
  if (limpio === "" || !/^\d+$/.test(limpio)) return null;
  return Number(limpio);
}

export function CombosDepilacionPage() {
  const { role } = useAuth();
  const r = role as Role | null;
  const canEdit = can(r, "catalogo", "edit");
  const canManage = can(r, "catalogo", "manage");
  const toast = useToast();

  const isAdmin = r === "admin";

  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<ComboDepilacion | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [formError, setFormError] = useState<string | null>(null);
  const [armadorState, setArmadorState] = useState<ArmadorComboState | null>(null);

  const { data: zonasData, isLoading: zonasLoading, error: zonasError } = useZonas();
  const { data: config, isLoading: configLoading, error: configError } = useDepilacionConfig();
  const { data: combos, isLoading: combosLoading, error: combosError } = useCombosDepilacion();
  const guardarCombo = useGuardarComboDepilacion();
  const archivarCombo = useArchivarComboDepilacion();
  const deleteImpact = useComboDepilacionDeleteImpact();
  const hardDelete = useHardDeleteComboDepilacion();

  // El armador solo ofrece zonas activas: una zona archivada no se puede
  // sumar a un combo nuevo, aunque siga viva en combos ya guardados.
  const zonasActivas: ZonaParaCotizar[] = useMemo(() => {
    if (!zonasData) return [];
    const todas = [...zonasData.grande, ...zonasData.mediana, ...zonasData.chica];
    return todas
      .filter((z) => z.isActive)
      .map((z) => ({ id: z.id, nombre: z.name, categoria: z.category }));
  }, [zonasData]);

  // El backend guarda `exclusions` colgado de cada zona (y ya escribe las dos
  // direcciones del par al guardar) — acá solo se aplana a la forma de pares
  // que pide `zonasBloqueadas`.
  const exclusiones: Exclusion[] = useMemo(() => {
    if (!zonasData) return [];
    const todas = [...zonasData.grande, ...zonasData.mediana, ...zonasData.chica];
    const pares: Exclusion[] = [];
    for (const z of todas) {
      for (const excluyeA of z.exclusions) pares.push({ zonaId: z.id, excluyeA });
    }
    return pares;
  }, [zonasData]);

  // Los packs fijos activos, en la forma que pide `buscarPackFijo`.
  const packs: PackFijo[] = useMemo(() => {
    if (!combos) return [];
    return combos
      .filter((c) => c.kind === "pack_fijo" && c.isActive)
      .map((c) => ({
        id: c.id,
        nombre: c.name,
        zonasBase: c.zonas.map((z) => z.id),
        zonasAEleccion: c.choiceZoneCount,
        precioFijo: c.fixedPrice ?? c.precioFinal,
        duracionFija: c.fixedDurationMinutes,
      }));
  }, [combos]);

  // El filtro activos/archivados lo hace ResourceManager; acá solo el
  // buscador, que mira el nombre del combo y también el de sus zonas: buscar
  // "Axila" tiene que traer los combos que la incluyen.
  const combosVisibles = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q === "") return combos ?? [];
    return (combos ?? []).filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.zonas.some((z) => z.name.toLowerCase().includes(q)),
    );
  }, [combos, search]);

  // Zonas que el combo en edición ya incluye pero que ya no están activas.
  // `ArmadorCombo` las necesita para mostrarlas por nombre, seguir
  // cotizándolas mientras sigan tildadas y dejar que se destilden — si no se
  // le pasan, esas zonas desaparecen del cálculo en silencio y, si se guarda
  // sin sacarlas, el backend rechaza el PATCH con un 400 sobre un uuid que
  // nadie puede ubicar en la pantalla.
  const zonasArchivadasDelCombo: ZonaParaCotizar[] = useMemo(() => {
    if (!editing) return [];
    const activasIds = new Set(zonasActivas.map((z) => z.id));
    return editing.zonas
      .filter((z) => !activasIds.has(z.id))
      .map((z) => ({ id: z.id, nombre: z.name, categoria: z.category }));
  }, [editing, zonasActivas]);

  // Mientras quede una zona archivada tildada, no se deja guardar: es más
  // claro que el admin la saque acá a que el PATCH vuelva con un 400 sobre un
  // uuid sin nombre.
  const tieneZonaArchivadaSeleccionada = useMemo(() => {
    if (zonasArchivadasDelCombo.length === 0 || !armadorState) return false;
    const archivadasIds = new Set(zonasArchivadasDelCombo.map((z) => z.id));
    return armadorState.zonaIds.some((id) => archivadasIds.has(id));
  }, [zonasArchivadasDelCombo, armadorState]);

  function openCreate() {
    setEditing(null);
    setForm({
      ...EMPTY,
      packSessions: config ? String(config.packSesiones) : "",
      packDiscountPercentage: config ? String(config.packDescuentoPct) : "",
      packRoundingBase: config ? String(config.packRedondeo) : "",
    });
    setFormError(null);
    setArmadorState(null);
    setDrawerOpen(true);
  }

  function openEdit(c: ComboDepilacion) {
    setEditing(c);
    setForm({
      name: c.name,
      description: c.description ?? "",
      isPublishedWeb: c.isPublishedWeb,
      fixedPrice: c.fixedPrice != null ? String(c.fixedPrice) : "",
      packPropio: c.packSessions != null,
      // Si el combo no tiene pack propio, los campos arrancan con los valores
      // del global: al prender el interruptor se ve de dónde parte, en vez de
      // tres casillas vacías.
      packSessions: String(c.packSessions ?? c.pack.sesiones),
      packDiscountPercentage: String(c.packDiscountPercentage ?? c.pack.descuentoPct),
      packRoundingBase: String(c.packRoundingBase ?? c.pack.redondeo),
    });
    setFormError(null);
    setArmadorState(null);
    setDrawerOpen(true);
  }

  async function save() {
    setFormError(null);
    const zonaIds = armadorState?.zonaIds ?? [];
    if (zonaIds.length === 0) {
      setFormError("El combo tiene que incluir al menos una zona.");
      return;
    }
    // Un pack fijo sembrado se puede editar, pero sigue siendo pack fijo: el
    // backend rechaza cambiarle el kind o dejarlo sin precio. Crear, en
    // cambio, siempre crea un guardado.
    const esPackFijo = editing?.kind === "pack_fijo";
    let fixedPrice: number | null = null;
    if (esPackFijo) {
      const parsed = parsePrecio(form.fixedPrice);
      if (parsed === null) {
        setFormError("El precio del pack tiene que ser un número entero mayor o igual a 0.");
        return;
      }
      fixedPrice = parsed;
    }

    // Las tres o ninguna. Con el interruptor apagado se mandan en `null`
    // explícito: eso es lo que le dice al backend "volvé al pack global",
    // distinto de no mandar el campo.
    let pack: {
      packSessions: number | null;
      packDiscountPercentage: number | null;
      packRoundingBase: number | null;
    } = { packSessions: null, packDiscountPercentage: null, packRoundingBase: null };

    if (form.packPropio) {
      const sesiones = parseEntero(form.packSessions);
      const descuento = parseEntero(form.packDiscountPercentage);
      const redondeo = parseEntero(form.packRoundingBase);
      if (sesiones === null || sesiones < 1) {
        setFormError("Las sesiones del pack tienen que ser un número entero de 1 o más.");
        return;
      }
      if (descuento === null || descuento > 100) {
        setFormError("El descuento del pack tiene que ser un número entero entre 0 y 100.");
        return;
      }
      if (redondeo === null || redondeo < 1) {
        setFormError("El redondeo del pack tiene que ser un número entero de 1 o más.");
        return;
      }
      pack = {
        packSessions: sesiones,
        packDiscountPercentage: descuento,
        packRoundingBase: redondeo,
      };
    }

    try {
      await guardarCombo.mutateAsync({
        id: editing?.id,
        name: form.name.trim(),
        description: form.description.trim() || null,
        isPublishedWeb: form.isPublishedWeb,
        displayOrder: editing?.displayOrder ?? 0,
        zonaIds,
        kind: esPackFijo ? "pack_fijo" : "guardado",
        fixedPrice: esPackFijo ? fixedPrice : undefined,
        choiceZoneCount: esPackFijo ? editing.choiceZoneCount : 0,
        ...pack,
      });
      toast.success(editing ? "Combo actualizado" : "Combo creado");
      setDrawerOpen(false);
    } catch (e) {
      setFormError((e as Error).message);
    }
  }

  // Precio del pack mientras se edita, con lo que hay en el formulario y en el
  // armador — no con lo guardado. Es `null` mientras falte algo (no hay zonas
  // tildadas todavía, o una perilla está a mitad de tipear): mostrar un número
  // a partir de un campo vacío sería inventarlo.
  const previewPack = useMemo(() => {
    if (!config || !armadorState) return null;

    // Un pack fijo se cobra a su precio de catálogo, así que el pack sale de
    // ese número; un guardado sale de la fórmula del armador.
    const base =
      editing?.kind === "pack_fijo" ? parsePrecio(form.fixedPrice) : armadorState.cotizacion.total;
    if (base === null || base <= 0) return null;

    let propia = null;
    if (form.packPropio) {
      const sesiones = parseEntero(form.packSessions);
      const descuentoPct = parseEntero(form.packDiscountPercentage);
      const redondeo = parseEntero(form.packRoundingBase);
      if (sesiones === null || sesiones < 1) return null;
      if (descuentoPct === null || descuentoPct > 100) return null;
      if (redondeo === null || redondeo < 1) return null;
      propia = { sesiones, descuentoPct, redondeo };
    }

    const politica = politicaDePack(config, propia);
    const precio = calcularPrecioPack(base, config, propia);
    return {
      ...politica,
      base,
      precio,
      ahorro: base * politica.sesiones - precio,
    };
  }, [config, armadorState, editing, form]);

  const saving = guardarCombo.isPending;
  const puedeGuardar = form.name.trim().length >= 1 && !tieneZonaArchivadaSeleccionada;
  const loading = zonasLoading || configLoading || combosLoading;
  const error = zonasError ?? configError ?? combosError;

  const COLUMNAS: Column<ComboDepilacion>[] = useMemo(
    () => [
      {
        key: "nombre",
        header: "Nombre",
        width: 260,
        render: (c) => {
          // Un pack fijo cuyo precio quedó por encima de su propia fórmula
          // dejó de ser un descuento: quien lo edite tiene que verlo acá, no
          // descubrirlo cobrando.
          const excedeFormula =
            c.kind === "pack_fijo" && c.fixedPrice != null && c.fixedPrice > c.precioCalculado;
          return (
            <div>
              <p className="truncate">{c.name}</p>
              <p className="text-xs text-ink-soft">
                {c.kind === "pack_fijo" ? "Pack fijo" : "Guardado"}
                {c.choiceZoneCount > 0 && ` · +${c.choiceZoneCount} a elección`}
              </p>
              {excedeFormula && (
                <p className="mt-1 whitespace-normal text-xs text-amber-800">
                  ⚠ Este precio fijo ({money(c.fixedPrice)}) es mayor a lo que da la fórmula (
                  {money(c.precioCalculado)}): dejó de ser un descuento.
                </p>
              )}
            </div>
          );
        },
      },
      {
        key: "zonas",
        header: "Zonas",
        width: 340,
        render: (c) => c.zonas.map((z) => z.name).join(", "),
      },
      {
        key: "precio",
        header: "Precio",
        width: 120,
        className: "text-right",
        render: (c) => money(c.precioFinal),
      },
      {
        key: "turno",
        header: "Turno",
        width: 100,
        className: "text-right",
        render: (c) => `${c.duracionMinutos} min`,
      },
      {
        key: "pack",
        header: "Pack",
        width: 150,
        className: "text-right",
        render: (c) => (
          <span title={c.pack.propio ? "Pack propio de este combo" : "Pack por defecto"}>
            {money(c.pack.precio)}
            <span className="text-ink-soft">
              {" "}
              ×{c.pack.sesiones}
              {c.pack.propio ? " ·" : ""}
            </span>
          </span>
        ),
      },
      {
        key: "web",
        header: "Web",
        width: 80,
        render: (c) => (c.isPublishedWeb ? "Sí" : "No"),
      },
    ],
    [],
  );

  return (
    <>
      <ResourceManager
        title="Combos"
        rows={combosVisibles}
        columns={COLUMNAS}
        loading={loading}
        error={error ? (error as Error).message : null}
        rowKey={(c) => c.id}
        isArchived={(c) => !c.isActive}
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Buscar por nombre del combo o de una zona…"
        showArchived={showArchived}
        onToggleArchived={setShowArchived}
        canCreate={canManage && !loading && !error}
        canArchive={canManage}
        onAdd={openCreate}
        onEdit={canEdit ? openEdit : undefined}
        archiving={archivarCombo.isPending}
        archiveName={(c) => c.name}
        onArchive={(c) =>
          archivarCombo.mutate(
            { id: c.id, isActive: false },
            {
              onSuccess: () => toast.success("Combo archivado"),
              onError: (e: Error) => toast.error(e.message),
            },
          )
        }
        onRestore={(c) =>
          archivarCombo.mutate(
            { id: c.id, isActive: true },
            {
              onSuccess: () => toast.success("Combo restaurado"),
              onError: (e: Error) => toast.error(e.message),
            },
          )
        }
        canHardDelete={isAdmin}
        onHardDeletePreview={(c) => deleteImpact.mutateAsync(c.id)}
        hardDeleteName={(c) => c.name}
        onHardDelete={(c) =>
          hardDelete.mutate(c.id, {
            onSuccess: () => toast.success("Combo eliminado definitivamente"),
            onError: (e: Error) => toast.error(e.message),
          })
        }
      />

      <EntityDrawer
        open={drawerOpen}
        title={editing ? "Editar combo" : "Nuevo combo"}
        error={formError}
        busy={saving}
        canSubmit={puedeGuardar}
        widthClass="max-w-4xl"
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
        {editing?.kind === "pack_fijo" && (
          // El texto de ayuda va FUERA del Field: `Field` envuelve a sus
          // hijos en un <label>, así que todo lo que entre ahí se pega al
          // nombre accesible del campo.
          <div>
            <Field label="Precio del pack *">
              <TextInput
                inputMode="numeric"
                value={form.fixedPrice}
                onChange={(e) => setForm({ ...form, fixedPrice: e.target.value })}
                placeholder="65000"
              />
            </Field>
            <p className="mt-1 text-xs text-ink-soft">
              Este pack se cobra a este precio, no al que da la fórmula. Tiene que quedar por
              debajo de la fórmula para seguir siendo un descuento.
            </p>
          </div>
        )}

        <Checkbox
          label="Publicar en la web"
          checked={form.isPublishedWeb}
          onChange={(v) => setForm({ ...form, isPublishedWeb: v })}
        />

        {config && (
          <div className="space-y-2 rounded-xl border border-surface-high p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">
              Pack de sesiones
            </p>

            <div className="space-y-1.5">
              {[
                {
                  propio: false,
                  label: `Usar el pack por defecto (${config.packSesiones} sesiones, ${config.packDescuentoPct}%)`,
                },
                { propio: true, label: "Definir uno para este combo" },
              ].map((opt) => (
                <label key={String(opt.propio)} className="flex items-center gap-2 text-sm text-ink">
                  <input
                    type="radio"
                    name="combo-pack-origen"
                    checked={form.packPropio === opt.propio}
                    onChange={() => setForm({ ...form, packPropio: opt.propio })}
                    className="h-4 w-4 accent-[var(--color-primary)]"
                  />
                  {opt.label}
                </label>
              ))}
            </div>

            {form.packPropio && (
              <div className="flex flex-wrap gap-3 pt-1">
                <Field
                  label="Sesiones"
                  help="Cuántas sesiones trae este pack. El precio parte de multiplicar el total del combo por este número, y recién después se aplica el descuento."
                >
                  <TextInput
                    inputMode="numeric"
                    value={form.packSessions}
                    onChange={(e) => setForm({ ...form, packSessions: e.target.value })}
                  />
                </Field>
                <Field
                  label="Descuento (%)"
                  help="Cuánto se le descuenta por pagar todas las sesiones juntas. Un 0 deja el pack al mismo precio que comprar las sesiones sueltas."
                >
                  <TextInput
                    inputMode="numeric"
                    value={form.packDiscountPercentage}
                    onChange={(e) => setForm({ ...form, packDiscountPercentage: e.target.value })}
                  />
                </Field>
                <Field
                  label="Redondeo ($)"
                  help="El precio del pack se redondea al múltiplo más cercano de este monto, para no cobrar cifras raras. Con 1000, $45.900 se cobra $46.000."
                >
                  <TextInput
                    inputMode="numeric"
                    value={form.packRoundingBase}
                    onChange={(e) => setForm({ ...form, packRoundingBase: e.target.value })}
                  />
                </Field>
              </div>
            )}

            {/* El precio en vivo: sin esto el pack se carga a ciegas y el
                número recién aparece después de guardar. */}
            {previewPack && (
              <div className="rounded-lg bg-surface-low px-3 py-2">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs text-ink">
                    Pack de {previewPack.sesiones} sesiones
                  </span>
                  <span
                    className="font-display text-sm tabular-nums text-ink"
                    data-testid="preview-pack-combo"
                  >
                    {money(previewPack.precio)}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-ink-soft">
                  {previewPack.sesiones} × {money(previewPack.base)} ={" "}
                  {money(previewPack.base * previewPack.sesiones)}, menos {previewPack.descuentoPct}%.{" "}
                  {previewPack.ahorro > 0
                    ? `Ahorra ${money(previewPack.ahorro)}.`
                    : "⚠ Con este descuento el pack cuesta lo mismo que comprar las sesiones sueltas: dejó de ser un pack."}
                </p>
              </div>
            )}
          </div>
        )}

        {tieneZonaArchivadaSeleccionada && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Este combo tiene una zona archivada tildada (marcada abajo). Sacala para poder
            guardar.
          </p>
        )}

        {config && (
          <ArmadorCombo
            zonas={zonasActivas}
            zonasArchivadasIncluidas={zonasArchivadasDelCombo}
            exclusiones={exclusiones}
            config={config}
            packs={packs}
            zonaIdsIniciales={editing ? editing.zonas.map((z) => z.id) : undefined}
            onCambio={setArmadorState}
          />
        )}
      </EntityDrawer>

    </>
  );
}
