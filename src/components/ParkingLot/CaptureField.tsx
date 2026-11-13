import { useEffect, useRef } from 'react';

interface CaptureFieldProps {
  /** Called with the typed text when Enter is pressed. Blank text is ignored by the caller. */
  onSubmit: (text: string) => void;
  /** Called after saving, and when Escape is pressed. */
  onClose: () => void;
  className?: string;
  inputClassName?: string;
}

/**
 * One text field for a passing thought. Enter saves and closes, Escape closes;
 * there is no confirmation and no toast so the screen looks unchanged afterwards.
 */
export default function CaptureField({
  onSubmit,
  onClose,
  className,
  inputClassName,
}: CaptureFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <form
      className={className}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(inputRef.current?.value ?? '');
        onClose();
      }}
    >
      <input
        ref={inputRef}
        className={inputClassName}
        type="text"
        aria-label="Capture a thought"
        placeholder="Park a thought, press Enter"
        autoComplete="off"
        maxLength={500}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            onClose();
          }
        }}
      />
    </form>
  );
}
