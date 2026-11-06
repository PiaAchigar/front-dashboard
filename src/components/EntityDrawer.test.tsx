import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EntityDrawer } from "./EntityDrawer";

function montar(props: Partial<Parameters<typeof EntityDrawer>[0]> = {}) {
  const onClose = vi.fn();
  const onSubmit = vi.fn();
  const { container } = render(
    <EntityDrawer open title="Editar combo" onClose={onClose} onSubmit={onSubmit} {...props}>
      <input aria-label="Nombre" />
    </EntityDrawer>,
  );
  return { onClose, onSubmit, container };
}

describe("EntityDrawer: cómo se cierra", () => {
  it("un clic afuera del panel NO lo cierra", async () => {
    const { onClose, container } = montar();
    await userEvent.click(container.firstElementChild as HTMLElement);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("la X de arriba lo cierra sin guardar", async () => {
    const { onClose, onSubmit } = montar();
    await userEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("Cancelar lo cierra sin guardar", async () => {
    const { onClose, onSubmit } = montar();
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("Guardar guarda: cerrar queda a cargo de la pantalla, cuando salió bien", async () => {
    const { onClose, onSubmit } = montar();
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("mientras guarda, la X también queda apagada, igual que Cancelar", () => {
    montar({ busy: true });
    expect(screen.getByRole("button", { name: "Cerrar" })).toBeDisabled();
  });

  it("en solo lectura hay X y Cerrar abajo", () => {
    montar({ readOnly: true });
    expect(screen.getAllByRole("button", { name: "Cerrar" })).toHaveLength(2);
  });
});
