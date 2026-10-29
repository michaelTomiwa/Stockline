/* Shown while a page's data loads: a soft skeleton in the page's shape. */
export default function Loading() {
  return (
    <div className="animate-pulse">
      <div className="h-8 w-56 rounded-lg bg-line" />
      <div className="mt-2 h-4 w-80 max-w-full rounded bg-line/70" />
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-24 rounded-2xl bg-panel" />
        ))}
      </div>
      <div className="mt-6 h-72 rounded-2xl bg-panel" />
    </div>
  );
}
