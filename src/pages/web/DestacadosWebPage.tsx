import { useState } from "react";
import { Toggle } from "../../components/Toggle";
import { useServices } from "../../hooks/useServices";
import { usePromotions } from "../../hooks/usePromotions";
import { useUpdateService } from "../../hooks/useUpdateService";
import { useUpdatePromotion } from "../../hooks/useUpdatePromotion";
import { useTrainingsAdmin, useUpdateTrainingWeb } from "../../hooks/useTrainingsWeb";

export function DestacadosWebPage() {
  const { data: services = [], isLoading: loadingServices } = useServices();
  const { data: promos = [], isLoading: loadingPromos } = usePromotions();
  const { data: trainings = [], isLoading: loadingTrainings } = useTrainingsAdmin();
  const { mutate: updateService, isPending: updatingService } = useUpdateService();
  const { mutate: updatePromotion, isPending: updatingPromo } = useUpdatePromotion();
  const { mutate: updateTraining, isPending: updatingTraining } = useUpdateTrainingWeb();

  // Inputs de orden controlados localmente (servicios y capacitaciones).
  const [sortInputs, setSortInputs] = useState<Record<string, string>>({});

  const featuredServices = services
    .filter((s) => s.isFeatured)
    .sort((a, b) => (a.webSortOrder ?? 999) - (b.webSortOrder ?? 999));
  const restServices = services
    .filter((s) => !s.isFeatured)
    .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "", "es"));

  const visibleTrainings = trainings.filter((t) => t.isVisible);
  const featuredTrainings = visibleTrainings
    .filter((t) => t.isFeatured)
    .sort((a, b) => (a.webSortOrder ?? 999) - (b.webSortOrder ?? 999));
  const restTrainings = visibleTrainings
    .filter((t) => !t.isFeatured)
    .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "", "es"));

  const handleServiceSort = (id: string, current: number | null) => {
    const raw = sortInputs[id];
    if (raw === undefined) return;
    const val = parseInt(raw, 10);
    if (!isNaN(val) && val !== current) updateService({ id, webSortOrder: val });
  };
  const handleTrainingSort = (id: string, current: number | null) => {
    const raw = sortInputs[id];
    if (raw === undefined) return;
    const val = parseInt(raw, 10);
    if (!isNaN(val) && val !== current) updateTraining({ id, webSortOrder: val });
  };

  return (
    <div className="modal-scroll h-full overflow-y-auto p-2 pl-4 sm:p-4">
      <div className="mx-auto max-w-4xl space-y-10">
        {/* ── Servicios Destacados ─────────────────────────────────── */}
        <section>
          <Header
            title="Servicios Destacados"
            subtitle='Aparecen en la sección "Servicios Destacados" del home. El orden determina su posición.'
          />
          {loadingServices ? (
            <Loading />
          ) : (
            <FeaturedTable>
              {[...featuredServices, ...restServices].map((s) => (
                <tr key={s.id} className={s.isFeatured ? "bg-primary/5" : ""}>
                  <td className="px-4 py-3">
                    <span className="font-medium text-ink">{s.name}</span>
                    {s.categories.length > 0 && (
                      <span className="ml-2 text-xs text-ink-soft">
                        {s.categories.map((c) => c.name).join(", ")}
                      </span>
                    )}
                  </td>
                  <td className="w-28 px-4 py-3">
                    <div className="flex justify-center">
                      <Toggle
                        active={!!s.isFeatured}
                        disabled={updatingService}
                        onChange={(v) => updateService({ id: s.id, isFeatured: v })}
                      />
                    </div>
                  </td>
                  <td className="w-24 px-4 py-3 text-center">
                    <SortInput
                      disabled={!s.isFeatured || updatingService}
                      value={sortInputs[s.id] ?? s.webSortOrder ?? ""}
                      onChange={(v) => setSortInputs((p) => ({ ...p, [s.id]: v }))}
                      onBlur={() => handleServiceSort(s.id, s.webSortOrder)}
                    />
                  </td>
                </tr>
              ))}
            </FeaturedTable>
          )}
        </section>

        {/* ── Promo del Mes ────────────────────────────────────────── */}
        <section>
          <Header
            title="Promo del Mes"
            subtitle='Las promos marcadas como destacadas aparecen en la sección "Promo del Mes" del home.'
          />
          {loadingPromos ? (
            <Loading />
          ) : promos.length === 0 ? (
            <p className="text-sm text-ink-soft">No hay promociones activas.</p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-surface-high">
              <table className="w-full text-sm">
                <thead className="bg-surface-high text-xs uppercase tracking-wider text-ink-soft">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Promoción</th>
                    <th className="px-4 py-3 text-left font-medium">Vigencia</th>
                    <th className="w-28 px-4 py-3 text-center font-medium">Destacada</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-high">
                  {[...promos]
                    .sort((a, b) => Number(!!b.isFeatured) - Number(!!a.isFeatured))
                    .map((promo) => (
                      <tr key={promo.id} className={promo.isFeatured ? "bg-primary/5" : ""}>
                        <td className="px-4 py-3">
                          <span className="font-medium text-ink">{promo.name}</span>
                          {promo.services.length > 0 && (
                            <span className="ml-2 text-xs text-ink-soft">
                              {promo.services.length} servicio
                              {promo.services.length !== 1 ? "s" : ""}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-ink-soft">
                          {promo.validUntil
                            ? `hasta ${new Date(promo.validUntil).toLocaleDateString("es-AR", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })}`
                            : "Sin vencimiento"}
                        </td>
                        <td className="w-28 px-4 py-3">
                          <div className="flex justify-center">
                            <Toggle
                              active={!!promo.isFeatured}
                              disabled={updatingPromo}
                              onChange={(v) => updatePromotion({ id: promo.id, isFeatured: v })}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ── Capacitaciones Destacadas ────────────────────────────── */}
        <section>
          <Header
            title="Capacitaciones Destacadas"
            subtitle="Aparecen destacadas en el home. Solo se listan las capacitaciones visibles."
          />
          {loadingTrainings ? (
            <Loading />
          ) : visibleTrainings.length === 0 ? (
            <p className="text-sm text-ink-soft">No hay capacitaciones visibles.</p>
          ) : (
            <FeaturedTable label="Capacitación">
              {[...featuredTrainings, ...restTrainings].map((t) => (
                <tr key={t.id} className={t.isFeatured ? "bg-primary/5" : ""}>
                  <td className="px-4 py-3 font-medium text-ink">{t.name}</td>
                  <td className="w-28 px-4 py-3">
                    <div className="flex justify-center">
                      <Toggle
                        active={!!t.isFeatured}
                        disabled={updatingTraining}
                        onChange={(v) => updateTraining({ id: t.id, isFeatured: v })}
                      />
                    </div>
                  </td>
                  <td className="w-24 px-4 py-3 text-center">
                    <SortInput
                      disabled={!t.isFeatured || updatingTraining}
                      value={sortInputs[t.id] ?? t.webSortOrder ?? ""}
                      onChange={(v) => setSortInputs((p) => ({ ...p, [t.id]: v }))}
                      onBlur={() => handleTrainingSort(t.id, t.webSortOrder)}
                    />
                  </td>
                </tr>
              ))}
            </FeaturedTable>
          )}
        </section>
      </div>
    </div>
  );
}

function Header({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-3">
      <h2 className="font-display text-lg text-ink">{title}</h2>
      <p className="mt-0.5 text-xs text-ink-soft">{subtitle}</p>
    </div>
  );
}

function Loading() {
  return <p className="text-sm text-ink-soft">Cargando…</p>;
}

function FeaturedTable({ children, label = "Servicio" }: { children: React.ReactNode; label?: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-surface-high">
      <table className="w-full text-sm">
        <thead className="bg-surface-high text-xs uppercase tracking-wider text-ink-soft">
          <tr>
            <th className="px-4 py-3 text-left font-medium">{label}</th>
            <th className="w-28 px-4 py-3 text-center font-medium">Destacado</th>
            <th className="w-24 px-4 py-3 text-center font-medium">Orden</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-high">{children}</tbody>
      </table>
    </div>
  );
}

function SortInput({
  disabled,
  value,
  onChange,
  onBlur,
}: {
  disabled: boolean;
  value: string | number;
  onChange: (v: string) => void;
  onBlur: () => void;
}) {
  return (
    <input
      type="number"
      min={1}
      disabled={disabled}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      placeholder="—"
      className="w-16 rounded border border-surface-highest px-2 py-1 text-center text-sm focus:border-primary focus:outline-none disabled:cursor-not-allowed disabled:opacity-30"
    />
  );
}
