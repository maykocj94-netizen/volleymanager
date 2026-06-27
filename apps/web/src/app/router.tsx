import { createBrowserRouter } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { DashboardPage } from "@/features/dashboard/DashboardPage";
import { ExhibitionPage } from "@/features/match/ExhibitionPage";
import { SquadPage } from "@/features/squad/SquadPage";
import { MarketPage } from "@/features/market/MarketPage";
import { OnlineMatchPage, StorePage } from "@/features/placeholders";
import { CompetitionsPage } from "@/features/competitions/CompetitionsPage";
import { LoginPage } from "@/features/auth/LoginPage";
import { AuthGate } from "@/features/auth/AuthGate";
import { AdminPanel } from "@/features/admin/AdminPanel";
import { AdminGate } from "@/features/admin/AdminGate";

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  {
    path: "/admin",
    element: (
      <AdminGate>
        <AdminPanel />
      </AdminGate>
    ),
  },
  {
    path: "/",
    element: (
      <AuthGate>
        <AppLayout />
      </AuthGate>
    ),
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "elenco", element: <SquadPage /> },
      { path: "mercado", element: <MarketPage /> },
      { path: "partida", element: <ExhibitionPage /> },
      { path: "partida-online", element: <OnlineMatchPage /> },
      { path: "competicoes", element: <CompetitionsPage /> },
      { path: "loja", element: <StorePage /> },
    ],
  },
]);
