export function TailwindCard() {
  return (
    <article className="m-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md">
      <h2 className="text-lg font-semibold text-slate-900">Product update</h2>
      <p className="mt-2 text-sm text-slate-600">A short summary with overlapping spacing and color utilities.</p>
      <div className="mt-4 flex items-center gap-3">
        <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm text-emerald-700">Live</span>
        <button className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          Learn more
        </button>
      </div>
    </article>
  );
}
