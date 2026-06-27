import { useEffect, useState } from "react";
import { Loader2, Save, Settings, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMe, useUpdateClub } from "@/lib/game";

/** Modal de personalização da conta: nome do clube e cidade. */
export function AccountSettings({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: me } = useMe();
  const update = useUpdateClub();
  const [name, setName] = useState("");
  const [city, setCity] = useState("");

  useEffect(() => {
    if (open) {
      setName(me?.club_name ?? "");
      setCity(me?.club_city ?? "");
    }
  }, [open, me]);

  if (!open) return null;

  function save() {
    update.mutate(
      { name: name.trim() || undefined, city: city.trim() },
      { onSuccess: onClose },
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-t-2xl border border-graphite-border bg-surface p-5 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <p className="flex items-center gap-2 font-semibold">
            <Settings className="h-5 w-5 text-brand" /> Minha conta
          </p>
          <button onClick={onClose} className="text-ink-faint hover:text-ink">
            <X className="h-5 w-5" />
          </button>
        </div>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-ink-muted">Nome do clube</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder="Meu Clube" maxLength={40} />
        </label>
        <label className="mt-3 flex flex-col gap-1 text-sm">
          <span className="text-ink-muted">Cidade</span>
          <input value={city} onChange={(e) => setCity(e.target.value)} className="input" placeholder="São João da Barra" maxLength={60} />
        </label>

        <div className="mt-5 flex items-center gap-2">
          <Button onClick={save} disabled={update.isPending} className="flex-1">
            {update.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar
          </Button>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        </div>
      </div>
    </div>
  );
}
