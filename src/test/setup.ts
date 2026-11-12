import '@testing-library/jest-dom';
import { setDataStore } from '../services/db/DataStore';

// Every test starts with an empty, in-memory data store.
beforeEach(() => {
    setDataStore(null);
});
