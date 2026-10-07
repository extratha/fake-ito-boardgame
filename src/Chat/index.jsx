import { useEffect, useRef, useState } from 'react';
import { ref, onValue, push, set, query, limitToLast, serverTimestamp } from 'firebase/database';
import { db } from '../firebase';
import { snapshotToList } from '../utils/roomData';
import { withTimeout, reportDbError } from '../utils/connection';

// โหลดแค่ข้อความล่าสุด ไม่ต้องดึงทั้งประวัติทุกครั้งที่มีข้อความใหม่
export const CHAT_HISTORY_LIMIT = 100;
export const CHAT_MAX_LENGTH = 200;

const Chat = ({ roomPath, clientId, userName }) => {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const listRef = useRef(null);

  useEffect(() => {
    const chatQuery = query(ref(db, `${roomPath}/chat`), limitToLast(CHAT_HISTORY_LIMIT));
    const unsubscribe = onValue(chatQuery, (snapshot) => setMessages(snapshotToList(snapshot)));
    return () => unsubscribe();
  }, [roomPath]);

  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const message = text.trim().slice(0, CHAT_MAX_LENGTH);
    if (!message || !userName) return;

    setIsSending(true);
    try {
      await withTimeout(set(push(ref(db, `${roomPath}/chat`)), {
        clientId,
        userName,
        text: message,
        createdAt: serverTimestamp(),
      }), 'send chat');
      setText('');
    } catch (error) {
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
        <button type="submit" className="button-common btn-primary" disabled={isSending || !text.trim()}>ส่ง</button>
      </form>
    </section>
  );
};

export default Chat;
