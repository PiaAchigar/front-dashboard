import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UsuariosPage } from "./UsuariosPage";

const h = vi.hoisted(() => ({
  role: "admin" as string | null,
  users: [] as { id: string; email: string; fullName?: string | null; role: string; createdAt: null; lastSignInAt: null }[],
  create: vi.fn(),
  updateName: vi.fn(),
}));

vi.mock("../../auth/AuthContext", () => ({
  useAuth: () => ({ user: { id: "yo" }, role: h.role }),
}));
vi.mock("../../components/ui/Toast", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));
vi.mock("../../hooks/useUsers", () => ({
  useUsers: () => ({ data: h.users, isLoading: false, error: null }),
  useCreateUser: () => ({ mutate: h.create, isPending: false }),
  useUpdateUserName: () => ({ mutate: h.updateName, isPending: false }),
  useUpdateUserRole: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteUser: () => ({ mutate: vi.fn(), isPending: false }),
}));

beforeEach(() => {
  h.role = "admin";
  h.create.mockReset();
  h.updateName.mockReset();
  h.users = [
    { id: "u1", email: "laura@x.com", fullName: "Laura", role: "sales", createdAt: null, lastSignInAt: null },
    { id: "u2", email: "sin@x.com", fullName: null, role: "sales", createdAt: null, lastSignInAt: null },
  ];
});

describe("UsuariosPage - nombre", () => {
  it("muestra la columna Nombre y 'Sin nombre'", () => {
    render(<UsuariosPage />);
    expect(screen.getByText("Nombre")).toBeTruthy();
    expect(screen.getByText("Laura")).toBeTruthy();
    expect(screen.getByText("Sin nombre")).toBeTruthy();
  });

  it("el buscador matchea por nombre", () => {
    render(<UsuariosPage />);
    fireEvent.change(screen.getByPlaceholderText("Buscar por nombre o email…"), {
      target: { value: "laur" },
    });
    expect(screen.queryByText("sin@x.com")).toBeNull();
    expect(screen.getByText("laura@x.com")).toBeTruthy();
  });

  it("el lápiz sólo lo ve un admin", () => {
    h.role = "manager";
    const { unmount } = render(<UsuariosPage />);
    expect(screen.queryAllByLabelText("Editar nombre")).toHaveLength(0);
    expect(screen.queryByRole("button", { name: /Agregar/ })).toBeNull();
    unmount();
    h.role = "admin";
    render(<UsuariosPage />);
    expect(screen.getAllByLabelText("Editar nombre")).toHaveLength(2);
  });

  it("guardar llama a la API con el nombre recortado", () => {
    render(<UsuariosPage />);
    fireEvent.click(screen.getAllByLabelText("Editar nombre")[1]);
    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "  Ana " } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    expect(h.updateName).toHaveBeenCalledWith(
      { id: "u2", fullName: "Ana" },
      expect.anything(),
    );
  });

  it("Cancelar cierra la edición sin llamar a la API", () => {
    render(<UsuariosPage />);
    fireEvent.click(screen.getAllByLabelText("Editar nombre")[0]);
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(h.updateName).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Nombre")).toBeNull();
  });

  it("'Crear usuario' queda apagado hasta cargar el nombre", () => {
    render(<UsuariosPage />);
    fireEvent.click(screen.getByRole("button", { name: /Agregar/ }));
    const crear = screen.getByRole("button", { name: "Crear usuario" }) as HTMLButtonElement;
    fireEvent.change(screen.getByPlaceholderText("Cómo aparece en el sistema, ej: Laura"), {
      target: { value: "   " },
    });
    const campos = document.querySelectorAll("input");
    const email = Array.from(campos).find((i) => i.type === "email")!;
    const pass = screen.getByPlaceholderText("La verá el nuevo usuario para ingresar");
    fireEvent.change(email, { target: { value: "nuevo@x.com" } });
    fireEvent.change(pass, { target: { value: "12345678" } });
    expect(crear.disabled).toBe(true);
    fireEvent.change(screen.getByPlaceholderText("Cómo aparece en el sistema, ej: Laura"), {
      target: { value: " Rosa " },
    });
    expect(crear.disabled).toBe(false);
    fireEvent.click(crear);
    expect(h.create.mock.calls[0][0]).toMatchObject({ fullName: "Rosa", email: "nuevo@x.com" });
  });
});
