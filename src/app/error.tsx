"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="fallback">
      <h1>Workspace unavailable</h1>
      <p>We couldn’t load this view. No device commands were sent.</p>
      <button onClick={reset}>Try again</button>
    </main>
  );
}
