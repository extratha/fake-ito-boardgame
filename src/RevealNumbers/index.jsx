import { db } from "../firebase"; // Assuming your db is already initialized properly
import { useEffect, useRef, useState } from "react";
import { ref, onValue } from "firebase/database"; // Import from firebase/database
import { snapshotToList } from "../utils/roomData";

export const PANEL_POSITION_KEY = 'revealPanelPosition';
export const DEFAULT_PANEL_POSITION = { side: 'left', top: 96 }; // ใต้ header ไม่บังปุ่มย้อนกลับ/ป้าย host
const EDGE_GAP = 8;
const DRAG_THRESHOLD = 5; // ขยับไม่ถึงนี้ถือว่าเป็นการแตะ ไม่ใช่การลาก
const MIN_VISIBLE_HEIGHT = 60;

// ตำแหน่ง panel เป็นค่าส่วนตัวของแต่ละเครื่อง เก็บใน localStorage พอ
const loadPosition = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(PANEL_POSITION_KEY));
    if ((saved?.side === 'left' || saved?.side === 'right') && Number.isFinite(saved.top)) return saved;
  } catch (e) { /* ignore */ }
  return DEFAULT_PANEL_POSITION;
};

const savePosition = (position) => {
  try { localStorage.setItem(PANEL_POSITION_KEY, JSON.stringify(position)); } catch (e) { /* ignore */ }
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), Math.max(min, max));
const clampTop = (top) => clamp(top, EDGE_GAP, window.innerHeight - MIN_VISIBLE_HEIGHT);

// ปล่อยแล้วชิดขอบฝั่งที่จุดกลาง panel อยู่
export const snapSide = (left, width, viewportWidth) => (left + width / 2 < viewportWidth / 2 ? 'left' : 'right');

const Chevron = () => (
  <svg className="chevron" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 15l6-6 6 6" />
  </svg>
);

const GripIcon = () => (
  <svg className="reveal-grip" width="10" height="16" viewBox="0 0 10 16" fill="currentColor" aria-hidden="true">
    <circle cx="2" cy="3" r="1.5" /><circle cx="8" cy="3" r="1.5" />
    <circle cx="2" cy="8" r="1.5" /><circle cx="8" cy="8" r="1.5" />
    <circle cx="2" cy="13" r="1.5" /><circle cx="8" cy="13" r="1.5" />
  </svg>
);

const RevealNumbers = ({ roomId }) => {

  const [revealNumbers, setRevealNumbers] = useState([]);
  // ซ่อน panel ได้ เพื่อไม่ให้บังปุ่ม/เลขที่อยู่ด้านหลัง
  const [isExpanded, setIsExpanded] = useState(true);
  const [position, setPosition] = useState(loadPosition);
  const [dragPosition, setDragPosition] = useState(null); // { left, top } ระหว่างลาก
  const [, setViewportVersion] = useState(0);
  const panelRef = useRef(null);
  const dragRef = useRef(null);
  const suppressClickRef = useRef(false);

  useEffect(() => {
    const revealNumbersRef = ref(db, `rooms/${roomId}/revealNumbers`);

    const unsubscribe = onValue(revealNumbersRef, (snapshot) => {
      // เรียงตาม push key (เวลา server) ล่าสุดอยู่บน
      setRevealNumbers(snapshotToList(snapshot).reverse());
    });

    return () => unsubscribe();
  }, [roomId]);

  // หมุนจอ/ย่อหน้าต่าง: คำนวณ top ที่ clamp ใหม่
  useEffect(() => {
    const handleResize = () => setViewportVersion((v) => v + 1);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handlePointerDown = (event) => {
    if (event.button !== undefined && event.button !== 0) return;
    const rect = panelRef.current.getBoundingClientRect();
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      moved: false,
    };
  };

  const handlePointerMove = (event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.moved) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      drag.moved = true;
      // capture เมื่อเริ่มลากจริงเท่านั้น การแตะปุ่มพับ/กางจึงยังเป็น click ปกติ
      event.currentTarget.setPointerCapture?.(event.pointerId);
    }
    setDragPosition({
      left: clamp(drag.left + dx, 0, window.innerWidth - drag.width),
      top: clamp(drag.top + dy, 0, window.innerHeight - Math.min(drag.height, MIN_VISIBLE_HEIGHT)),
    });
  };

  const handlePointerEnd = (event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (!drag.moved) return;

    const left = clamp(drag.left + event.clientX - drag.startX, 0, window.innerWidth - drag.width);
    const top = clampTop(drag.top + event.clientY - drag.startY);
    const next = { side: snapSide(left, drag.width, window.innerWidth), top };
    setPosition(next);
    savePosition(next);
    setDragPosition(null);
    // ไม่ให้การปล่อยนิ้วบนปุ่มไปพับ panel (click จะตามมาทันทีหลัง pointerup ถ้ามี)
    suppressClickRef.current = true;
    setTimeout(() => { suppressClickRef.current = false; }, 0);
  };

  const handleToggle = () => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    setIsExpanded((prev) => !prev);
  };

  const top = dragPosition ? dragPosition.top : clampTop(position.top);
  // ไม่ใส่ property ของอีกฝั่งเลย (React จะลบออกให้) แทนการตั้งเป็น 'auto'
  const style = dragPosition
    ? { left: dragPosition.left, top }
    : { [position.side]: EDGE_GAP, top };
  style.maxHeight = `calc(100vh - ${top + 16}px)`;

  const classNames = [
    'reveal-panel',
    isExpanded ? '' : 'is-collapsed',
    position.side === 'right' ? 'is-right' : '',
    dragPosition ? 'is-dragging' : '',
  ].filter(Boolean).join(' ');

  return (
    <aside ref={panelRef} className={classNames} style={style} aria-label="เลขที่เปิดแล้ว">
      <div
        className="reveal-panel-header"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        title="ลากเพื่อย้ายไปชิดซ้าย/ขวา"
      >
        <GripIcon />
        <p className="reveal-panel-title">เปิดแล้ว {revealNumbers.length}</p>
        <button
          className="icon-button reveal-toggle"
          onClick={handleToggle}
          aria-expanded={isExpanded}
          aria-controls="reveal-list"
          aria-label={isExpanded ? 'ซ่อนเลขที่เปิดแล้ว' : 'แสดงเลขที่เปิดแล้ว'}
        >
          <Chevron />
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
