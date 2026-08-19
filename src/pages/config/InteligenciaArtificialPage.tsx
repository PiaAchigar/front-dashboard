import { useState } from "react";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { Field, TextInput } from "../../components/form";
import { useToast } from "../../components/ui/Toast";
import { formatDateTimeToDate } from "../../lib/format";
import {
  useAICredentials,
  useGuardarCredencial,
  useValidarCredencial,
  type CredencialInput,
  type ValidacionResultado,
} from "../../hooks/useAICredentials";
import { useEmbeddingsStatus, useRecalcularLote } from "../../hooks/useEmbeddingsStatus";

const MODELO_DEFAULT = "text-embedding-3-small";
const MAX_VUELTAS = 60;

/**
 * Credencial de OpenAI usada para generar los embeddings del buscador de la
 * web pública, más el estado de indexación del catálogo y el botón para
 * recalcular lo que falte. La api_key nunca vuelve del backend: solo se
 * muestran proveedor, modelo y fecha de carga de la credencial activa.
 */
export function InteligenciaArtificialPage() {
  const toast = useToast();

  const { data: credenciales = [], isLoading: loadingCredenciales } = useAICredentials();
  const validar = useValidarCredencial();
  const guardar = useGuardarCredencial();

  const status = useEmbeddingsStatus();
  const recalcularLote = useRecalcularLote();

  const activa = credenciales.find((c) => c.is_active) ?? null;

  const [apiKey, setApiKey] = useState("");
  const [modelo, setModelo] = useState(MODELO_DEFAULT);
  const [validacionError, setValidacionError] = useState<ValidacionResultado | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [corriendo, setCorriendo] = useState(false);
  const [procesados, setProcesados] = useState(0);
  const [totalAlEmpezar, setTotalAlEmpezar] = useState(0);
  const [errorLoop, setErrorLoop] = useState<string | null>(null);

  async function probarYGuardar() {
    setValidacionError(null);
    const data: CredencialInput = { provider: "openai", api_key: apiKey, model: modelo };
    try {
      const resultado = await validar.mutateAsync(data);
      if (!resultado.valid) {
        setValidacionError(resultado);
        return;
      }
      await guardar.mutateAsync(data);
      setApiKey("");
      toast.success("Credencial guardada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo validar la credencial.");
    }
  }

  function abrirModal() {
    setTotalAlEmpezar(status.data?.pendientes ?? 0);
    setProcesados(0);
    setErrorLoop(null);
    setModalOpen(true);
  }

  async function actualizar() {
    setCorriendo(true);
    setErrorLoop(null);
    try {
      for (let vuelta = 0; vuelta < MAX_VUELTAS; vuelta++) {
        const r = await recalcularLote.mutateAsync();

        // El backend devuelve `message` cuando ya no queda nada pendiente.
        if (r.message) break;
        if (r.sinCredito) {
          setErrorLoop(
            "La cuenta de OpenAI se quedó sin crédito. Hay que cargar saldo en platform.openai.com.",
          );
          break;
        }
        setProcesados((p) => p + (r.processed ?? 0));
        // Un lote sin nada procesado significa que no hay más trabajo: cortar
        // igual, para no gastar las 60 vueltas girando en el vacío.
        if (!r.processed) break;
      }
    } catch (err) {
      setErrorLoop(err instanceof Error ? err.message : "No se pudo actualizar el buscador.");
    } finally {
      setCorriendo(false);
      await status.refetch();
    }
  }

  const canSubmit =
    apiKey.trim().length > 0 && modelo.trim().length > 0 && !validar.isPending && !guardar.isPending;

  const botonActualizarDeshabilitado =
    !status.data || status.data.credencial_activa === false || status.data.pendientes === 0 || corriendo;

  return (
    <div className="flex h-full flex-col gap-6 overflow-auto p-2 pl-4 sm:p-4">
      <div>
        <h2 className="font-display text-xl text-ink">Inteligencia Artificial</h2>
        <p className="text-xs text-ink-soft">
          Credencial de OpenAI para generar los embeddings que alimentan el buscador de la web
          pública.
        </p>
      </div>

      {/* Bloque 1 — Credencial */}
      <section className="max-w-xl rounded-xl border border-surface-high p-4">
        <h3 className="font-display text-base text-ink">Credencial</h3>

        {loadingCredenciales ? (
          <p className="mt-2 text-sm text-ink-soft">Cargando…</p>
        ) : activa ? (
          <div className="mt-2 rounded-lg bg-surface-high px-3 py-2 text-sm text-ink-soft">
            <p>
              <span className="font-medium text-ink">Proveedor:</span> {activa.provider ?? "—"}
            </p>
            <p>
              <span className="font-medium text-ink">Modelo:</span> {activa.model ?? "—"}
            </p>
            <p>
              <span className="font-medium text-ink">Cargada el:</span>{" "}
              {formatDateTimeToDate(activa.created_at)}
            </p>
          </div>
        ) : (
          <p className="mt-2 text-sm text-ink-soft">Todavía no hay una credencial cargada.</p>
        )}

        <div className="mt-4 flex flex-col gap-3">
          <Field label="API key de OpenAI">
            <TextInput
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
              autoComplete="off"
            />
          </Field>
          <Field label="Modelo de embeddings">
            <TextInput value={modelo} onChange={(e) => setModelo(e.target.value)} />
          </Field>
          <p className="text-xs text-ink-soft">
            Tiene que ser{" "}
            <code className="rounded bg-surface-high px-1 py-0.5">text-embedding-3-small</code>.
            Las columnas de la base guardan vectores de 1536 dimensiones y es el único modelo que
            devuelve esa medida.
          </p>

          {validacionError && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              <p>{validacionError.error}</p>
              {validacionError.detalle && (
                <details className="mt-1 text-xs">
                  <summary className="cursor-pointer text-red-700">Ver detalle</summary>
                  <p className="mt-1 whitespace-pre-wrap">{validacionError.detalle}</p>
                </details>
              )}
            </div>
          )}

          <div>
            <button
              onClick={probarYGuardar}
              disabled={!canSubmit}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
            >
              {validar.isPending
                ? "Probando…"
                : guardar.isPending
                  ? "Guardando…"
                  : "Probar y guardar"}
            </button>
          </div>
        </div>
      </section>

      {/* Bloque 2 — Estado */}
      <section className="max-w-xl rounded-xl border border-surface-high p-4">
        <h3 className="font-display text-base text-ink">Estado del buscador</h3>

        {status.isLoading ? (
          <p className="mt-2 text-sm text-ink-soft">Cargando…</p>
        ) : status.data ? (
          <div className="mt-2">
            {status.data.credencial_activa === false ? (
              <p className="rounded-lg bg-surface-high px-3 py-2 text-sm text-ink-soft">
                Falta cargar una credencial de OpenAI. Hasta entonces no se puede actualizar el
                buscador.
              </p>
            ) : status.data.pendientes === 0 ? (
              <p className="text-sm text-ink-soft">
                {status.data.indexados} ítems indexados. El buscador está al día.
              </p>
            ) : (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                Hay {status.data.pendientes} ítems que todavía no aparecen en el buscador de la
                web.
              </p>
            )}
          </div>
        ) : null}

        {/* Bloque 3 — Botón «Actualizar buscador» */}
        <div className="mt-4">
          <button
            onClick={abrirModal}
            disabled={botonActualizarDeshabilitado}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
          >
            {corriendo ? `Actualizando… ${procesados} de ${totalAlEmpezar}` : "Actualizar buscador"}
          </button>
          {errorLoop && <p className="mt-2 text-sm text-red-700">{errorLoop}</p>}
        </div>
      </section>

      <ConfirmDialog
        open={modalOpen}
        title="Actualizar buscador"
        confirmLabel="Actualizar"
        busy={corriendo}
        message={
          <>
            Se van a actualizar <strong>{totalAlEmpezar} ítems</strong>.
            <br />
            Tarda unos segundos y el costo es menor a un centavo de dólar.
          </>
        }
        onCancel={() => setModalOpen(false)}
        onConfirm={() => {
          setModalOpen(false);
          actualizar();
        }}
      />
    </div>
  );
}
