import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AvisoToast } from "./AvisoToast";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("AvisoToast", () => {
  const aviso = { texto: "💬 Ana: hola", conversationId: "c1" };
  it("al hacer clic en el texto abre la conversación y cierra", () => {
    const onAbrir = vi.fn(), onCerrar = vi.fn();
    render(<AvisoToast aviso={aviso} onAbrir={onAbrir} onCerrar={onCerrar} />);
    fireEvent.click(screen.getByText("💬 Ana: hola"));
    expect(onAbrir).toHaveBeenCalledWith("c1");
    expect(onCerrar).toHaveBeenCalled();
  });
  it("la cruz cierra sin abrir", () => {
    const onAbrir = vi.fn(), onCerrar = vi.fn();
    render(<AvisoToast aviso={aviso} onAbrir={onAbrir} onCerrar={onCerrar} />);
    fireEvent.click(screen.getByLabelText("Cerrar aviso"));
    expect(onCerrar).toHaveBeenCalled();
    expect(onAbrir).not.toHaveBeenCalled();
  });
  it("se cierra solo a los ~6 s", () => {
    const onCerrar = vi.fn();
    render(<AvisoToast aviso={aviso} onAbrir={vi.fn()} onCerrar={onCerrar} />);
    vi.advanceTimersByTime(6000);
    expect(onCerrar).toHaveBeenCalled();
  });
  it("sin aviso no pinta nada", () => {
    const { container } = render(<AvisoToast aviso={null} onAbrir={vi.fn()} onCerrar={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });
});
