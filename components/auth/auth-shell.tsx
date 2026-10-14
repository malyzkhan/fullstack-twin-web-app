import type { ReactNode } from "react";
import Link from "next/link";

export function AuthShell({
  eyebrow,
  title,
  description,
  children,
  footer,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="auth-page">
      <header className="site-header">
        <Link aria-label="Twin home" className="wordmark" href="/">
          twin<span>.</span>
        </Link>
        <span className="header-note">A little closer to what matters.</span>
      </header>
      <section aria-labelledby="auth-title" className="auth-card">
        <div className="auth-heading">
          <p className="eyebrow">{eyebrow}</p>
          <h1 id="auth-title">{title}</h1>
          <p className="auth-description">{description}</p>
        </div>
        {children}
        {footer ? <div className="auth-footer">{footer}</div> : null}
      </section>
      <footer className="page-note">
        <span>Thoughtful connections start with trust.</span>
        <span>© Twin</span>
      </footer>
    </main>
  );
}

export function FieldError({
  children,
  id,
}: {
  children?: ReactNode;
  id?: string;
}) {
  if (!children) return null;
  return (
    <p className="field-error" id={id} role="alert">
      {children}
    </p>
  );
}
