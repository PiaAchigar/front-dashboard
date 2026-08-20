import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ConfirmDialog } from "./ConfirmDialog";

const props = () => ({
  open: true,
  title: "Archivar servicio",
  message: "El servicio deja de verse en la web.",
  onConfirm: vi.fn(),
  onCancel: vi.fn(),
});

describe("ConfirmDialog", () => {
  it("no renderiza nada cuando está cerrado", () => {
    const { container } = render(<ConfirmDialog {...props()} open={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("muestra título, mensaje y la etiqueta del botón", () => {
    render(<ConfirmDialog {...props()} confirmLabel="Archivar" />);
    expect(screen.getByText("Archivar servicio")).toBeInTheDocument();
    expect(screen.getByText("El servicio deja de verse en la web.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Archivar" })).toBeInTheDocument();
  });

  it('usa "Confirmar" cuando no le pasan etiqueta', () => {
    render(<ConfirmDialog {...props()} />);
    expect(screen.getByRole("button", { name: "Confirmar" })).toBeInTheDocument();
  });

  it("confirma y cancela por sus botones", async () => {
    const p = props();
    render(<ConfirmDialog {...p} />);
    await userEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(p.onConfirm).toHaveBeenCalledOnce();
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(p.onCancel).toHaveBeenCalledOnce();
  });

  it("cancela al hacer clic en el fondo", async () => {
    const p = props();
    const { container } = render(<ConfirmDialog {...p} />);
    await userEvent.click(container.firstChild as Element);
    expect(p.onCancel).toHaveBeenCalledOnce();
  });

  it("NO cancela al hacer clic dentro del cuadro", async () => {
    // El `stopPropagation` del panel es lo único que evita que seleccionar
    // texto del mensaje cierre el diálogo. Se rompe sin que nadie lo note.
    const p = props();
    render(<ConfirmDialog {...p} />);
    await userEvent.click(screen.getByText("El servicio deja de verse en la web."));
    expect(p.onCancel).not.toHaveBeenCalled();
  });

  it("con busy deshabilita los dos botones, no solo el de confirmar", async () => {
    // Si solo se deshabilitara confirmar, cancelar en pleno archivado dejaría
    // la acción corriendo con el diálogo ya cerrado.
    const p = props();
    render(<ConfirmDialog {...p} busy />);
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "…" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "…" }));
    expect(p.onConfirm).not.toHaveBeenCalled();
  });

  it("marca en rojo la acción destructiva", () => {
    const { rerender } = render(<ConfirmDialog {...props()} danger />);
    expect(screen.getByRole("button", { name: "Confirmar" }).className).toContain("bg-red-700");
    rerender(<ConfirmDialog {...props()} />);
    expect(screen.getByRole("button", { name: "Confirmar" }).className).not.toContain("bg-red-700");
  });
});
