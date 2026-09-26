import { Skeleton } from './LoadingSpinner';

/**
 * Shape-matched placeholder shown by the route `loading.js` files while a
 * page's data loads.
 *
 * Every portal page reads the session and the database on each request, so
 * there is always a short wait after a tab is clicked. Matching the real
 * layout keeps the page from jumping when the content arrives.
 */
export default function PageSkeleton({ rows = 5, withTable = true, withCards = 0 }) {
  return (
    <div className="container-page py-10 lg:py-14" aria-busy="true">
      <div className="mb-10 space-y-4">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-10 w-72 max-w-full" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>

      {withCards > 0 && (
        <div className="mb-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: withCards }).map((_, index) => (
            <Skeleton key={index} className="h-40 w-full" />
          ))}
        </div>
      )}

      {withTable && <Skeleton className="mb-10 h-56 w-full" />}

      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, index) => (
          <Skeleton key={index} className="h-16 w-full" />
        ))}
      </div>

      <span className="sr-only" role="status">
        Loading
      </span>
    </div>
  );
}
