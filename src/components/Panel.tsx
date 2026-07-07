export function Panel({
  title,
  unavailableReason,
  children,
}: {
  title: string;
  unavailableReason?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
      <h2 className="text-sm font-medium text-neutral-500">{title}</h2>
      <div className="mt-3">
        {unavailableReason ? (
          <p className="text-sm italic text-neutral-400">Unavailable — {unavailableReason}</p>
        ) : (
          children
        )}
      </div>
    </section>
  );
}
