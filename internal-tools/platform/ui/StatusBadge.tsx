const TONES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  held: "bg-amber-100 text-amber-800",
  in_review: "bg-blue-100 text-blue-800",
  info_requested: "bg-purple-100 text-purple-800",
  pending_lead: "bg-purple-100 text-purple-800",
  approved: "bg-green-100 text-green-800",
  released: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  confirmed_fraud: "bg-red-100 text-red-800",
};

export function StatusBadge({ value }: { value: string }) {
  const tone = TONES[value] ?? "bg-slate-100 text-slate-700";
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${tone}`}>
      {value.replace(/_/g, " ")}
    </span>
  );
}

export function Chips({ values }: { values: string[] }) {
  if (values.length === 0) return <span className="text-slate-400">—</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {values.map((value) => (
        <span
          key={value}
          className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700"
        >
          {value.replace(/_/g, " ")}
        </span>
      ))}
    </span>
  );
}
