import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { AyudaPage } from "./AyudaPage";
import { HELP_ARTICLES } from "../help/content";

const TITULO_GUIA = "Cómo hacer que el buscador de la web encuentre cada tratamiento";

/** Los tres artículos que explican el buscador de la web. */
const TITULOS_DEL_BUSCADOR = [
  TITULO_GUIA,
  "¿Cómo me doy cuenta de qué servicios les faltan palabras?",
  "Un servicio no aparece en el buscador de la web",
];

async function buscar(texto: string) {
  render(<AyudaPage />);
  await userEvent.type(screen.getByPlaceholderText(/^Buscar/), texto);
}

describe("Centro de ayuda — la guía del buscador de la web", () => {
  it("aparece en la lista sin buscar nada", () => {
    render(<AyudaPage />);
    expect(screen.getByText(TITULO_GUIA)).toBeInTheDocument();
  });

  // Estas son las palabras que Laura va a tipear cuando tenga el problema. Un
  // artículo que no sale con ninguna de ellas es un artículo que no existe.
  it.each(["buscador", "tonificar", "no aparece", "palabras", "adiposidad"])(
    'se encuentra buscando "%s"',
    async (termino) => {
      await buscar(termino);
      const titulos = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
      expect(titulos.some((t) => t != null && TITULOS_DEL_BUSCADOR.includes(t))).toBe(true);
    },
  );

  it("una búsqueda sin resultados lo dice", async () => {
    await buscar("xyzzy-no-existe");
    expect(screen.getByText(/No encontramos nada/)).toBeInTheDocument();
  });
});

describe("HELP_ARTICLES — integridad", () => {
  it("no hay dos artículos con el mismo id", () => {
    const ids = HELP_ARTICLES.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("todos tienen título, cuerpo y al menos una etiqueta", () => {
    for (const a of HELP_ARTICLES) {
      expect(a.title.trim(), a.id).not.toBe("");
      expect(a.body.trim(), a.id).not.toBe("");
      expect(a.tags.length, a.id).toBeGreaterThan(0);
    }
  });
});
