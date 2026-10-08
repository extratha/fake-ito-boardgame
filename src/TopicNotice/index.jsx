import { useEffect, useRef, useState } from 'react';
import { ref, onValue, query, limitToLast } from 'firebase/database';
import { db } from '../firebase';
import { snapshotToList, getLatestTopic } from '../utils/roomData';
import './TopicNotice.css';

export const TOPIC_NOTICE_MS = 8000;

// แจ้งว่า host เปลี่ยนหัวข้อ (ผู้เล่นอาจเลื่อนลงไปพิมพ์แชทอยู่ จนไม่เห็นการ์ดหัวข้อ)
// silent = host เอง ไม่ต้องแจ้งซ้ำ
const TopicNotice = ({ roomPath, silent = false }) => {
  const [notice, setNotice] = useState(null);
  const lastTopicRef = useRef(undefined); // undefined = ยังไม่ได้รับค่าแรก
  const silentRef = useRef(silent);
  silentRef.current = silent;

  useEffect(() => {
    lastTopicRef.current = undefined;
    let timer;
    const topicQuery = query(ref(db, `${roomPath}/topic`), limitToLast(1));
    const unsubscribe = onValue(topicQuery, (snapshot) => {
      const latest = snapshotToList(snapshot).pop();
      const topic = getLatestTopic(latest ? [latest] : []);
      const isFirst = lastTopicRef.current === undefined;
      const changed = topic && topic !== lastTopicRef.current;
      lastTopicRef.current = topic;
      if (isFirst || !changed || silentRef.current) return;

      // วัดความหน่วงจาก host เขียน → เครื่องนี้ได้รับ (นาฬิกาแต่ละเครื่องอาจคลาดเคลื่อน ใช้ดูคร่าว ๆ)
      if (typeof latest?.createdAt === 'number') {
        console.info(`[latency] topic changed, received ${Date.now() - latest.createdAt}ms after host wrote`);
      }
      clearTimeout(timer);
      setNotice({ id: latest.id, topic });
      timer = setTimeout(() => setNotice(null), TOPIC_NOTICE_MS);
    });
    return () => { unsubscribe(); clearTimeout(timer); };
  }, [roomPath]);

  if (!notice) return null;
  return (
    <div key={notice.id} className="topic-notice" role="status">
      <span className="topic-notice-label">หัวข้อเปลี่ยนแล้ว</span>
      <strong>{notice.topic}</strong>
      <button className="topic-notice-close" onClick={() => setNotice(null)} aria-label="ปิดแจ้งเตือน">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>
  );
};

export default TopicNotice;
