import { useState } from "react";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { EntityDrawer } from "../../components/EntityDrawer";
import { Checkbox, Field, Select, TextArea, TextInput } from "../../components/form";
import { Plus, Trash } from "../../components/icons";
import { useToast } from "../../components/ui/Toast";
import {
  useCreateIssuer,
  useDeactivateIssuer,
  useIssuers,
  useUpdateIssuer,
  type Issuer,
  type IssuerInput,
} from "../../hooks/useIssuers";

const EMPTY: IssuerInput = {
  name: "",
  cuit: "",
  sdkToken: "",
  cert: "",
  key: "",
  environment: "homo",
  pointOfSale: 1,
  invoiceType: "C",
  isDefault: false,
  notes: "",
};

/**
 * Facturadores ARCA: cada persona/razón social factura con su propio CUIT,
 * certificado y punto de venta. El que está marcado por defecto es el que
 * viene preseleccionado en la cobranza.
 *
 * Las credenciales se guardan cifradas y no se pueden volver a leer: al editar
 * se dejan vacías para conservarlas, o se pegan de nuevo para reemplazarlas.
 */
export function FacturadoresPage() {
  const toast = useToast();
  const { data: issuers = [], isLoading, error } = useIssuers();
  const create = useCreateIssuer();
  const update = useUpdateIssuer();
  const deactivate = useDeactivateIssuer();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Issuer | null>(null);
  const [form, setForm] = useState<IssuerInput>(EMPTY);
  const [formError, setFormError] = useState<string | null>(null);
  const [toDeactivate, setToDeactivate] = useState<Issuer | null>(null);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setFormError(null);
    setDrawerOpen(true);
  }

  function openEdit(issuer: Issuer) {
    setEditing(issuer);
    setForm({
      ...EMPTY,
      name: issuer.name ?? "",
      cuit: issuer.cuit ?? "",
      environment: issuer.environment ?? "homo",
      pointOfSale: issuer.pointOfSale ?? 1,
      invoiceType: (issuer.invoiceType as IssuerInput["invoiceType"]) ?? "C",
      isDefault: issuer.isDefault ?? false,
      notes: issuer.notes ?? "",
    });
    setFormError(null);
    setDrawerOpen(true);
  }

  function save() {
    setFormError(null);
    const onError = (e: Error) => setFormError(e.message);

    if (editing) {
      // Los secretos vacíos NO se mandan: así se conservan los ya guardados.
      update.mutate(
        {
          id: editing.id,
          name: form.name,
          cuit: form.cuit,
          environment: form.environment,
          pointOfSale: form.pointOfSale,
          invoiceType: form.invoiceType,
          isDefault: form.isDefault,
          notes: form.notes || undefined,
          ...(form.sdkToken ? { sdkToken: form.sdkToken } : {}),
          ...(form.cert ? { cert: form.cert } : {}),
          ...(form.key ? { key: form.key } : {}),
        },
        {
          onSuccess: () => {
            toast.success("Facturador actualizado");
            setDrawerOpen(false);
          },
          onError,
        },
      );
      return;
    }

    create.mutate(form, {
      onSuccess: () => {
        toast.success("Facturador creado");
        setDrawerOpen(false);
      },
      onError,
    });
  }

  const canSubmit = editing
    ? form.name.trim().length >= 2 && /^\d{11}$/.test(form.cuit)
    : form.name.trim().length >= 2 &&
      /^\d{11}$/.test(form.cuit) &&
      form.sdkToken.length > 10 &&
      form.cert.length > 40 &&
      form.key.length > 40;

  if (error) {
    return (
      <div className="p-4">
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {(error as Error).message}
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3 p-2 pl-4 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl text-ink">Facturadores ARCA</h2>
          <p className="text-xs text-ink-soft">
            Cada uno factura con su propio CUIT, certificado y numeración. El predeterminado
            viene preseleccionado en la cobranza.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark"
        >
          <Plus size={16} />
          Agregar
        </button>
      </div>

      <div className="modal-scroll min-h-0 flex-1 overflow-auto rounded-xl border border-surface-high">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-surface-high text-xs uppercase tracking-wider text-ink-soft">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Nombre</th>
              <th className="px-4 py-3 text-left font-medium">CUIT</th>
              <th className="px-4 py-3 text-left font-medium">Ambiente</th>
              <th className="px-4 py-3 text-left font-medium">Pto. venta</th>
              <th className="px-4 py-3 text-left font-medium">Comprobante</th>
              <th className="px-4 py-3 text-left font-medium">Estado</th>
              <th className="px-4 py-3 text-right font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-high">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-ink-soft">
                  Cargando…
                </td>
              </tr>
            ) : issuers.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-ink-soft">
                  No hay facturadores cargados.
                </td>
              </tr>
            ) : (
              issuers.map((i) => (
                <tr key={i.id} className={i.isActive === false ? "opacity-50" : undefined}>
                  <td className="px-4 py-3 font-medium text-ink">
                    <button onClick={() => openEdit(i)} className="hover:underline">
                      {i.name}
                    </button>
                    {i.isDefault && (
                      <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                        por defecto
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-ink-soft">{i.cuit}</td>
                  <td className="px-4 py-3">
                    {i.environment === "prod" ? (
                      <span className="font-medium text-green-700">Producción</span>
                    ) : (
                      <span className="text-amber-700">Homologación</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-ink-soft">
                    {String(i.pointOfSale ?? "").padStart(4, "0")}
                  </td>
                  <td className="px-4 py-3 text-ink-soft">Factura {i.invoiceType}</td>
                  <td className="px-4 py-3 text-ink-soft">
                    {i.isActive === false ? "Inactivo" : "Activo"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      {!i.isDefault && i.isActive !== false && (
                        <button
                          onClick={() =>
                            update.mutate(
                              { id: i.id, isDefault: true },
                              {
                                onSuccess: () => toast.success(`"${i.name}" es el predeterminado`),
                                onError: (e: Error) => toast.error(e.message),
                              },
                            )
                          }
                          className="rounded px-2 py-1 text-xs text-ink-soft transition-colors hover:bg-surface-high hover:text-primary"
                        >
                          Hacer predeterminado
                        </button>
                      )}
                      {i.isActive !== false && !i.isDefault && (
                        <button
                          onClick={() => setToDeactivate(i)}
                          title="Dar de baja"
                          className="rounded p-1.5 text-ink-soft transition-colors hover:bg-surface-high hover:text-red-700"
                        >
                          <Trash size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <EntityDrawer
        open={drawerOpen}
        title={editing ? `Editar ${editing.name}` : "Nuevo facturador"}
        error={formError}
        busy={create.isPending || update.isPending}
        canSubmit={canSubmit}
        submitLabel={editing ? "Guardar cambios" : "Crear facturador"}
        onSubmit={save}
        onClose={() => setDrawerOpen(false)}
      >
        <Field label="Nombre * (es el que se ve en el selector de cobranza)">
          <TextInput
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Ej: Gastón"
            autoFocus
          />
        </Field>
        <Field label="CUIT * (11 dígitos, sin guiones)">
          <TextInput
            value={form.cuit}
            onChange={(e) => setForm({ ...form, cuit: e.target.value.replace(/\D/g, "") })}
            placeholder="20123456789"
          />
        </Field>
        <Field label="Ambiente">
          <Select
            value={form.environment}
            onChange={(e) =>
              setForm({ ...form, environment: e.target.value as IssuerInput["environment"] })
            }
          >
            <option value="homo">Homologación (pruebas)</option>
            <option value="prod">Producción (comprobantes reales)</option>
          </Select>
        </Field>
        <div className="flex gap-3">
          <Field label="Punto de venta">
            <TextInput
              type="number"
              min={1}
              value={form.pointOfSale}
              onChange={(e) => setForm({ ...form, pointOfSale: Number(e.target.value) })}
            />
          </Field>
          <Field label="Comprobante">
            <Select
              value={form.invoiceType}
              onChange={(e) =>
                setForm({ ...form, invoiceType: e.target.value as IssuerInput["invoiceType"] })
              }
            >
              <option value="C">Factura C (monotributo)</option>
              <option value="B">Factura B</option>
              <option value="A">Factura A</option>
            </Select>
          </Field>
        </div>

        <div className="rounded-lg bg-surface-high px-3 py-2 text-xs text-ink-soft">
          {editing
            ? "Las credenciales guardadas no se pueden ver. Dejá estos campos vacíos para conservarlas, o pegá las nuevas para reemplazarlas."
            : "Se guardan cifradas: una vez cargadas no se pueden volver a leer, solo reemplazar."}
        </div>

        <Field label={editing ? "Token de Afip SDK (opcional)" : "Token de Afip SDK *"}>
          <TextInput
            value={form.sdkToken}
            onChange={(e) => setForm({ ...form, sdkToken: e.target.value })}
            placeholder={editing ? "Dejar vacío para conservar el actual" : "Token de app.afipsdk.com"}
          />
        </Field>
        <Field label={editing ? "Certificado .crt (opcional)" : "Certificado .crt *"}>
          <TextArea
            rows={4}
            value={form.cert}
            onChange={(e) => setForm({ ...form, cert: e.target.value })}
            placeholder={editing ? "Dejar vacío para conservar el actual" : "-----BEGIN CERTIFICATE-----"}
          />
        </Field>
        <Field label={editing ? "Clave privada .key (opcional)" : "Clave privada .key *"}>
          <TextArea
            rows={4}
            value={form.key}
            onChange={(e) => setForm({ ...form, key: e.target.value })}
            placeholder={editing ? "Dejar vacío para conservar la actual" : "-----BEGIN PRIVATE KEY-----"}
          />
        </Field>

        <Field label="Notas">
          <TextArea
            rows={2}
            value={form.notes ?? ""}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </Field>
        <Checkbox
          checked={form.isDefault}
          onChange={(v) => setForm({ ...form, isDefault: v })}
          label="Usar como facturador predeterminado en la cobranza"
        />
      </EntityDrawer>

      <ConfirmDialog
        open={Boolean(toDeactivate)}
        title="Dar de baja el facturador"
        danger
        confirmLabel="Dar de baja"
        busy={deactivate.isPending}
        message={
          <>
            <strong>{toDeactivate?.name}</strong> deja de aparecer en el selector de cobranza.
            Las facturas ya emitidas con este CUIT se conservan intactas.
          </>
        }
        onCancel={() => setToDeactivate(null)}
        onConfirm={() =>
          toDeactivate &&
          deactivate.mutate(toDeactivate.id, {
            onSuccess: () => {
              toast.success("Facturador dado de baja");
              setToDeactivate(null);
            },
            onError: (e: Error) => {
              toast.error(e.message);
              setToDeactivate(null);
            },
          })
        }
      />
    </div>
  );
}
