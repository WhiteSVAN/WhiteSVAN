import { ShieldCheck } from "lucide-react";

/** "Computed from … · coverage · version N published …" — sits directly above published numbers. */
export function ProvenanceLine({ text }: { text: string }) {
  return (
    <p className="flex items-start gap-2 rounded-md border border-[#2b3a2c] bg-[#111711] px-3 py-2 text-xs leading-5 text-[#b8c7ac]">
      <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#8fb86a]" aria-hidden="true" />
      <span className="min-w-0 break-words">{text}</span>
    </p>
  );
}
