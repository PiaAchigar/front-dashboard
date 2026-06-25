import { useState } from "react";
import { Field, TextArea, TextInput } from "../../components/form";
import { useToast } from "../../components/ui/Toast";
import type { CompanyConfig } from "../../lib/api-types";
import {
  useCompanyConfig,
  useUpdateCompanyConfig,
  type CompanyConfigPatch,
} from "../../hooks/useCompanyConfig";

export function TextosWebPage() {
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
          <TextosForm config={data} />
        )}
      </div>
    </div>
  );
}

type Form = {
  heroTitle: string;
  heroSubtitle: string;
  companyDescription: string;
  aboutUs: string;
};

function TextosForm({ config }: { config: CompanyConfig }) {
  const toast = useToast();
  const update = useUpdateCompanyConfig();

  const [form, setForm] = useState<Form>(() => ({
    heroTitle: config.heroTitle ?? "",
    heroSubtitle: config.heroSubtitle ?? "",
    companyDescription: config.companyDescription ?? "",
    aboutUs: config.aboutUs ?? "",
  }));

  function save() {
    const patch: CompanyConfigPatch = {
      heroTitle: form.heroTitle.trim() || null,
      heroSubtitle: form.heroSubtitle.trim() || null,
      companyDescription: form.companyDescription.trim() || null,
      aboutUs: form.aboutUs.trim() || null,
    };
    update.mutate(patch, {
      onSuccess: () => toast.success("Textos guardados"),
      onError: (e: Error) => toast.error(e.message),
    });
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
        <div>
          <h2 className="font-display text-lg text-ink">Inicio</h2>
          <p className="mt-0.5 text-xs text-ink-soft">Textos del encabezado del home.</p>
        </div>
        <Field label="Título principal (hero)">
          <TextInput
            value={form.heroTitle}
            onChange={(e) => setForm({ ...form, heroTitle: e.target.value })}
            placeholder="Ej: Tu belleza, nuestra pasión"
          />
        </Field>
        <Field label="Subtítulo (hero)">
          <TextArea
            rows={2}
            value={form.heroSubtitle}
            onChange={(e) => setForm({ ...form, heroSubtitle: e.target.value })}
          />
        </Field>
        <Field label="Descripción corta de la empresa">
          <TextArea
            rows={2}
            value={form.companyDescription}
            onChange={(e) => setForm({ ...form, companyDescription: e.target.value })}
          />
        </Field>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="font-display text-lg text-ink">Nosotros</h2>
          <p className="mt-0.5 text-xs text-ink-soft">Texto largo de la página "Nosotros".</p>
        </div>
        <Field label="Sobre nosotros">
          <TextArea
            rows={6}
            value={form.aboutUs}
            onChange={(e) => setForm({ ...form, aboutUs: e.target.value })}
          />
        </Field>
      </section>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={update.isPending}
          className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
        >
          {update.isPending ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
}
