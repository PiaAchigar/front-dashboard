import { useState } from "react";
import { useServices } from "../hooks/useServices";
import { usePromotions } from "../hooks/usePromotions";
import { useUpdateService } from "../hooks/useUpdateService";
import { useUpdatePromotion } from "../hooks/useUpdatePromotion";

function Toggle({
  active,
  onChange,
  disabled,
}: {
  active: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={() => onChange(!active)}
      disabled={disabled}
      className={`w-10 h-6 rounded-full relative transition-colors flex-shrink-0 ${
        active ? "bg-primary" : "bg-outline-variant"
      } disabled:opacity-40`}
      aria-label={active ? "Quitar destacado" : "Marcar como destacado"}
    >
      <span
        className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${
          active ? "translate-x-5" : "translate-x-1"
        }`}
      />
    </button>
  );
}

export function ServiciosWebPage() {
  const { data: services = [], isLoading: loadingServices } = useServices();
  const { data: promos = [], isLoading: loadingPromos } = usePromotions();
  const { mutate: updateService, isPending: updatingService } = useUpdateService();
  const { mutate: updatePromotion, isPending: updatingPromo } = useUpdatePromotion();
  const [sortInputs, setSortInputs] = useState<Record<string, string>>({});

  const featuredServices = services
    .filter((s) => s.isFeatured)
    .sort((a, b) => (a.webSortOrder ?? 999) - (b.webSortOrder ?? 999));
  const restServices = services
    .filter((s) => !s.isFeatured)
    .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "", "es"));

  const handleSortBlur = (id: string, current: number | null) => {
    const raw = sortInputs[id];
    if (raw === undefined) return;
    const val = parseInt(raw, 10);
    if (!isNaN(val) && val !== current) {
      updateService({ id, webSortOrder: val });
    }
  };

  return (
    <div className="p-8 max-w-4xl space-y-12">
      <div>
        <h1 className="text-2xl font-display text-on-surface">Sitio Web</h1>
        <p className="text-sm text-muted mt-1">
          Gestioná qué contenido se destaca en la página principal de PiuBella.
        </p>
      </div>

      {/* ── Servicios Destacados ─────────────────────────────────────── */}
      <section>
        <div className="mb-4">
          <h2 className="text-lg font-display text-on-surface">Servicios Destacados</h2>
          <p className="text-xs text-muted mt-0.5">
            Aparecen en la sección "Servicios Destacados" del home. El orden determina su posición.
          </p>
        </div>

        {loadingServices ? (
          <p className="text-sm text-muted">Cargando servicios...</p>
        ) : (
          <div className="rounded-xl border border-outline-variant overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-surface-container-low text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-4 py-3 text-left">Servicio</th>
                  <th className="px-4 py-3 text-center w-32">Destacado</th>
                  <th className="px-4 py-3 text-center w-28">Orden</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/30">
                {[...featuredServices, ...restServices].map((service) => (
                  <tr key={service.id} className={service.isFeatured ? "bg-primary/5" : ""}>
                    <td className="px-4 py-3">
                      <span className="font-medium text-on-surface">{service.name}</span>
                      {service.categories.length > 0 && (
                        <span className="ml-2 text-xs text-muted">
                          {service.categories.map((c) => c.name).join(", ")}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 flex justify-center">
                      <Toggle
                        active={!!service.isFeatured}
                        onChange={(v) => updateService({ id: service.id, isFeatured: v })}
                        disabled={updatingService}
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <input
                        type="number"
                        min={1}
                        disabled={!service.isFeatured || updatingService}
                        value={sortInputs[service.id] ?? service.webSortOrder ?? ""}
                        onChange={(e) =>
                          setSortInputs((prev) => ({ ...prev, [service.id]: e.target.value }))
                        }
                        onBlur={() => handleSortBlur(service.id, service.webSortOrder)}
                        className="w-16 text-center border border-outline-variant rounded px-2 py-1 text-sm disabled:opacity-30 disabled:cursor-not-allowed focus:outline-none focus:border-primary"
                        placeholder="—"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Promos del Mes ───────────────────────────────────────────── */}
      <section>
        <div className="mb-4">
          <h2 className="text-lg font-display text-on-surface">Promo del Mes</h2>
          <p className="text-xs text-muted mt-0.5">
            Las promos marcadas como destacadas aparecen en la sección "Promo del Mes" del home.
          </p>
        </div>

        {loadingPromos ? (
          <p className="text-sm text-muted">Cargando promociones...</p>
        ) : promos.length === 0 ? (
          <p className="text-sm text-muted">No hay promociones activas.</p>
        ) : (
          <div className="rounded-xl border border-outline-variant overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-surface-container-low text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-4 py-3 text-left">Promoción</th>
                  <th className="px-4 py-3 text-left">Vigencia</th>
                  <th className="px-4 py-3 text-center w-32">Destacada</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/30">
                {promos
                  .sort((a, b) => Number(!!b.isFeatured) - Number(!!a.isFeatured))
                  .map((promo) => (
                    <tr key={promo.id} className={promo.isFeatured ? "bg-primary/5" : ""}>
                      <td className="px-4 py-3">
                        <span className="font-medium text-on-surface">{promo.name}</span>
                        {promo.services.length > 0 && (
                          <span className="ml-2 text-xs text-muted">
                            {promo.services.length} servicio{promo.services.length !== 1 ? "s" : ""}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {promo.validUntil
                          ? `hasta ${new Date(promo.validUntil).toLocaleDateString("es-AR", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}`
                          : "Sin vencimiento"}
                      </td>
                      <td className="px-4 py-3 flex justify-center">
                        <Toggle
                          active={!!promo.isFeatured}
                          onChange={(v) =>
                            updatePromotion({ id: promo.id, isFeatured: v })
                          }
                          disabled={updatingPromo}
                        />
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
