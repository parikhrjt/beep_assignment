import Link from "next/link";

export function Nav({ active, toggle }: { active?: "home" | "jobs" | "evals"; toggle?: React.ReactNode }) {
  return (
    <header className="nav">
      <div className="wrap nav-in">
        <Link href="/" className="logo" aria-label="Beep home">beep<i /></Link>
        <nav className="nav-links">
          <Link href="/jobs" style={active === "jobs" ? { color: "var(--ink)" } : undefined}>Jobs</Link>
          <Link href="/evals" style={active === "evals" ? { color: "var(--ink)" } : undefined}>Evals</Link>
          <a className="hide-m" href="https://github.com/vinitpatil519/beep" target="_blank" rel="noopener noreferrer">GitHub</a>
          {toggle}
        </nav>
      </div>
    </header>
  );
}
