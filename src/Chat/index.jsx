import { useEffect, useRef, useState } from 'react';
import { ref, onValue, push, update, query, limitToLast, serverTimestamp } from 'firebase/database';
import { db } from '../firebase';
import { snapshotToList } from '../utils/roomData';
import { withTimeout, reportDbError } from '../utils/connection';

// โหลดแค่ข้อความล่าสุด ไม่ต้องดึงทั้งประวัติทุกครั้งที่มีข้อความใหม่
export const CHAT_HISTORY_LIMIT = 100;
export const CHAT_MAX_LENGTH = 200;
// ส่งได้อีกครั้งหลังผ่านไปเท่านี้ กันกดรัว/spam
export const CHAT_COOLDOWN_MS = 3000;

const Chat = ({ roomPath, clientId, userName }) => {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [now, setNow] = useState(Date.now());
  const listRef = useRef(null);
  const lastSentRef = useRef(0);
  const messagesRef = useRef([]);

  useEffect(() => {
    const chatQuery = query(ref(db, `${roomPath}/chat`), limitToLast(CHAT_HISTORY_LIMIT));
    const unsubscribe = onValue(chatQuery, (snapshot) => {
      const list = snapshotToList(snapshot);
      messagesRef.current = list;
      setMessages(list);
    });
    return () => unsubscribe();
  }, [roomPath]);

  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages]);

  // นับถอยหลังให้ปุ่มกลับมากดได้
  useEffect(() => {
    if (cooldownUntil <= Date.now()) return undefined;
    setNow(Date.now());
    const timer = setTimeout(() => setNow(Date.now()), cooldownUntil - Date.now());
    return () => clearTimeout(timer);
  }, [cooldownUntil]);

  const isCoolingDown = now < cooldownUntil;

  const handleSubmit = async (event) => {
    event.preventDefault();
    const message = text.trim().slice(0, CHAT_MAX_LENGTH);
    if (!message || !userName) return;
    // กัน submit ซ้ำ (เช่น กด Enter รัว) ที่ปุ่ม disabled ยังไม่ทัน render
    if (Date.now() - lastSentRef.current < CHAT_COOLDOWN_MS) return;
    lastSentRef.current = Date.now();

    setIsSending(true);
    try {
      const chatRef = ref(db, `${roomPath}/chat`);
      const updates = {
        [push(chatRef).key]: { clientId, userName, text: message, createdAt: serverTimestamp() },
      };
      // เก็บแค่ CHAT_HISTORY_LIMIT ข้อความ: ลบของเก่าที่เกินในคำสั่งเดียวกับที่เพิ่มข้อความใหม่
      const overflow = messagesRef.current.length + 1 - CHAT_HISTORY_LIMIT;
      messagesRef.current.slice(0, Math.max(0, overflow)).forEach((old) => { updates[old.id] = null; });
      await withTimeout(update(chatRef, updates), 'send chat');
      setText('');
      setCooldownUntil(Date.now() + CHAT_COOLDOWN_MS);
    } catch (error) {
      lastSentRef.current = 0; // ส่งไม่สำเร็จไม่ต้องรอ cooldown
      reportDbError(error, 'send chat');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <section className="card chat">
      <h2 className="card-title">แชท</h2>
      <div className="chat-list" ref={listRef} role="log" aria-live="polite" aria-label="ข้อความในห้อง">
        {messages.length === 0 && <p className="hint">ยังไม่มีข้อความ ลองพิมพ์คำใบ้ดูสิ</p>}
        {messages.map((message) => {
          const isMine = message.clientId === clientId;
          return (
            <div key={message.id} className={`chat-message ${isMine ? 'is-mine' : ''}`}>
              {!isMine && <span className="chat-author">{message.userName}</span>}
              <p className="chat-bubble">{message.text}</p>
            </div>
          );
        })}
      </div>
      <form className="chat-form" onSubmit={handleSubmit}>
        <input
          className="text-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="พิมพ์ข้อความ..."
          maxLength={CHAT_MAX_LENGTH}
          aria-label="ข้อความ"
        />
        <button type="submit" className="button-common btn-primary" disabled={isSending || isCoolingDown || !text.trim()}>{isCoolingDown ? 'รอสักครู่' : 'ส่ง'}</button>
      </form>
    </section>
  );
};

export default Chat;
