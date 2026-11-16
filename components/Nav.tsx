import Link from "next/link";

export function Nav({ active, toggle }: { active?: "home" | "jobs" | "evals"; toggle?: React.ReactNode }) {
  const cur = (k: string) => (active === k ? "page" : undefined);
  return (
    <header className="nav">
      <div className="wrap nav-in">
        <Link href="/" className="logo" aria-label="beep-jobs home">beep<span>-</span>jobs</Link>
        <nav className="nav-links">
          <Link href="/jobs" aria-current={cur("jobs")}>Jobs</Link>
          <Link href="/evals" aria-current={cur("evals")}>Accuracy</Link>
          <a className="hide-m" href="https://github.com/vinitpatil519/beep-jobs" target="_blank" rel="noopener noreferrer">Code</a>
          {toggle}
        </nav>
      </div>
    </header>
  );
}
