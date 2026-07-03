export function ProductCard({ title, description, tags, onAction }) {
  return (
    <article className="bg-white rounded-lg border border-slate-200 shadow-sm hover:shadow-md p-6 space-y-4">
      {/* Header with title and tags */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold text-slate-900 leading-tight">
          {title}
        </h2>
        <div className="flex flex-wrap gap-2">
          {tags.map(tag => (
            <span key={tag} className="inline-block rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-slate-600 leading-relaxed">
        {description}
      </p>

      {/* Action button */}
      <div className="flex justify-end pt-2">
        <button
          onClick={onAction}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
        >
          Learn more
        </button>
      </div>
    </article>
  );
}

export function BuggyProductCard() {
  // This component has intentional style conflicts:
  // - p-4 AND px-8 (padding conflict)
  // - m-2 AND mx-4 (margin conflict)
  // - shadow-sm AND shadow-md (shadow conflict)
  // - text-blue-600 AND text-blue-700 (color conflict in button)
  return (
    <article className="p-4 px-8 m-2 mx-4 bg-white rounded-lg border border-slate-200 shadow-sm shadow-md hover:shadow-lg">
      <h2 className="text-lg font-semibold text-slate-900">
        Product
      </h2>
      <p className="text-sm text-slate-600 mt-2">
        Description goes here
      </p>
      <button className="rounded-md bg-blue-600 text-blue-600 text-blue-700 px-4 py-2 font-medium mt-4">
        Action
      </button>
    </article>
  );
}
