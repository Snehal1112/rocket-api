import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <div className="flex h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-lg rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
        <h1 className="text-lg font-semibold">Page not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This route does not exist in Rocket.
        </p>
        <Link
          to="/"
          className="mt-4 inline-flex text-sm font-medium text-primary hover:underline"
        >
          Back to workspace
        </Link>
      </div>
    </div>
  )
}

