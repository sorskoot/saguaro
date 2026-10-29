import { useRef, useCallback } from 'react';
import { ExportService } from '../services/ExportService';
import { getStorageService } from '../services/StorageService';

export interface UseExportOptions {
    /** Called after a successful import operation. */
    onSuccess?: () => void;
    /** Called when import fails; receives an error message. */
    onError?: (msg: string) => void;
}

export interface UseExportResult {
    /**
     * Exports the current application data to a downloadable JSON file.
     *
     * Triggers a browser download and does not return a value.
     */
    exportToFile: () => void;

    /**
     * Imports application data from the provided JSON file.
     *
     * @param file - A JSON file containing exported pomodoro data.
     * @returns Resolves when import completes successfully.
     * @throws Does not throw to the caller; errors are handled via `onError`.
     */
    importFromFile: (file: File) => Promise<void>;
}

/** Formats a Date as `YYYY-MM-DD` for use in the backup filename. */
function formatDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/**
 * Provides export/import functionality backed by `ExportService`.
 *
 * Uses an internal service instance stored in a ref to avoid recreating it.
 *
 * @param options - Callback hooks for success and error scenarios during import.
 * @returns Export handlers for downloading and uploading JSON backups.
 */
export function useExport({
    onSuccess,
    onError,
}: UseExportOptions = {}): UseExportResult {
    const serviceRef = useRef<ExportService | null>(null);
    if (serviceRef.current === null) {
        serviceRef.current = new ExportService(getStorageService());
    }
    const service = serviceRef.current;

    const exportToFile = useCallback(() => {
        const data = service.exportData();
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const filename = `saguaro-backup-${formatDate(new Date())}.json`;

        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = filename;
        anchor.click();

        // Release the object URL after the browser has had a chance to initiate
        // the download.
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, [service]);

    const importFromFile = useCallback(
        async (file: File): Promise<void> => {
            try {
                const text = await file.text();
                const parsed: unknown = JSON.parse(text);
                service.importData(parsed);
                onSuccess?.();
            } catch (err) {
                const msg =
                    err instanceof Error
                        ? err.message
                        : 'Unknown error during import';
                onError?.(msg);
            }
        },
        [service, onSuccess, onError],
    );

    return { exportToFile, importFromFile };
}
