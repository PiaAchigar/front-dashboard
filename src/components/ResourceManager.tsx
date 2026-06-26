import { useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { ConfirmDialog } from "./ConfirmDialog";
import { Archive, Pencil, Plus, RotateCcw, Search } from "./icons";

export type Column<T> = {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  /** Ancho inicial en px (el usuario puede redimensionar y se persiste). */
  width?: number;
  /** Clase extra para la celda (ej: alineación). */
  className?: string;
};

const DEFAULT_WIDTH = 180;
const MIN_WIDTH = 60;
const ACTIONS_WIDTH = 96;

function storageKey(title: string) {
  return `rm-colwidths:${title}`;
}

function loadWidths<T>(title: string, columns: Column<T>[]): Record<string, number> {
  const defaults: Record<string, number> = {};
  for (const c of columns) defaults[c.key] = c.width ?? DEFAULT_WIDTH;
  try {
    const raw = localStorage.getItem(storageKey(title));
    if (raw) return { ...defaults, ...(JSON.parse(raw) as Record<string, number>) };
  } catch {
    /* ignore */
  }
  return defaults;
}

type Props<T> = {
  title: string;
  rows: T[];
  columns: Column<T>[];
  loading?: boolean;
  error?: string | null;
  rowKey: (row: T) => string;
  isArchived: (row: T) => boolean;

  search: string;
  onSearch: (v: string) => void;
  searchPlaceholder?: string;

  showArchived: boolean;
  onToggleArchived: (v: boolean) => void;

  canCreate?: boolean;
  canArchive?: boolean;

  onAdd?: () => void;
  onEdit?: (row: T) => void;
  onArchive?: (row: T) => void;
  onRestore?: (row: T) => void;
  archiving?: boolean;

  archiveName?: (row: T) => string;
  /** Acciones extra por fila (ej. "Mantenimientos"), antes de Editar/Archivar. */
  rowActions?: (row: T) => ReactNode;
};

export function ResourceManager<T>({
  title,
  rows,
  columns,
  loading = false,
  error = null,
  rowKey,
  isArchived,
  search,
  onSearch,
  searchPlaceholder = "Buscar…",
  showArchived,
  onToggleArchived,
  canCreate = false,
  canArchive = false,
  onAdd,
  onEdit,
  onArchive,
  onRestore,
  archiving = false,
  archiveName,
  rowActions,
}: Props<T>) {
  const [toArchive, setToArchive] = useState<T | null>(null);
  const [widths, setWidths] = useState<Record<string, number>>(() => loadWidths(title, columns));
  const [resizing, setResizing] = useState(false);

  // Archivados: mostrar SOLO los archivados; Activos: SOLO los activos.
  // isArchived es estricto (isActive===false / status==='inactive'), así que los
  // registros legacy con el flag en null caen como "activos".
  const visibleRows = rows.filter((r) => isArchived(r) === showArchived);

  const showActions = Boolean(rowActions || onEdit || (canArchive && (onArchive || onRestore)));
  const colWidth = (key: string) => widths[key] ?? DEFAULT_WIDTH;
  const totalWidth =
    columns.reduce((acc, c) => acc + colWidth(c.key), 0) + (showActions ? ACTIONS_WIDTH : 0);

  function startResize(e: ReactPointerEvent, key: string) {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startW = colWidth(key);
    setResizing(true);

    const onMove = (ev: PointerEvent) => {
      const next = Math.max(MIN_WIDTH, startW + (ev.clientX - startX));
      setWidths((prev) => ({ ...prev, [key]: next }));
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setResizing(false);
      setWidths((prev) => {
        try {
          localStorage.setItem(storageKey(title), JSON.stringify(prev));
        } catch {
          /* ignore */
        }
        return prev;
      });
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  return (
    <div className="flex h-full flex-col gap-3 p-2 pl-4 sm:p-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl text-ink">{title}</h2>
        {canCreate && onAdd && (
          <button
            onClick={onAdd}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark"
          >
            <Plus size={16} />
            Agregar
          </button>
        )}
      </div>

      {/* Toolbar: búsqueda + toggle activos/archivados */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full rounded-lg border border-surface-highest bg-white py-2 pl-9 pr-3 text-sm text-ink outline-none focus:border-primary"
          />
        </div>
        <div className="flex overflow-hidden rounded-lg border border-surface-highest text-sm">
          {[
            { v: false, label: "Activos" },
            { v: true, label: "Archivados" },
          ].map((opt) => (
            <button
              key={opt.label}
              onClick={() => onToggleArchived(opt.v)}
              className={`px-3 py-2 transition-colors ${
                showArchived === opt.v
                  ? "bg-primary font-medium text-white"
                  : "bg-white text-ink-soft hover:bg-surface-high"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}

      {/* Tabla con columnas redimensionables */}
      <div
        className={`modal-scroll min-h-0 flex-1 overflow-auto rounded-xl border border-surface-high ${
          resizing ? "cursor-col-resize select-none" : ""
        }`}
      >
        <table className="text-sm" style={{ tableLayout: "fixed", width: "100%", minWidth: totalWidth }}>
          <colgroup>
            {columns.map((c) => (
              <col key={c.key} style={{ width: colWidth(c.key) }} />
            ))}
            {showActions && <col style={{ width: ACTIONS_WIDTH }} />}
          </colgroup>

          <thead className="sticky top-0 z-10 text-xs uppercase tracking-wider text-ink-soft">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`relative select-none border-b border-surface-highest bg-surface-high px-4 py-3 text-left font-medium ${col.className ?? ""}`}
                >
                  <span className="block truncate pr-2">{col.header}</span>
                  <span
                    onPointerDown={(e) => startResize(e, col.key)}
                    className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-primary/40"
                    title="Arrastrá para ajustar el ancho"
                  />
                </th>
              ))}
              {showActions && (
                <th className="border-b border-surface-highest bg-surface-high px-4 py-3 text-right font-medium">
                  Acciones
                </th>
              )}
            </tr>
          </thead>

          <tbody className="divide-y divide-surface-high">
            {loading ? (
              <tr>
                <td colSpan={columns.length + 1} className="px-4 py-10 text-center text-ink-soft">
                  Cargando…
                </td>
              </tr>
            ) : visibleRows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 1} className="px-4 py-10 text-center text-ink-soft">
                  {showArchived ? "No hay elementos archivados." : "No hay elementos."}
                </td>
              </tr>
            ) : (
              visibleRows.map((row) => {
                const archived = isArchived(row);
                return (
                  <tr key={rowKey(row)} className={archived ? "opacity-60" : ""}>
                    {columns.map((col) => (
                      <td key={col.key} className="overflow-hidden px-4 py-3 text-ink">
                        <div className={`truncate ${col.className ?? ""}`}>{col.render(row)}</div>
                      </td>
                    ))}
                    {showActions && (
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          {rowActions && rowActions(row)}
                          {onEdit && !archived && (
                            <button
                              onClick={() => onEdit(row)}
                              title="Editar"
                              className="rounded p-1.5 text-ink-soft transition-colors hover:bg-surface-high hover:text-primary"
                            >
                              <Pencil size={16} />
                            </button>
                          )}
                          {canArchive && !archived && onArchive && (
                            <button
                              onClick={() => setToArchive(row)}
                              title="Archivar"
                              className="rounded p-1.5 text-ink-soft transition-colors hover:bg-surface-high hover:text-red-700"
                            >
                              <Archive size={16} />
                            </button>
                          )}
                          {canArchive && archived && onRestore && (
                            <button
                              onClick={() => onRestore(row)}
                              title="Restaurar"
                              className="rounded p-1.5 text-ink-soft transition-colors hover:bg-surface-high hover:text-primary"
                            >
                              <RotateCcw size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Confirmación de archivado */}
      <ConfirmDialog
        open={Boolean(toArchive)}
        title="Archivar"
        danger
        confirmLabel="Archivar"
        busy={archiving}
        message={
          <>
            ¿Seguro que querés archivar
            {toArchive && archiveName ? ` "${archiveName(toArchive)}"` : " este elemento"}? No se
            elimina: queda inactivo y podés restaurarlo después.
          </>
        }
        onCancel={() => setToArchive(null)}
        onConfirm={() => {
          if (toArchive && onArchive) onArchive(toArchive);
          setToArchive(null);
        }}
      />
    </div>
  );
}
