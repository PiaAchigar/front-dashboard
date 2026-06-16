export function DashboardHome({ section }: { section: string }) {
  return (
    <div className="p-8">
      <h2 className="font-display text-3xl text-ink mb-2">{section}</h2>
      <p className="text-ink-soft text-sm font-sans">
        Esta sección está en construcción.
      </p>
    </div>
  );
}
