import { useEffect, useRef, useState } from 'react';
import '../App.css'

// section นี้เป็น position: sticky (bottom) ติดขอบล่างจอจนกว่าจะ scroll ถึงตำแหน่งจริง
// ใช้ sentinel ที่อยู่ถัดลงไปดูว่าตอนนี้ "ติดขอบ" อยู่ไหม เพื่อใส่เงา (ห้ามเปลี่ยนขนาด ไม่งั้นจะสลับสถานะวนจนกระพริบ)
const HeartDisplay = ({ heart, onReduceHeart, onResetHeart }) => {
  const [isStuck, setIsStuck] = useState(false);
  const sentinelRef = useRef(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver(([entry]) => {
      // sentinel ยังอยู่ใต้จอ = ยังไม่ถึงตำแหน่งจริง = กำลังติดขอบล่าง
      setIsStuck(!entry.isIntersecting && entry.boundingClientRect.top > 0);
    });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <section className={`card heart-card ${isStuck ? 'is-stuck' : ''}`}>
        <div className="hearts" role="img" aria-label={`หัวใจเหลือ ${heart} จาก 3`}>
          {[...Array(3)].map((_, index) => {
            const isLost = index < 3 - heart;
            return (
              <svg
                key={index}
                className={`heart ${isLost ? 'heart-lost' : ''}`}
                width="44"
                height="44"
                viewBox="0 0 24 24"
                fill={isLost ? '#475569' : '#ef4444'}
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
            );
          })}
        </div>
        <div className="button-row">
          <button className="button-common btn-danger" onClick={onReduceHeart} disabled={heart < 1}>ลด 1 หัวใจ</button>
          <button className="button-common" onClick={onResetHeart}>รีหัวใจ</button>
        </div>
      </section>
      <div ref={sentinelRef} className="heart-sentinel" aria-hidden="true" />
    </>
  );
};

export default HeartDisplay;
