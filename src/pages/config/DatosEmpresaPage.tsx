import { useState } from "react";
import { Field, TextInput } from "../../components/form";
import { Toggle } from "../../components/Toggle";
import { useToast } from "../../components/ui/Toast";
import type { CompanyConfig } from "../../lib/api-types";
import {
  useCompanyConfig,
  useUpdateCompanyConfig,
  useUpdateOpenHours,
  type OpenHourInput,
} from "../../hooks/useCompanyConfig";

const DAYS = [
  { dow: 1, label: "Lunes" },
  { dow: 2, label: "Martes" },
  { dow: 3, label: "Miércoles" },
  { dow: 4, label: "Jueves" },
  { dow: 5, label: "Viernes" },
  { dow: 6, label: "Sábado" },
  { dow: 0, label: "Domingo" },
];

export function DatosEmpresaPage() {
  const { data, isLoading, error } = useCompanyConfig();

  return (
    <div className="modal-scroll h-full overflow-y-auto p-2 pl-4 sm:p-4">
      <div className="mx-auto max-w-2xl">
        {isLoading ? (
          <p className="text-sm text-ink-soft">Cargando…</p>
        ) : error || !data ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
            {error ? (error as Error).message : "No se pudo cargar la configuración."}
          </p>
        ) : (
          <EmpresaForm config={data} />
        )}
      </div>
    </div>
  );
}

type DayState = { isOpen: boolean; open: string; close: string };

function EmpresaForm({ config }: { config: CompanyConfig }) {
  const toast = useToast();
  const updateConfig = useUpdateCompanyConfig();
  const updateHours = useUpdateOpenHours();

  const [form, setForm] = useState(() => ({
    companyName: config.companyName ?? "",
    address: config.address ?? "",
    phone: config.phone ?? "",
    email: config.email ?? "",
    whatsapp: config.whatsapp ?? "",
    instagram: config.instagram ?? "",
    facebook: config.facebook ?? "",
    website: config.website ?? "",
  }));

  const [hours, setHours] = useState<Record<number, DayState>>(() => {
    const map: Record<number, DayState> = {};
    for (const d of DAYS) {
      const row = config.openHours.find((h) => h.dayOfWeek === d.dow);
      map[d.dow] = {
        isOpen: row?.isOpen ?? false,
        open: row?.openingTime ? row.openingTime.slice(0, 5) : "",
        close: row?.closingTime ? row.closingTime.slice(0, 5) : "",
      };
    }
    return map;
  });

  const saving = updateConfig.isPending || updateHours.isPending;

  async function save() {
    try {
      await updateConfig.mutateAsync({
        companyName: form.companyName.trim() || null,
        address: form.address.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        whatsapp: form.whatsapp.trim() || null,
        instagram: form.instagram.trim() || null,
        facebook: form.facebook.trim() || null,
        website: form.website.trim() || null,
      });
      const days: OpenHourInput[] = DAYS.map((d) => {
        const s = hours[d.dow];
        return {
          dayOfWeek: d.dow,
          isOpen: s.isOpen,
          openingTime: s.isOpen && s.open ? s.open : null,
          closingTime: s.isOpen && s.close ? s.close : null,
        };
      });
      await updateHours.mutateAsync(days);
      toast.success("Datos guardados");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <form
      className="space-y-8"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <section className="space-y-4">
        <h2 className="font-display text-lg text-ink">Empresa y contacto</h2>
        <Field label="Razón social / Nombre">
          <TextInput
            value={form.companyName}
            onChange={(e) => setForm({ ...form, companyName: e.target.value })}
          />
        </Field>
        <Field label="Dirección">
          <TextInput
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
        </Field>
        <div className="flex gap-3">
          <Field label="Teléfono">
            <TextInput
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </Field>
          <Field label="WhatsApp">
            <TextInput
              value={form.whatsapp}
              onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
            />
          </Field>
        </div>
        <Field label="Email">
          <TextInput
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </Field>
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-lg text-ink">Redes</h2>
        <div className="flex gap-3">
          <Field label="Instagram">
            <TextInput
              value={form.instagram}
              onChange={(e) => setForm({ ...form, instagram: e.target.value })}
              placeholder="@piubella"
            />
          </Field>
          <Field label="Facebook">
            <TextInput
              value={form.facebook}
              onChange={(e) => setForm({ ...form, facebook: e.target.value })}
            />
          </Field>
        </div>
        <Field label="Sitio web">
          <TextInput
            value={form.website}
            onChange={(e) => setForm({ ...form, website: e.target.value })}
            placeholder="https://…"
          />
        </Field>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="font-display text-lg text-ink">Horarios de atención</h2>
          <p className="mt-0.5 text-xs text-ink-soft">
            Usados para validar turnos y mostrar en la web.
          </p>
        </div>
        <div className="overflow-hidden rounded-xl border border-surface-high">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-surface-high">
              {DAYS.map((d) => {
                const s = hours[d.dow];
                return (
                  <tr key={d.dow}>
                    <td className="px-4 py-3 font-medium text-ink">{d.label}</td>
                    <td className="px-2 py-3">
                      <div className="flex items-center justify-center">
                        <Toggle
                          active={s.isOpen}
                          onChange={(v) =>
                            setHours((p) => ({ ...p, [d.dow]: { ...p[d.dow], isOpen: v } }))
                          }
                          label={s.isOpen ? "Cerrar" : "Abrir"}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <input
                          type="time"
                          value={s.open}
                          disabled={!s.isOpen}
                          onChange={(e) =>
                            setHours((p) => ({
                              ...p,
                              [d.dow]: { ...p[d.dow], open: e.target.value },
                            }))
                          }
                          className="rounded border border-surface-highest px-2 py-1 text-sm focus:border-primary focus:outline-none disabled:opacity-30"
                        />
                        <span className="text-ink-soft">a</span>
                        <input
                          type="time"
                          value={s.close}
                          disabled={!s.isOpen}
                          onChange={(e) =>
                            setHours((p) => ({
                              ...p,
                              [d.dow]: { ...p[d.dow], close: e.target.value },
                            }))
                          }
                          className="rounded border border-surface-highest px-2 py-1 text-sm focus:border-primary focus:outline-none disabled:opacity-30"
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
        >
          {saving ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
}
