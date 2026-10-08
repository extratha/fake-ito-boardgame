import { useEffect, useRef, useState } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../firebase';
import './MissTaunt.css';

export const TAUNT_DURATION_MS = 4000;
export const EDGES = ['top', 'bottom', 'left', 'right'];
export const TAUNTS = [
  'นับเลขเป็นไหมน้อง',
  'การสื่อสารเป็นสิ่งสำคัญ',
  'ว้าย ว้าาาาายยยยย',
  'แล้วตอนที่เขาคุยกันทำไมไม่ตั้งใจฟัง',
  'คิดดี ๆ ก่อนเปิดไหม หรือคิดไม่เป็น',
  'เลขในมือเพื่อนยังไม่ทันได้เปิดเลย',
  'มั่นใจเกินร้อย ผลลัพธ์เกินเลข',
  'อย่าให้มีครั้งที่ 2',
  'อย่าให้มีครั้งที่ 437',
  'สัญชาตญาณหรือสุ่มมั่ว ตอบมา',
  'รู้ไหมว่านี่งานกลุ่ม',
  'เลขกระโดด ให้อยู่ในคูหาก็พอ',
  'ครั้งหน้าลองเปิดตามเลขจริงดูนะ',
];

// event ที่เขียนลง DB มีแค่ id + ข้อความ (ทุกเครื่องต้องเห็นคำเดียวกัน) ส่วนตำแหน่งแต่ละเครื่องสุ่มเอง
export const createTauntEvent = (random = Math.random) => ({
  id: `${Date.now()}-${Math.floor(random() * 1e9)}`,
  index: Math.floor(random() * TAUNTS.length),
});

export const randomPlacement = (random = Math.random) => ({
  edge: Math.floor(random() * EDGES.length),
  offset: Math.round(10 + random() * 80),
});

const positionStyle = ({ edge, offset }) => {
  switch (EDGES[edge]) {
    case 'top': return { top: 12, left: `${offset}%`, transform: `translateX(-${offset}%)` };
    case 'bottom': return { bottom: 12, left: `${offset}%`, transform: `translateX(-${offset}%)` };
    case 'left': return { left: 12, top: `${offset}%`, transform: `translateY(-${offset}%)` };
    default: return { right: 12, top: `${offset}%`, transform: `translateY(-${offset}%)` };
  }
};

const MissTaunt = ({ roomPath }) => {
  const [taunt, setTaunt] = useState(null);
  const seenRef = useRef(undefined); // id ล่าสุดที่เห็น (undefined = ยังไม่ได้รับค่าแรก)

  useEffect(() => {
    seenRef.current = undefined;
    let timer;
    const unsubscribe = onValue(ref(db, `${roomPath}/taunt`), (snapshot) => {
      const event = snapshot.val();
      const isFirst = seenRef.current === undefined;
      seenRef.current = event?.id ?? null;
      // ค่าแรกที่โหลดมาเป็นของเก่า ไม่โชว์ซ้ำตอนเพิ่งเข้าห้อง/รีเฟรช
      if (isFirst || !event || !TAUNTS[event.index]) return;
      clearTimeout(timer);
      setTaunt({ ...event, ...randomPlacement() });
      timer = setTimeout(() => setTaunt(null), TAUNT_DURATION_MS);
    });
    return () => { unsubscribe(); clearTimeout(timer); };
  }, [roomPath]);

  if (!taunt) return null;
  return (
    <div key={taunt.id} className="miss-taunt" role="status" style={positionStyle(taunt)}>
      {TAUNTS[taunt.index]}
    </div>
  );
};

export default MissTaunt;
