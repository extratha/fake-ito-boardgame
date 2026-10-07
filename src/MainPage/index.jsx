import React, { useState, useEffect } from 'react';
import { ref, set, get, onValue, push, remove, update, runTransaction, serverTimestamp } from "firebase/database";
import { db } from '../firebase';
import topic from '../constant/topic.json';
import HeartDisplay from '../Heart';
import RevealNumbers from '../RevealNumbers';
import Cookies from 'js-cookie';
import RuleDetail from '../RuleDetail';
import { useNavigate, useParams } from 'react-router';
import CopyIcon from "../icons/copy.svg";
import CopiedIcon from "../icons/copied.svg";
import { withTimeout, reportDbError } from '../utils/connection';
import { snapshotToList, getLatestTopic, toNumberEntries, getMyNumbers, pickRandomUnused, range } from '../utils/roomData';

import '../App.css'
import NameModal from '../NameModal';
/* eslint-disable */

const maxNumber = 100;
const maxNumbersPerPlayer = 3;
const allNumbers = range(1, maxNumber);
const topicMaxLength = topic.data.length

// id ประจำเครื่อง ใช้ระบุว่าเลขไหนเป็นของเรา (refresh แล้วเลขไม่หาย)
const getClientId = () => {
  let clientId = Cookies.get('clientId');
  if (!clientId) {
    clientId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    Cookies.set('clientId', clientId, { expires: 365 });
  }
  return clientId;
};

function MainPage() {
  const [userName, setUserName] = useState('');
  const [clientId] = useState(getClientId);
  const [myNumbers, setMyNumbers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [heart, setHeart] = useState(3);
  const [currentTopic, setCurrentTopic] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showNameModal, setShowNameModal] = useState(false);

  const navigate = useNavigate();
  const { roomId } = useParams();

  const roomPath = `rooms/${roomId}`;

  const checkIfUserIsHost = async () => {
    setIsLoading(true);
    const roomRef = ref(db, roomPath);

    try {
      const snapshot = await withTimeout(get(roomRef), 'check host');
      if (snapshot.exists()) {
        const roomData = snapshot.val();
        setIsHost(roomData.host === userName);
      } else {
        console.log('Room not found');
      }
    } catch (error) {
      reportDbError(error, 'check host');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUsedTopics = async () => {
    const snapshot = await withTimeout(get(ref(db, `${roomPath}/topic`)), 'fetch topics');
    const topicsArray = snapshotToList(snapshot);
    console.log("จำนวนหัวข้อทั้งหมด", topicMaxLength, "สุ่มไปแล้ว", topicsArray.length)
    return topicsArray.map(item => item.topic);
  };

  const fetchNumberEntries = async () => {
    const snapshot = await withTimeout(get(ref(db, `${roomPath}/numbers`)), 'fetch numbers');
    return toNumberEntries(snapshotToList(snapshot));
  };

  // จองเลขแบบ atomic: ถ้ามีคนจองเลขนี้ไปก่อน transaction จะไม่ commit
  const claimNumber = async (number) => {
    const numberRef = ref(db, `${roomPath}/numbers/${number}`);
    const result = await withTimeout(runTransaction(numberRef, (current) => {
      if (current !== null) return; // abort
      return { owner: clientId, userName, createdAt: serverTimestamp() };
    }), 'claim number');
    return result.committed;
  };

  const drawNumber = async () => {
    if (myNumbers.length >= maxNumbersPerPlayer) {
      alert('คุณสุ่มเลขครบแล้ว');
      return;
    }

    setIsLoading(true);
    try {
      let usedNumbers = (await fetchNumberEntries()).map(item => item.number);
      while (true) {
        const randomNumber = pickRandomUnused(allNumbers, usedNumbers);
        if (randomNumber === null) {
          alert('เลขทั้งหมดถูกใช้ไปแล้ว! กรุณาเคลียร์เลขเพื่อสุ่มใหม่');
          return;
        }
        if (await claimNumber(randomNumber)) return;
        usedNumbers = [...usedNumbers, randomNumber]; // มีคนแย่งไปก่อน สุ่มใหม่
      }
    } catch (error) {
      reportDbError(error, 'draw number');
    } finally {
      setIsLoading(false);
    }
  };

  const clearUsedNumbers = async () => {
    if (confirm('ยืนยันจะเคลียร์ที่ทุกคนสุ่มไปแล้วไหม')) {
      setIsLoading(true);
      try {
        await withTimeout(remove(ref(db, `${roomPath}/numbers`)), 'clear all numbers');
      } catch (error) {
        reportDbError(error, 'clear all numbers');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const clearMyNumbers = async () => {
    if (confirm('คุณต้องการเคลียร์เลขที่เคยสุ่มไปแล้วใช่หรือไม่?')) {
      setIsLoading(true);
      try {
        const entries = await fetchNumberEntries();
        const updates = {};
        entries
          .filter(item => item.owner === clientId)
          .forEach(item => { updates[`numbers/${item.id}`] = null; });
        if (Object.keys(updates).length > 0) {
          await withTimeout(update(ref(db, roomPath), updates), 'clear my numbers');
        }
        alert('เคลียร์เลขที่สุ่มไปแล้วเรียบร้อย!');
      } catch (error) {
        reportDbError(error, 'clear my numbers');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleRandomTopic = async () => {
    if (confirm('สุ่มหัวข้อใหม่เท่ากับเริ่มเกมใหม่ ยืนยันหรือไม่')) {
      setIsLoading(true);

      try {
        await resetGameData();
        const usedTopics = await fetchUsedTopics()
        const randomTopic = pickRandomUnused(topic.data, usedTopics);

        if (randomTopic === null) {
          alert('หัวข้อทั้งหมดถูกใช้ไปแล้ว! กรุณาเคลียร์หัวข้อเพื่อเริ่มใหม่');
          return;
        }

        await withTimeout(set(push(ref(db, `${roomPath}/topic`)), {
          topic: randomTopic,
          createdAt: serverTimestamp(),
        }), 'random topic');
        setCurrentTopic(randomTopic);
      } catch (error) {
        reportDbError(error, 'random topic');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const clearUsedTopics = async () => {
    if (confirm('ยืนยันจะเคลียร์หัวข้อที่เคยสุ่มแล้วหรือไม่?')) {
      setIsLoading(true);
      try {
        await withTimeout(remove(ref(db, `${roomPath}/topic`)), 'clear topics');
        setCurrentTopic('');
      } catch (error) {
        reportDbError(error, 'clear topics');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const resetGameData = () =>
    withTimeout(update(ref(db, roomPath), { numbers: null, revealNumbers: null }), 'reset game');

  const handleClickNumber = async (number) => {
    const revealNumbersRef = ref(db, `${roomPath}/revealNumbers`);

    try {
      const snapshot = await withTimeout(get(revealNumbersRef), 'fetch revealed numbers');
      const isNumberRevealed = snapshotToList(snapshot).some((item) => item.number === number);
      if (isNumberRevealed) {
        alert('เลขนี้เคยถูกเปิดเผยแล้ว');
        return;
      }

      if (confirm('เปิดเผยเลขของคุณให้สังคมรับรู้')) {
        await withTimeout(set(push(revealNumbersRef), {
          number,
          userName,
          createdAt: serverTimestamp(),
        }), 'reveal number');
      }
    } catch (error) {
      reportDbError(error, 'reveal number');
    }
  };

  const handleResetHeart = () => {
    withTimeout(set(ref(db, `${roomPath}/heart`), 3), 'reset heart')
      .catch((error) => reportDbError(error, 'reset heart'));
  };

  // ใช้ transaction กันกดพร้อมกันแล้วหัวใจลดไม่ครบ
  const handleReduceHeart = () => {
    withTimeout(runTransaction(ref(db, `${roomPath}/heart`), (current) => {
      const value = current ?? 3;
      if (value <= 0) return; // abort
      return value - 1;
    }), 'reduce heart').catch((error) => reportDbError(error, 'reduce heart'));
  };

  const copyToClipboard = () => {
    if (roomId) {
      navigator.clipboard.writeText(roomId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const handleClickBack = () => {
    navigate("/")
  }

  useEffect(() => {
    const savedUserName = Cookies.get('userName');
    if (savedUserName) {
      setUserName(savedUserName);
    } else {
      setShowNameModal(true);
    }
  }, []);

  useEffect(() => {
    const heartRef = ref(db, `${roomPath}/heart`);
    const unsubscribe = onValue(heartRef, (snapshot) => {
      if (snapshot.exists()) {
        setHeart(snapshot.val());
      }
    });

    return () => unsubscribe();
  }, [roomPath]);

  useEffect(() => {
    const topicRef = ref(db, `${roomPath}/topic`);
    const unsubscribe = onValue(topicRef, (snapshot) => {
      setCurrentTopic(getLatestTopic(snapshotToList(snapshot)));
    });

    return () => unsubscribe();
  }, [roomPath]);

  // sync เลขของตัวเองจาก DB: ถ้ามีคนเริ่มเกมใหม่/เคลียร์เลขทุกคน เลขในจอจะหายตาม
  useEffect(() => {
    const numbersRef = ref(db, `${roomPath}/numbers`);
    const unsubscribe = onValue(numbersRef, (snapshot) => {
      setMyNumbers(getMyNumbers(toNumberEntries(snapshotToList(snapshot)), clientId));
    });

    return () => unsubscribe();
  }, [roomPath, clientId]);

  useEffect(() => {
    withTimeout(get(ref(db, roomPath)), 'check room').then((snapshot) => {
      if (!snapshot.exists()) {
        navigate("/");
      }
    }).catch((error) => {
      reportDbError(error, 'check room');
      navigate("/");
    });
  }, [roomPath, navigate]);

  useEffect(() => {
    if (userName) {
      checkIfUserIsHost();
    }
  }, [userName, roomId]);

  return (
    <div className="App">
      <div className='wrapper'>
        {isLoading ?
          <h3 className="loading">กำลังโหลด...</h3>
          :
          <div className="stack">
            <div className="room-header">
              <button className="button-common" onClick={() => handleClickBack()}>ย้อนกลับ</button>
              <div className="room-id">
                <h2>ห้อง: {roomId}</h2>
                {roomId && (
                  <button className="icon-button" onClick={copyToClipboard} aria-label={copied ? 'คัดลอกรหัสห้องแล้ว' : 'คัดลอกรหัสห้อง'}>
                    {copied ? <img src={CopiedIcon} alt="" /> : <img src={CopyIcon} alt="" />}
                  </button>
                )}
              </div>
              {/* <RuleDetail /> */}
            </div>

            <section className="card">
              <p className="eyebrow">หัวข้อ:</p>
              <div className="topic-display">
                {currentTopic
                  ? <h2>{currentTopic}</h2>
                  : <p className="topic-empty">ยังไม่มีหัวข้อ กดสุ่มเพื่อเริ่มเกม</p>}
              </div>
              <div className="button-row">
                <button className="button-common btn-primary" onClick={handleRandomTopic}>สุ่มหัวข้อ</button>
                {isHost && <button className="button-common" onClick={clearUsedTopics}>เคลียร์หัวข้อที่เคยสุ่มแล้ว</button>}
              </div>
            </section>

            <section className="card">
              <h2 className="card-title">สุ่มเลข 1-{maxNumber}</h2>

              <div className="button-row">
                <button className="button-common btn-secondary btn-lg" disabled={myNumbers.length >= 1} onClick={drawNumber}>สุ่มเลข</button>
                {myNumbers.length > 0 && myNumbers.length < maxNumbersPerPlayer && <button className="button-common btn-secondary btn-lg" onClick={drawNumber}>สุ่มอีกเลข</button>}
              </div>

              {myNumbers.length > 0 &&
                <>
                  <p className="eyebrow">เลขที่ออก</p>
                  <div className="number-tiles">
                    {myNumbers.map((value) => (
                      <h1
                        key={value}
                        className="number-tile"
                        role="heading"
                        aria-level={1}
                        tabIndex={0}
                        onClick={() => handleClickNumber(value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClickNumber(value); } }}
                        style={{ color: `hsl(${200 - ((value - 1) * 2)}, 100%, 40%)` }}
                      >
                        {value}
                      </h1>
                    ))}
                  </div>
                  <p className="hint">แตะที่เลขเพื่อเปิดเผยให้ทุกคนเห็น</p>
                </>
              }

              <div className="button-row">
                <button className="button-common" onClick={clearMyNumbers}>เคลียร์เลขของตัวเอง</button>
                {isHost && <button className="button-common btn-danger" onClick={clearUsedNumbers}>เคลียร์เลขทุกคน</button>}
              </div>
            </section>

            <HeartDisplay roomId={roomId} heart={heart} setHeart={setHeart} onReduceHeart={handleReduceHeart} onResetHeart={handleResetHeart} />
            <RevealNumbers roomId={roomId} />
          </div>
        }
        {
          showNameModal && <NameModal userName={userName} setUserName={setUserName} setShowNameModal={setShowNameModal} />
        }
      </div>
    </div>
  );
}

export default MainPage;
