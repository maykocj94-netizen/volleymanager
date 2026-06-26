import { type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { getAdminToken } from "@/lib/admin";

/** Protege a central de contas: exige o token de admin (login dono/dono). */
export function AdminGate({ children }: { children: ReactNode }) {
  if (!getAdminToken()) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
