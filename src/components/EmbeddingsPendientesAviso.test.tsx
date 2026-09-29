import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EmbeddingsPendientesAviso } from "./EmbeddingsPendientesAviso";

const estado = vi.hoisted(() => ({
  data: undefined as { pendientes: number } | undefined,
}));
const auth = vi.hoisted(() => ({ role: "admin" as string }));

vi.mock("../hooks/useEmbeddingsStatus", () => ({
  useEmbeddingsStatus: () => estado,
}));
vi.mock("../auth/AuthContext", () => ({
  useAuth: () => auth,
}));

function pintar() {
  return render(
    <MemoryRouter>
      <EmbeddingsPendientesAviso />
    </MemoryRouter>,
  );
}

describe("EmbeddingsPendientesAviso", () => {
  beforeEach(() => {
    estado.data = { pendientes: 1 };
    auth.role = "admin";
  });

  it("sin nada pendiente no ocupa lugar", () => {
    estado.data = { pendientes: 0 };
    const { container } = pintar();
    expect(container).toBeEmptyDOMElement();
  });

  it("dice cuántos ítems faltan", () => {
    estado.data = { pendientes: 3 };
    pintar();
    expect(
      screen.getByText(/todavía no aparecen en el buscador/),
    ).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  // El número va en un <strong>, así que la frase queda partida en varios
  // nodos: se compara contra el texto completo del cartel.
  it("concuerda el verbo con el número", () => {
    estado.data = { pendientes: 1 };
    const uno = pintar();
    expect(uno.container.textContent).toMatch(
      /1 ítem que todavía no aparece en/,
    );
    uno.unmount();

    estado.data = { pendientes: 2 };
    const dos = pintar();
    expect(dos.container.textContent).toMatch(
      /2 ítems que todavía no aparecen en/,
    );
  });

  // Lo que hoy no dice en ningún lado y es la mitad tranquilizadora: apretar el
  // botón NO es obligatorio. El cron del Worker corre a la hora en punto
  // (`crons = [..., "0 * * * *"]` en wrangler.toml; verificado en producción,
  // hay embeddings escritos 19:00 y 18:00 en punto el 2026-09-29).
  it("aclara que se actualiza solo cada hora, así nadie cree que quedó roto", () => {
    pintar();
    expect(screen.getByText(/cada hora en punto/i)).toBeInTheDocument();
  });

  it("se lo aclara también a quien no puede actualizarlo", () => {
    auth.role = "operator";
    pintar();
    expect(screen.getByText(/cada hora en punto/i)).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  // Si va a editar cinco servicios, que actualice una vez al final y no cinco.
  it("al admin le sugiere terminar de editar antes de actualizar", () => {
    pintar();
    expect(screen.getByText(/una sola vez al final/i)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Actualizar buscador/ }),
    ).toHaveAttribute("href", "/configuracion/ia");
  });

  it("a quien no es admin no le sugiere algo que no puede hacer", () => {
    auth.role = "manager";
    pintar();
    expect(
      screen.queryByText(/una sola vez al final/i),
    ).not.toBeInTheDocument();
  });
});
