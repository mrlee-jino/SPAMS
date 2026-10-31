import Link from "next/link";
export default function NotFound() {
  return (
    <main className="fallback">
      <h1>Page not found</h1>
      <Link href="/">Return to overview</Link>
    </main>
  );
}
