import type { SessionType } from '../../types';
import styles from './ModeSelector.module.css';

interface ModeSelectorProps {
    mode: SessionType;
    onChange: (mode: SessionType) => void;
}

const TABS: { label: string; value: SessionType }[] = [
    { label: 'Spike', value: 'work' },
    { label: 'Short Break', value: 'short-break' },
    { label: 'Long Break', value: 'long-break' },
];

export default function ModeSelector({ mode, onChange }: ModeSelectorProps) {
    function getActiveClass(tabMode: SessionType): string {
        if (mode !== tabMode) return '';
        if (mode === 'short-break')
            return `${styles.active} ${styles.shortBreakActive}`;
        if (mode === 'long-break')
            return `${styles.active} ${styles.longBreakActive}`;
        return styles.active;
    }

    return (
        <nav className={styles.nav}>
            {TABS.map((tab) => (
                <button
                    key={tab.value}
                    className={`${styles.tab} ${getActiveClass(tab.value)}`}
                    onClick={() => onChange(tab.value)}
                    type="button"
                >
                    {tab.label}
                </button>
            ))}
        </nav>
    );
}
