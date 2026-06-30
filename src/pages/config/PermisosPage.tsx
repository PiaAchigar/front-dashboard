import { PERMISSIONS, levelFor, type Section } from "../../lib/permissions";
import { ROLE_LABELS, ROLE_ORDER, SECTION_LABELS } from "../../lib/roles";

const LEVEL_HELP = "F = completo (crear/editar/archivar) · E = editar · V = ver · – = sin acceso";

export function PermisosPage() {
  const sections = Object.keys(PERMISSIONS) as Section[];
  return (
    <div className="modal-scroll h-full overflow-y-auto p-4 sm:p-6">
      <div className="mx-auto max-w-3xl space-y-3">
        <div>
          <h2 className="font-display text-xl text-ink">Permisos por rol</h2>
          <p className="mt-1 text-xs text-ink-soft">{LEVEL_HELP}</p>
        </div>
        <div className="overflow-x-auto rounded-xl border border-surface-high">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-high bg-surface-low">
                <th className="px-3 py-2 text-left font-medium text-ink-soft">Sección</th>
                {ROLE_ORDER.map((r) => (
                  <th key={r} className="px-3 py-2 text-center font-medium text-ink-soft">
                    {ROLE_LABELS[r]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sections.map((s) => (
                <tr key={s} className="border-b border-surface-high last:border-0">
                  <td className="px-3 py-2 text-ink">{SECTION_LABELS[s]}</td>
                  {ROLE_ORDER.map((r) => (
                    <td key={r} className="px-3 py-2 text-center text-ink-soft">
                      {levelFor(s, r)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
