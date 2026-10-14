import Link from "next/link";
import { SettingsNavigation } from "./settings-navigation";

export function SettingsShell({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <main className="home-page">
      <header className="site-header settings-header">
        <Link aria-label="Twin home" className="wordmark" href="/home">twin<span>.</span></Link>
        <Link className="text-link" href="/home">Back to Twin</Link>
      </header>
      <div className="settings-layout">
        <aside aria-label="Account settings" className="settings-sidebar">
          <p className="eyebrow">Your account</p>
          <h1>Settings</h1>
          <SettingsNavigation />
        </aside>
        <section className="settings-panel">{children}</section>
      </div>
    </main>
  );
}
