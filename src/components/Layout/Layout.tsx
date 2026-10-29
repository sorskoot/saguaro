import type { ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import styles from './Layout.module.css';

interface LayoutProps {
  children: ReactNode;
}

function SaguaroLogo() {
  return (
    <svg className={styles.logo} viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="15" r="11" fill="var(--color-desert-sand)" />
      <g fill="none" stroke="var(--color-saguaro)" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 28V7" strokeWidth="5" />
        <path d="M16 21h-4.5Q9 21 9 18.5V14M16 17h4.5q2.5 0 2.5-2.5V10" strokeWidth="3.4" />
      </g>
    </svg>
  );
}

export default function Layout({ children }: LayoutProps) {
  const { pathname } = useLocation();

  return (
    <div className={styles.shell} data-timer-view={pathname === '/'}>
      <header className={styles.navbar}>
        <span className={styles.brand}>
          <SaguaroLogo />
          Saguaro
        </span>
        <nav className={styles.navLinks}>
          <NavLink
            to="/"
            end
            className={({ isActive }) => `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`}
          >
            Timer
          </NavLink>
          <NavLink
            to="/tasks"
            className={({ isActive }) => `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`}
          >
            Tasks
          </NavLink>
          <NavLink
            to="/history"
            className={({ isActive }) => `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`}
          >
            History
          </NavLink>
          <NavLink
            to="/settings"
            className={({ isActive }) => `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`}
          >
            Settings
          </NavLink>
        </nav>
      </header>
      <main className={styles.main}>
        {children}
      </main>
    </div>
  );
}
