import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function Placeholder({ title, phase }: { title: string; phase: string }) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{title}</h1>
      <Card>
        <CardHeader>
          <CardTitle>Em construção</CardTitle>
          <CardDescription>
            Este módulo entra no roadmap em {phase}. Veja docs/ROADMAP.md.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}

export const CompetitionsPage = () => <Placeholder title="Competições" phase="Fase 4" />;
