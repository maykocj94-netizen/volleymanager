import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Combina classes Tailwind resolvendo conflitos (padrão Shadcn UI). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
