import { useEffect, useMemo, useState } from "react";
import { Loader2, Save } from "lucide-react";
import {
  INDOOR_SLOTS,
  POSITION_LABEL,
  Sex,
  SEX_LABEL,
  type Athlete,
  type LineupKey,
} from "@volley/shared";
import { Button } from "@/components/ui/button";
import { useMe, useSaveLineup } from "@/lib/game";

/**
 * Editor de escalação por categoria (disciplina × sexo).
 * - `lockSex`: fixa o sexo (esconde o seletor) — usado na tela de Partida.
 * - `only`: limita a uma disciplina ("beach" | "indoor").
 */
export function LineupEditor({
  athletes,
  lockSex,
  only,
}: {
  athletes: Athlete[];
  lockSex?: Sex;
  only?: "beach" | "indoor";
}) {
  const { data: me } = useMe();
  const save = useSaveLineup();
  const [sex, setSex] = useState<Sex>(lockSex ?? Sex.MALE);
  const [beachSel, setBeachSel] = useState<string[]>(["", ""]);
  const [indoorSel, setIndoorSel] = useState<string[]>(Array(INDOOR_SLOTS.length).fill(""));

  useEffect(() => {
    if (lockSex) setSex(lockSex);
  }, [lockSex]);

  const beachKey: LineupKey = sex === Sex.MALE ? "beach_m" : "beach_f";
  const indoorKey: LineupKey = sex === Sex.MALE ? "indoor_m" : "indoor_f";

  // Só atletas do sexo selecionado entram na categoria.
  const beach = useMemo(
    () => athletes.filter((a) => a.beach_position && a.sex === sex),
    [athletes, sex],
  );
  const indoor = useMemo(
    () => athletes.filter((a) => a.court_position && a.sex === sex),
    [athletes, sex],
  );

  useEffect(() => {
    if (!me) return;
    setBeachSel([me.lineup[beachKey][0] ?? "", me.lineup[beachKey][1] ?? ""]);
    setIndoorSel(
      Array.from({ length: INDOOR_SLOTS.length }, (_, i) => me.lineup[indoorKey][i] ?? ""),
    );
  }, [me, sex, beachKey, indoorKey]);

  function onSave() {
    if (!me) return;
    save.mutate({
      ...me.lineup,
      [beachKey]: beachSel.filter(Boolean),
      [indoorKey]: indoorSel.filter(Boolean),
    });
  }

  const showBeach = only !== "indoor";
  const showIndoor = only !== "beach";

  return (
    <div className="space-y-4">
      {!lockSex && (
        <div className="flex gap-2">
          {([Sex.MALE, Sex.FEMALE] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSex(s)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                sex === s ? "bg-brand text-black" : "bg-graphite text-ink-muted hover:text-ink"
              }`}
            >
              {s === Sex.MALE ? "♂ Masculino" : "♀ Feminino"}
            </button>
          ))}
        </div>
      )}

      <div className={`grid gap-4 ${showBeach && showIndoor ? "lg:grid-cols-2" : ""}`}>
        {showBeach && (
          <div>
            <p className="mb-2 font-semibold">🏖️ Dupla de Praia ({SEX_LABEL[sex]})</p>
            <div className="space-y-2">
              {[0, 1].map((i) => (
                <PlayerSelect
                  key={i}
                  label={`Atleta ${i + 1}`}
                  value={beachSel[i]}
                  options={beach}
                  taken={beachSel.filter((_, j) => j !== i)}
                  onChange={(v) => setBeachSel((s) => s.map((x, j) => (j === i ? v : x)))}
                />
              ))}
              {beach.length === 0 && (
                <p className="text-xs text-ink-faint">
                  Nenhuma atleta de praia {SEX_LABEL[sex].toLowerCase()} no elenco.
                </p>
              )}
            </div>
          </div>
        )}

        {showIndoor && (
          <div>
            <p className="mb-2 font-semibold">🏐 Sexteto de Quadra ({SEX_LABEL[sex]})</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {INDOOR_SLOTS.map((slot, i) => (
                <PlayerSelect
                  key={slot.key}
                  label={slot.label}
                  value={indoorSel[i]}
                  options={indoor}
                  taken={indoorSel.filter((_, j) => j !== i)}
                  onChange={(v) => setIndoorSel((s) => s.map((x, j) => (j === i ? v : x)))}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <div>
        <Button onClick={onSave} disabled={save.isPending} size="sm">
          {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar escalação {SEX_LABEL[sex].toLowerCase()}
        </Button>
        {save.isSuccess && <span className="ml-3 text-sm text-emerald-400">Escalação salva!</span>}
      </div>
    </div>
  );
}

export function PlayerSelect({
  label,
  value,
  options,
  taken,
  onChange,
}: {
  label: string;
  value: string;
  options: Athlete[];
  taken: string[];
  onChange: (v: string) => void;
}) {
  const available = useMemo(
    () => options.filter((a) => a.id === value || !taken.includes(a.id)),
    [options, taken, value],
  );
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-ink-muted">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 rounded-lg border border-graphite-border bg-graphite px-2 text-ink focus:outline-none focus:ring-2 focus:ring-brand"
      >
        <option value="">— vazio —</option>
        {available.map((a) => {
          const pos = a.beach_position ?? a.court_position ?? "";
          return (
            <option key={a.id} value={a.id}>
              {a.first_name} {a.last_name} · {POSITION_LABEL[pos] ?? pos} · {a.current_ability}
            </option>
          );
        })}
      </select>
    </label>
  );
}
