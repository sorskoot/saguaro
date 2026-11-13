import type { ParkingLotItem } from '../../types';
import styles from './ParkingLotList.module.css';

interface ParkingLotListProps {
  items: ParkingLotItem[];
  onMakeTask: (item: ParkingLotItem) => void;
  onDismiss: (item: ParkingLotItem) => void;
}

/** A plain list of parked thoughts, for clearing them outside Re-entry. Renders nothing when empty. */
export default function ParkingLotList({ items, onMakeTask, onDismiss }: ParkingLotListProps) {
  if (items.length === 0) return null;
  return (
    <section className={styles.section} aria-labelledby="parking-lot-title">
      <h2 id="parking-lot-title" className={styles.title}>
        Parking lot <span className={styles.count}>{items.length}</span>
      </h2>
      <ul className={styles.list}>
        {items.map((item) => (
          <li key={item.id} className={styles.row}>
            <span className={styles.text}>{item.text}</span>
            <span className={styles.actions}>
              <button
                className={styles.btn}
                type="button"
                onClick={() => onMakeTask(item)}
                aria-label={`Make task: ${item.text}`}
              >
                Make task
              </button>
              <button
                className={styles.btn}
                type="button"
                onClick={() => onDismiss(item)}
                aria-label={`Dismiss: ${item.text}`}
              >
                Dismiss
              </button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
