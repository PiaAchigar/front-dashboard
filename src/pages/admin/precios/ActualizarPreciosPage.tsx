import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../../../auth/AuthContext";
import { can, type Role } from "../../../lib/permissions";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { Field, TextInput, Select } from "../../../components/form";
import { useToast } from "../../../components/ui/Toast";
import { useCategoriesAdmin } from "../../../hooks/useCategoriesAdmin";
import {
  useAplicarAjuste,
  useSimularAjuste,
  type Ajuste,
  type FilaSimulada,
} from "../../../hooks/useAjusteDePrecios";
import { ApiError } from "../../../lib/api-client";
import { AREAS } from "../../../lib/admin-nav";
import type { CategoryNode } from "../../../lib/api-types";
import { money } from "../../../lib/money";
import { SelectorDeRama, camino } from "./SelectorDeRama";
import { AyudaActualizarPrecios, BotonAyuda } from "./AyudaActualizarPrecios";

/** Área (eje "area") por id, buscando en todo el árbol. */
function buscarArea(nodos: CategoryNode[], id: string): CategoryNode | null {
  for (const n of nodos) {
    if (n.kind === "area" && n.id === id) return n;
    const sub = buscarArea(n.children, id);
    if (sub) return sub;
  }
  return null;
}

function useDebounced<T>(valor: T, ms: number): T {
  const [v, setV] = useState(valor);
  useEffect(() => {
    const t = setTimeout(() => setV(valor), ms);
    return () => clearTimeout(t);
  }, [valor, ms]);
  return v;
}

/** "Estos 3 combos y packs incluyen" / "Este pack incluye", según lo que haya. */
function textoAviso(cs: { kind: "combo" | "pack" }[]): string {
  const nCombos = cs.filter((c) => c.kind === "combo").length;
  const nPacks = cs.length - nCombos;
  const cosa =
    nCombos > 0 && nPacks > 0 ? "combos y packs" : nPacks > 0 ? (nPacks === 1 ? "pack" : "packs") : nCombos === 1 ? "combo" : "combos";
  return cs.length === 1 ? `Este ${cosa} incluye` : `Estos ${cs.length} ${cosa} incluyen`;
}

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

export function ActualizarPreciosPage() {
  const toast = useToast();
  const { role } = useAuth();
  const canEdit = can(role as Role | null, "catalogo", "edit");
  const [params] = useSearchParams();
  const { data: arbol = [] } = useCategoriesAdmin(false);

  const [categoriaPedida, setCategoryId] = useState<string | null>(params.get("categoria"));
  // Sólo vale una categoría que el selector pueda mostrar (árbol sin áreas): un área o un id
  // que no existe se descarta, y hasta que el árbol cargue no hay categoría.
  const categoryId = useMemo(
    () =>
      categoriaPedida && camino(arbol.filter((c) => c.kind !== "area"), categoriaPedida).length > 0
        ? categoriaPedida
        : null,
    [categoriaPedida, arbol],
  );
  const [direccion, setDireccion] = useState<Ajuste["direccion"]>("subir");
  const [modo, setModo] = useState<Ajuste["modo"]>("porcentaje");
  const [valorTxt, setValorTxt] = useState("");
  const [redondeo, setRedondeo] = useState<Ajuste["redondeo"]>(100);
  // Las que Laura destildó a mano. Se vacía al cambiar de categoría: otra rama, otras filas.
  const [destildadas, setDestildadas] = useState<Set<string>>(new Set());
  const [confirmando, setConfirmando] = useState(false);
  // La ayuda ocupa el lugar de la pantalla; el estado de abajo queda cargado.
  const [ayuda, setAyuda] = useState(false);

  // En $ el punto es de miles ("1.000" = 1000); en % el punto o la coma son decimales.
  const valor = Number(modo === "monto" ? valorTxt.replace(/\./g, "").replace(",", ".") : valorTxt.replace(",", "."));
  const motivoInvalido = (): string | null => {
    if (valorTxt.trim() === "") return null;
    if (!Number.isFinite(valor)) return "Escribí solo números.";
    if (valor <= 0) return "El valor tiene que ser mayor que 0.";
    if (modo === "porcentaje") {
      return direccion === "bajar" && valor >= 100 ? "Al bajar, el % tiene que ser menor que 100." : null;
    }
    return Number.isInteger(valor) ? null : "El monto va en pesos enteros, sin centavos.";
  };
  const errorValor = motivoInvalido();
  const valorOk = valorTxt.trim() !== "" && errorValor === null;
  const ajuste: Ajuste | null = valorOk ? { direccion, modo, valor, redondeo } : null;

  // Se recalcula mientras escribe, pero sin disparar una consulta por tecla.
  const entradaViva = useMemo(
    () => (categoryId && ajuste ? { categoryId, ajuste } : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [categoryId, direccion, modo, valor, valorOk, redondeo],
  );
  const entrada = useDebounced(entradaViva, 300);

  const sim = useSimularAjuste(canEdit ? entrada : null);
  // Mientras la entrada viva no alcanzó a la debounced (o la simulación carga) la vista previa es vieja.
  const vistaAlDia = entradaViva === entrada && !sim.isFetching;
  const aplicar = useAplicarAjuste();

  const filas: FilaSimulada[] = sim.data?.servicios ?? [];
  const combos = sim.data?.combos ?? [];

  const tildada = (f: FilaSimulada) =>
    (f.estado === "cambia" || f.estado === "invalido") && !destildadas.has(f.id);
  const aAplicar = filas.filter((f) => tildada(f) && f.estado === "cambia");
  const hayInvalida = filas.some((f) => tildada(f) && f.estado === "invalido");
  const cambian = filas.filter((f) => f.estado === "cambia").length;

  const cambiarCategoria = (id: string | null) => {
    setCategoryId(id);
    setDestildadas(new Set());
  };
  const alternar = (id: string) =>
    setDestildadas((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });

  const linkDeCombo = (areaId: string | null, kind: "combo" | "pack") => {
    if (!areaId) return null;
    const nombre = buscarArea(arbol, areaId)?.name;
    const area = AREAS.find((a) => a.categoria === nombre);
    return area ? `/admin/${area.path}/${kind === "pack" ? "packs" : "combos"}` : null;
  };

  // El resumen sale de la MISMA entrada que viaja en el body de aplicar.
  const resumen = () => {
    const n = aAplicar.length;
    const a = entrada!.ajuste;
    const cuanto = a.modo === "porcentaje" ? `${String(a.valor).replace(".", ",")}%` : money(a.valor);
    const redo = a.redondeo === 1 ? "sin redondeo" : `redondeado a ${money(a.redondeo)}`;
    const verbo = a.direccion === "subir" ? (n === 1 ? "sube" : "suben") : n === 1 ? "baja" : "bajan";
    return `${plural(n, "servicio", "servicios")} ${verbo} ${cuanto}, ${redo}. Cambia el precio de lista y el de efectivo.`;
  };

  const confirmar = () => {
    if (!entrada) return;
    aplicar.mutate(
      {
        ...entrada,
        servicios: aAplicar.map((f) => ({
          id: f.id,
          listaVista: f.listaAntes,
          efectivoVista: f.efectivoAntes,
        })),
      },
      {
        onError: (e) => {
          setConfirmando(false);
          if (e instanceof ApiError && e.status === 409) {
            toast.error("Alguien cambió un precio mientras mirabas. Revisá la vista previa.");
            sim.refetch();
          } else {
            toast.error(e.message);
          }
        },
      },
    );
  };

  if (!canEdit) {
    return (
      <div className="modal-scroll h-full overflow-y-auto">
        <div className="mx-auto max-w-4xl p-4">
          <h1 className="font-display text-2xl text-ink">Actualizar precios</h1>
          <p className="mt-3 text-sm text-ink-soft">No tenés permiso para actualizar precios.</p>
        </div>
      </div>
    );
  }

  // El scroll es de la pantalla entera, con el estilo de las demás: con
  // muchos servicios, o con la ayuda abierta, la página es más alta que el
  // layout (que no scrollea solo).
  return (
    <div className="modal-scroll h-full overflow-y-auto">
    <div className="mx-auto max-w-4xl space-y-6 p-4">
      <div className="flex items-center gap-2">
        <h1 className="font-display text-2xl text-ink">Actualizar precios</h1>
        <BotonAyuda abierta={ayuda} onClick={() => setAyuda((a) => !a)} />
      </div>

      {ayuda && <AyudaActualizarPrecios onVolver={() => setAyuda(false)} />}

      <div className={ayuda ? "hidden" : "space-y-6"}>
      <section className="space-y-2">
        <h2 className="text-sm font-medium text-ink">1. ¿Qué servicios?</h2>
        <SelectorDeRama arbol={arbol} valor={categoryId} onChange={cambiarCategoria} />
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-ink">2. ¿Cuánto?</h2>
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Acción">
            <Select value={direccion} onChange={(e) => setDireccion(e.target.value as Ajuste["direccion"])}>
              <option value="subir">Subir</option>
              <option value="bajar">Bajar</option>
            </Select>
          </Field>
          <Field label="Tipo">
            <Select value={modo} onChange={(e) => setModo(e.target.value as Ajuste["modo"])}>
              <option value="porcentaje">En %</option>
              <option value="monto">En $ (monto fijo)</option>
            </Select>
          </Field>
          <Field label="Valor">
            <TextInput
              inputMode="decimal"
              value={valorTxt}
              onChange={(e) => setValorTxt(e.target.value)}
              placeholder={modo === "porcentaje" ? "10" : "500"}
            />
          </Field>
          <Field label="Redondear a">
            <Select
              value={redondeo}
              onChange={(e) => setRedondeo(Number(e.target.value) as Ajuste["redondeo"])}
            >
              <option value={1}>Sin redondeo</option>
              <option value={100}>$100</option>
              <option value={500}>$500</option>
              <option value={1000}>$1.000</option>
            </Select>
          </Field>
        </div>
        {errorValor && <p role="alert" className="text-sm text-red-700">{errorValor}</p>}
        <p className="text-sm text-ink-soft">Cambia el precio de lista y el precio en efectivo.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-ink">3. Vista previa</h2>
        {!entradaViva && (
          <p className="text-sm text-ink-soft">Elegí una categoría y un valor para ver cómo quedan los precios.</p>
        )}
        {sim.isError && <p className="text-sm text-red-700">{sim.error.message}</p>}
        {sim.data && (
          <>
            <p className="text-sm text-ink">{plural(cambian, "servicio cambia", "servicios cambian")}</p>
            <div className="overflow-x-auto rounded-xl bg-surface-low">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-ink-soft">
                  <tr>
                    <th className="p-2" />
                    <th className="p-2">Servicio</th>
                    <th className="p-2">Lista</th>
                    <th className="p-2">Efectivo</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map((f) => (
                    <tr key={f.id} className={f.estado === "invalido" ? "bg-red-50 text-red-800" : "text-ink"}>
                      <td className="p-2">
                        <input
                          type="checkbox"
                          aria-label={`Incluir ${f.nombre}`}
                          checked={tildada(f)}
                          disabled={f.estado === "sin_precio" || f.estado === "no_cambia"}
                          onChange={() => alternar(f.id)}
                          className="h-4 w-4 accent-[var(--color-primary)]"
                        />
                      </td>
                      <td className="p-2">{f.nombre}</td>
                      {f.estado === "sin_precio" ? (
                        <td className="p-2 text-ink-soft" colSpan={2}>sin precio</td>
                      ) : f.estado === "no_cambia" ? (
                        <td className="p-2 text-ink-soft" colSpan={2}>no cambia</td>
                      ) : (
                        <>
                          <td className="p-2">{money(f.listaAntes)} → {money(f.listaDespues)}</td>
                          <td className="p-2">{money(f.efectivoAntes)} → {money(f.efectivoDespues)}</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {hayInvalida && (
              <p className="text-sm text-red-700">
                Hay precios que quedarían en $0 o menos. Destildá esos servicios o cambiá el valor.
              </p>
            )}
            {combos.length > 0 && (
              <div className="rounded-xl bg-amber-50 p-3 text-sm text-ink">
                <p>
                  {textoAviso(combos)} servicios que cambian de precio y no se actualizan solos:
                </p>
                <ul className="mt-1 list-disc pl-5">
                  {combos.map((c) => {
                    const href = linkDeCombo(c.areaId, c.kind);
                    return (
                      <li key={c.id}>
                        {href ? <Link to={href} className="underline">{c.nombre}</Link> : c.nombre}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </>
        )}
      </section>

      <div className="sticky bottom-0 flex justify-end bg-surface py-3">
        <button
          onClick={() => setConfirmando(true)}
          disabled={!vistaAlDia || !sim.data || aAplicar.length === 0 || hayInvalida || aplicar.isPending}
          className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
        >
          Aplicar a {plural(aAplicar.length, "servicio", "servicios")}
        </button>
      </div>
      </div>

      <ConfirmDialog
        open={confirmando}
        title="Confirmar el cambio de precios"
        message={entrada ? resumen() : ""}
        confirmLabel="Aplicar"
        busy={aplicar.isPending}
        onConfirm={confirmar}
        onCancel={() => setConfirmando(false)}
      />
    </div>
    </div>
  );
}
