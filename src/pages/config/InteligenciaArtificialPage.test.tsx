import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { InteligenciaArtificialPage } from "./InteligenciaArtificialPage";
import type { EmbeddingsStatus } from "../../hooks/useEmbeddingsStatus";

const credencial = vi.hoisted(() => ({
  filas: [] as {
    is_active: boolean;
    provider: string;
    model: string;
    created_at: string;
  }[],
}));

const estado = vi.hoisted(() => ({
  data: undefined as EmbeddingsStatus | undefined,
  isLoading: false,
  isError: false,
  refetch: vi.fn(),
}));

vi.mock("../../hooks/useEmbeddingsStatus", () => ({
  useEmbeddingsStatus: () => estado,
  useRecalcularLote: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("../../hooks/useAICredentials", () => ({
  useAICredentials: () => ({
    data: credencial.filas,
    isLoading: false,
    isError: false,
  }),
  useValidarCredencial: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useGuardarCredencial: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("../../components/ui/Toast", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

const STATUS = (over: Partial<EmbeddingsStatus> = {}): EmbeddingsStatus => ({
  total: 155,
  indexados: 155,
  pendientes: 0,
  por_tipo: {
    service: { total: 120, pendientes: 0 },
    activity: { total: 20, pendientes: 0 },
    training: { total: 15, pendientes: 0 },
  },
  credencial_activa: true,
  ...over,
});

const botonActualizar = () =>
  screen.getByRole("button", { name: /Actualizar buscador/ });
const botonCredencial = () =>
  screen.getByRole("button", { name: /Probar y guardar/ });

const CREDENCIAL_ACTIVA = {
  is_active: true,
  provider: "openai",
  model: "text-embedding-3-small",
  created_at: "2026-08-01T12:00:00Z",
};

describe("InteligenciaArtificialPage — por qué los botones están grises", () => {
  beforeEach(() => {
    estado.data = STATUS();
    credencial.filas = [CREDENCIAL_ACTIVA];
  });

  // El caso de la captura: "155 ítems indexados. El buscador está al día" y el
  // botón apagado. Está bien apagado —no hay nada que actualizar— pero sin
  // decirlo se lee como un botón roto.
  it("con el buscador al día, el botón está gris Y dice por qué", () => {
    render(<InteligenciaArtificialPage />);

    expect(botonActualizar()).toBeDisabled();
    expect(
      screen.getByText(/no hay nada para actualizar/i),
    ).toBeInTheDocument();
  });

  it("con pendientes se habilita y el cartel de «no hay nada» desaparece", () => {
    estado.data = STATUS({ indexados: 154, pendientes: 1 });
    render(<InteligenciaArtificialPage />);

    expect(botonActualizar()).toBeEnabled();
    expect(
      screen.queryByText(/no hay nada para actualizar/i),
    ).not.toBeInTheDocument();
  });

  // El otro botón gris de la captura, y por un motivo distinto: el campo de
  // API key está vacío. La credencial vieja sigue funcionando.
  it("«Probar y guardar» explica que sólo sirve para reemplazar la key", () => {
    render(<InteligenciaArtificialPage />);

    expect(botonCredencial()).toBeDisabled();
    expect(screen.getByText(/para reemplazar la actual/i)).toBeInTheDocument();
  });

  it("sin ninguna credencial cargada, pide la key en vez de hablar de reemplazo", () => {
    credencial.filas = [];
    render(<InteligenciaArtificialPage />);

    expect(botonCredencial()).toBeDisabled();
    expect(
      screen.queryByText(/para reemplazar la actual/i),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/Escribí la API key de OpenAI/i),
    ).toBeInTheDocument();
  });

  it("sin credencial cargada no culpa a «no hay nada pendiente»", () => {
    estado.data = STATUS({
      credencial_activa: false,
      indexados: 0,
      pendientes: 5,
    });
    render(<InteligenciaArtificialPage />);

    expect(botonActualizar()).toBeDisabled();
    expect(
      screen.queryByText(/no hay nada para actualizar/i),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/Falta cargar una credencial/i),
    ).toBeInTheDocument();
  });
});

describe("InteligenciaArtificialPage — cuándo conviene apretarlo", () => {
  beforeEach(() => {
    estado.data = STATUS({ indexados: 154, pendientes: 1 });
    credencial.filas = [CREDENCIAL_ACTIVA];
  });

  it("sugiere terminar de editar y actualizar una sola vez al final", () => {
    render(<InteligenciaArtificialPage />);
    expect(screen.getByText(/una sola vez al final/i)).toBeInTheDocument();
    expect(screen.getByText(/tokens/i)).toBeInTheDocument();
  });

  // Verificado en producción el 2026-09-29: hay embeddings escritos 18:00 y
  // 19:00 en punto, que es el cron del Worker (`0 * * * *`) trabajando.
  it("aclara que apretarlo no es obligatorio porque corre solo cada hora", () => {
    render(<InteligenciaArtificialPage />);
    expect(screen.getByText(/cada hora en punto/i)).toBeInTheDocument();
  });
});
