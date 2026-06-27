import { Link } from "react-router-dom";
import { Users, Star, Trophy, Swords, Gamepad2, Frown, Target, Globe } from "lucide-react";
import { MODALITY_LABEL } from "@volley/shared";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useClubAthletes, useMe, useMyClub } from "@/lib/game";
import { API_URL, IS_LOCAL_API } from "@/lib/api";
import { LoginStreakCard } from "./LoginStreakCard";

/** K/D = razão média entre vitórias e derrotas. */
function computeKD(won: number, lost: number): string {
  if (lost === 0) return won > 0 ? `${won.toFixed(2)}` : "0.00";
  return (won / lost).toFixed(2);
}

export function DashboardPage() {
  const { club, isError } = useMyClub();
  const { data: athletes } = useClubAthletes(club?.id);
  const { data: me } = useMe();

  const avg =
    athletes && athletes.length
      ? Math.round(athletes.reduce((s, a) => s + a.current_ability, 0) / athletes.length)
      : 0;

  const stats = [
    { label: "Atletas", value: athletes?.length ?? "—", icon: Users },
    { label: "Força média", value: avg || "—", icon: Star },
    { label: "Reputação", value: club?.reputation ?? "—", icon: Trophy },
  ];

  const played = me?.matches_played ?? 0;
  const won = me?.matches_won ?? 0;
  const lost = me?.matches_lost ?? 0;
  const matchStats = [
    { label: "Partidas jogadas", value: played, icon: Gamepad2, tone: "text-ink" },
    { label: "Vitórias", value: won, icon: Trophy, tone: "text-emerald-400" },
    { label: "Derrotas", value: lost, icon: Frown, tone: "text-red-400" },
    { label: "K/D (vit./der.)", value: computeKD(won, lost), icon: Target, tone: "text-brand" },
  ];

  const onlineStats = [
    { label: "Vitórias Online", value: me?.online_wins ?? 0, icon: Globe, tone: "text-emerald-400" },
    { label: "Derrotas Online", value: me?.online_losses ?? 0, icon: Globe, tone: "text-red-400" },
  ];

  return (
    <div className="space-y-6">
      <LoginStreakCard />

      <header>
        <h1 className="text-2xl font-bold">{club ? club.name : "Painel"}</h1>
        <p className="text-sm text-ink-muted">
          {club
            ? `${MODALITY_LABEL[club.modality]} · ${club.city}, ${club.country}`
            : "Bem-vindo ao Volley Manager."}
        </p>
      </header>

      {isError && (
        <Card className="space-y-1 text-sm text-ink-muted">
          {IS_LOCAL_API ? (
            <p>
              API offline. Inicie o backend local (porta 8000) com{" "}
              <b className="text-ink">npm run play</b> ou pelo botão{" "}
              <b className="text-ink">▶ Jogar</b> em "Executar e Depurar".
            </p>
          ) : (
            <>
              <p>
                Não foi possível falar com o servidor em{" "}
                <code className="text-ink">{API_URL}</code>.
              </p>
              <p className="text-ink-faint">
                Se acabou de abrir o site, o servidor gratuito pode estar
                "acordando" (~30s) — aguarde e recarregue. Veja docs/DEPLOY.md.
              </p>
            </>
          )}
        </Card>
      )}

      {/* Desempenho em partidas */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {matchStats.map((s) => (
          <Card key={s.label} className="flex items-center gap-3">
            <div className="rounded-lg bg-graphite p-2.5">
              <s.icon className={`h-5 w-5 ${s.tone}`} />
            </div>
            <div>
              <p className={`text-2xl font-bold tabular-nums ${s.tone}`}>{s.value}</p>
              <p className="text-xs text-ink-muted">{s.label}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Desafios online (X1) */}
      <div className="grid grid-cols-2 gap-4">
        {onlineStats.map((s) => (
          <Card key={s.label} className="flex items-center gap-3">
            <div className="rounded-lg bg-graphite p-2.5">
              <s.icon className={`h-5 w-5 ${s.tone}`} />
            </div>
            <div>
              <p className={`text-2xl font-bold tabular-nums ${s.tone}`}>{s.value}</p>
              <p className="text-xs text-ink-muted">{s.label}</p>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <Card key={s.label} className="flex items-center gap-4">
            <div className="rounded-lg bg-graphite p-3">
              <s.icon className="h-6 w-6 text-brand" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{s.value}</p>
              <p className="text-sm text-ink-muted">{s.label}</p>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-brand" /> Seu elenco
            </CardTitle>
            <CardDescription>Veja atributos e contrate revelações.</CardDescription>
          </CardHeader>
          <Link to="/elenco">
            <Button variant="subtle">Abrir elenco</Button>
          </Link>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Swords className="h-5 w-5 text-brand" /> Jogar uma partida
            </CardTitle>
            <CardDescription>
              Narração ao vivo, com o seu time ou forças personalizadas.
            </CardDescription>
          </CardHeader>
          <Link to="/partida">
            <Button>Ir para a partida</Button>
          </Link>
        </Card>
      </div>
    </div>
  );
}
