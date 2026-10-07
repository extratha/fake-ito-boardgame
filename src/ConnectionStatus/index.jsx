import { useEffect, useState } from 'react';
import { useConnectionStatus } from '../utils/connection';
import './ConnectionStatus.css';

// ไม่โชว์ "กำลังเชื่อมต่อ" ถ้าต่อได้เร็ว จะได้ไม่กระพริบทุกครั้งที่เปิดหน้า
const SHOW_CONNECTING_AFTER_MS = 1500;

const LABELS = {
  connecting: 'กำลังเชื่อมต่อ...',
  connected: 'ออนไลน์',
  disconnected: 'การเชื่อมต่อหลุด กำลังเชื่อมต่อใหม่...',
  unreachable: 'เชื่อมต่อฐานข้อมูลไม่ได้',
};

const ConnectionStatus = () => {
  const status = useConnectionStatus();
  const [showConnecting, setShowConnecting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowConnecting(true), SHOW_CONNECTING_AFTER_MS);
    return () => clearTimeout(timer);
  }, []);

  if (status === 'connecting' && !showConnecting) return null;

  return (
    <div className={`connection-status is-${status}`} role="status" aria-live="polite">
      <span className="connection-dot" aria-hidden="true" />
      <span>{LABELS[status]}</span>
      {status === 'unreachable' && (
        <button className="connection-retry" onClick={() => window.location.reload()}>รีเฟรช</button>
      )}
    </div>
  );
};

export default ConnectionStatus;
