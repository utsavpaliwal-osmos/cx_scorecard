// cn() — combine Tailwind class strings safely.
// clsx handles conditionals (e.g. cn("p-2", isActive && "bg-blue-500")).
// twMerge resolves conflicts so later classes win (e.g. "p-2 p-4" → "p-4").
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
