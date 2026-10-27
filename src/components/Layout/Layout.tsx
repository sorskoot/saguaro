import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import styles from './Layout.module.css';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className={styles.shell}>
      <header className={styles.navbar}>
        <span className={styles.brand}>Pomodoro</span>
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
