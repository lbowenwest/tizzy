import { useEffect, useRef, type ReactNode } from 'react';

export function Dialog({ title, titleId, onClose, children }: {
  title: string; titleId: string; onClose: () => void; children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    if (!dialog.open) dialog.showModal();
  }, []);
  return (
    <dialog ref={ref} aria-labelledby={titleId} onClose={onClose}>
      <div className="dialog-heading">
        <p className="eyebrow">TIZZY</p>
        <button type="button" className="close" aria-label="Close dialog" onClick={() => ref.current?.close()}>×</button>
      </div>
      <h2 id={titleId}>{title}</h2>
      {children}
    </dialog>
  );
}
