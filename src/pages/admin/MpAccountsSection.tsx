import { useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { Field, TextInput } from "../../components/form";
import { Plus, Trash } from "../../components/icons";
import { useToast } from "../../components/ui/Toast";
import {
  useCreateMpAccount,
  useDeleteMpAccount,
  useProviderMpAccounts,
} from "../../hooks/useProviderMpAccounts";

export type DraftMpAccount = { alias: string; cvu: string };

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <div className="space-y-3 rounded-xl border border-surface-high p-3">
    <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">
      Cuentas de MercadoPago
    </p>
    {children}
  </div>
);

function AccountRow({
  alias,
  cvu,
  onDelete,
}: {
  alias: string | null;
  cvu: string | null;
  onDelete?: () => void;
}) {
  return (
    <li className="flex items-start justify-between gap-3 rounded-lg border border-surface-high bg-white p-2.5">
      <div className="min-w-0 text-sm">
        {alias && <p className="font-medium text-ink">{alias}</p>}
        {cvu && <p className="text-xs text-ink-soft">CVU: {cvu}</p>}
      </div>
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          title="Quitar cuenta"
          className="shrink-0 rounded p-1.5 text-ink-soft transition-colors hover:bg-surface-high hover:text-red-700"
        >
          <Trash size={15} />
        </button>
      )}
    </li>
  );
}

function AddForm({ onAdd, busy }: { onAdd: (a: DraftMpAccount) => void; busy?: boolean }) {
  const [alias, setAlias] = useState("");
  const [cvu, setCvu] = useState("");
  const canAdd = alias.trim().length > 0 || cvu.trim().length > 0;

  function handle() {
    onAdd({ alias: alias.trim(), cvu: cvu.trim() });
    setAlias("");
    setCvu("");
  }

  return (
    <>
      <div className="flex gap-2">
        <Field label="Alias">
          <TextInput value={alias} onChange={(e) => setAlias(e.target.value)} placeholder="mi.alias.mp" />
        </Field>
        <Field label="CVU">
          <TextInput
            value={cvu}
            onChange={(e) => setCvu(e.target.value)}
            inputMode="numeric"
            placeholder="0000003100000000000000"
          />
        </Field>
      </div>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handle}
          disabled={!canAdd || busy}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
        >
          <Plus size={15} />
          {busy ? "Agregando…" : "Agregar cuenta"}
        </button>
      </div>
    </>
  );
}

/** Modo persistido: edita las cuentas de una proveedora ya existente (cada acción pega a la API). */
export function MpAccountsSection({ providerId }: { providerId: string }) {
  const { role } = useAuth();
  const isAdmin = role === "admin";
  const toast = useToast();

  const { data: accounts = [], isLoading } = useProviderMpAccounts(providerId);
  const create = useCreateMpAccount(providerId);
  const del = useDeleteMpAccount(providerId);

  function add(a: DraftMpAccount) {
    create.mutate(
      { alias: a.alias || null, cvu: a.cvu || null },
      {
        onSuccess: () => toast.success("Cuenta de MercadoPago agregada"),
        onError: (e: Error) => toast.error(e.message),
      },
    );
  }

  return (
    <Wrapper>
      {isLoading ? (
        <p className="text-sm text-ink-soft">Cargando…</p>
      ) : accounts.length === 0 ? (
        <p className="text-sm text-ink-soft">Sin cuentas cargadas.</p>
      ) : (
        <ul className="space-y-2">
          {accounts.map((a) => (
            <AccountRow
              key={a.id}
              alias={a.alias}
              cvu={a.cvu}
              onDelete={
                isAdmin
                  ? () =>
                      del.mutate(a.id, {
                        onSuccess: () => toast.success("Cuenta eliminada"),
                        onError: (e: Error) => toast.error(e.message),
                      })
                  : undefined
              }
            />
          ))}
        </ul>
      )}
      <AddForm onAdd={add} busy={create.isPending} />
    </Wrapper>
  );
}

/** Modo borrador: para el alta de una proveedora nueva. Las cuentas viven en memoria
 *  hasta que la proveedora se crea; el padre las persiste después con el UUID nuevo. */
export function MpAccountsDraftSection({
  value,
  onChange,
}: {
  value: DraftMpAccount[];
  onChange: (v: DraftMpAccount[]) => void;
}) {
  return (
    <Wrapper>
      {value.length === 0 ? (
        <p className="text-sm text-ink-soft">Sin cuentas. Podés agregarlas ahora.</p>
      ) : (
        <ul className="space-y-2">
          {value.map((a, i) => (
            <AccountRow
              key={i}
              alias={a.alias || null}
              cvu={a.cvu || null}
              onDelete={() => onChange(value.filter((_, idx) => idx !== i))}
            />
          ))}
        </ul>
      )}
      <AddForm onAdd={(a) => onChange([...value, a])} />
    </Wrapper>
  );
}
