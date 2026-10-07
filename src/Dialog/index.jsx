import { useEffect, useRef, useState } from 'react';
import { subscribeDialogs, resolveDialog } from './dialogStore';
import './Dialog.css';

// แสดง dialog ทีละอัน ตามลำดับที่ถูกเรียก
const DialogHost = () => {
  const [queue, setQueue] = useState([]);
  const confirmRef = useRef(null);
  const cancelRef = useRef(null);
  const dialog = queue[0];

  useEffect(() => subscribeDialogs(setQueue), []);

  useEffect(() => {
    if (!dialog) return undefined;
    const previousFocus = document.activeElement;
    confirmRef.current?.focus();
    return () => previousFocus?.focus?.();
  }, [dialog]);

  if (!dialog) return null;

  const isConfirm = dialog.type === 'confirm';
  const close = (value) => resolveDialog(dialog.id, value);
  const cancelValue = isConfirm ? false : undefined;

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close(cancelValue);
    } else if (event.key === 'Tab' && isConfirm) {
      // วน focus อยู่ในกล่อง (มีแค่ 2 ปุ่ม)
      event.preventDefault();
      (document.activeElement === confirmRef.current ? cancelRef : confirmRef).current?.focus();
    }
  };

  return (
    <div className="dialog-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) close(cancelValue); }}>
      <div
        className="dialog-box"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={dialog.title ? `dialog-title-${dialog.id}` : undefined}
        aria-describedby={`dialog-message-${dialog.id}`}
        onKeyDown={handleKeyDown}
      >
        {dialog.title && <h3 id={`dialog-title-${dialog.id}`} className="dialog-title">{dialog.title}</h3>}
        <p id={`dialog-message-${dialog.id}`} className="dialog-message">{dialog.message}</p>
        <div className="dialog-actions">
          {isConfirm && (
            <button ref={cancelRef} className="button-common" onClick={() => close(false)}>
              {dialog.cancelText}
            </button>
          )}
          <button
            ref={confirmRef}
            className={`button-common ${dialog.tone === 'danger' ? 'btn-danger' : 'btn-primary'}`}
            onClick={() => close(isConfirm ? true : undefined)}
          >
            {dialog.confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DialogHost;
