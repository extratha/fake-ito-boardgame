import { useEffect, useState } from 'react';
import './WinCelebration.css';

export const WIN_BANNER_MS = 6000;

// ชนะรอบนี้: ขอบจอสีรุ้งวิ่งค้างไว้จนกว่าจะเริ่มรอบใหม่ + ป้าย "ผ่านหมด!" ชั่วครู่
const WinCelebration = ({ active }) => {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    if (!active) {
      setShowBanner(false);
      return undefined;
    }
    setShowBanner(true);
    const timer = setTimeout(() => setShowBanner(false), WIN_BANNER_MS);
    return () => clearTimeout(timer);
  }, [active]);

  if (!active) return null;

  return (
    <>
      <div className="win-border" aria-hidden="true" />
      {showBanner && (
        <div className="win-banner" role="status">
          <span className="win-banner-emoji" aria-hidden="true">🎉</span>
          <div>
            <strong>ผ่านหมด!</strong>
            <p>เปิดครบทุกใบ เรียงถูกทั้งหมด</p>
          </div>
          <button className="win-banner-close" onClick={() => setShowBanner(false)} aria-label="ปิด">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
      )}
    </>
  );
};

export default WinCelebration;
