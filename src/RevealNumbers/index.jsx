import { db } from "../firebase"; // Assuming your db is already initialized properly
import { useEffect, useState } from "react";
import { ref, onValue } from "firebase/database"; // Import from firebase/database
import { snapshotToList } from "../utils/roomData";

const ChevronLeft = () => (
  <svg className="chevron" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M15 18l-6-6 6-6" />
  </svg>
);

const RevealNumbers = ({ roomId }) => {

  const [revealNumbers, setRevealNumbers] = useState([]);
  // ซ่อน panel ได้ เพื่อไม่ให้บังปุ่ม/เลขที่อยู่ด้านหลัง
  const [isExpanded, setIsExpanded] = useState(true);

  useEffect(() => {
    const revealNumbersRef = ref(db, `rooms/${roomId}/revealNumbers`);

    const unsubscribe = onValue(revealNumbersRef, (snapshot) => {
      // เรียงตาม push key (เวลา server) ล่าสุดอยู่บน
      setRevealNumbers(snapshotToList(snapshot).reverse());
    });

    return () => unsubscribe();
  }, [roomId]);

  return (
    <aside className={`reveal-panel ${isExpanded ? '' : 'is-collapsed'}`} aria-label="เลขที่เปิดแล้ว">
      <div className="reveal-panel-header">
        <p className="reveal-panel-title">เปิดแล้ว {revealNumbers.length}</p>
        <button
          className="icon-button reveal-toggle"
          onClick={() => setIsExpanded((prev) => !prev)}
          aria-expanded={isExpanded}
          aria-controls="reveal-list"
          aria-label={isExpanded ? 'ซ่อนเลขที่เปิดแล้ว' : 'แสดงเลขที่เปิดแล้ว'}
        >
          <ChevronLeft />
        </button>
      </div>
      {isExpanded && (
        <div id="reveal-list" className="reveal-list">
          {revealNumbers.map((revealedData) => (
            <div key={revealedData.id} className="reveal-item">
              <p>{revealedData.userName}</p>
              <p className="reveal-number" style={{ color: `hsl(${200 - ((revealedData.number - 1) * 2)}, 100%, 40%)` }}>
                {revealedData.number}
              </p>
            </div>
          ))}
        </div>
      )}
    </aside>
  );
};

export default RevealNumbers;
