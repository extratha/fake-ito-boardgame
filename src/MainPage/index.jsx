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
      const snapshot = await get(roomRef);
      if (snapshot.exists()) {
        const roomData = snapshot.val();
        setIsHost(roomData.host === userName);
      } else {
        console.log('Room not found');
      }
    } catch (error) {
      console.error('Error fetching room data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUsedTopics = async () => {
    const snapshot = await get(ref(db, `${roomPath}/topic`));
    const topicsArray = snapshotToList(snapshot);
    console.log("จำนวนหัวข้อทั้งหมด", topicMaxLength, "สุ่มไปแล้ว", topicsArray.length)
    return topicsArray.map(item => item.topic);
  };

  const fetchNumberEntries = async () => {
    const snapshot = await get(ref(db, `${roomPath}/numbers`));
    return toNumberEntries(snapshotToList(snapshot));
  };

  // จองเลขแบบ atomic: ถ้ามีคนจองเลขนี้ไปก่อน transaction จะไม่ commit
  const claimNumber = async (number) => {
    const numberRef = ref(db, `${roomPath}/numbers/${number}`);
    const result = await runTransaction(numberRef, (current) => {
      if (current !== null) return; // abort
      return { owner: clientId, userName, createdAt: serverTimestamp() };
    });
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
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const clearUsedNumbers = async () => {
    if (confirm('ยืนยันจะเคลียร์ที่ทุกคนสุ่มไปแล้วไหม')) {
      setIsLoading(true);
      try {
        await remove(ref(db, `${roomPath}/numbers`));
      } catch (error) {
        console.error(error);
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
          await update(ref(db, roomPath), updates);
        }
        alert('เคลียร์เลขที่สุ่มไปแล้วเรียบร้อย!');
      } catch (error) {
        console.error(error);
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

        await set(push(ref(db, `${roomPath}/topic`)), {
          topic: randomTopic,
          createdAt: serverTimestamp(),
        });
        setCurrentTopic(randomTopic);
      } catch (error) {
        console.error("Error fetching topics:", error);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const clearUsedTopics = async () => {
    if (confirm('ยืนยันจะเคลียร์หัวข้อที่เคยสุ่มแล้วหรือไม่?')) {
      setIsLoading(true);
      try {
        await remove(ref(db, `${roomPath}/topic`));
        setCurrentTopic('');
      } catch (error) {
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const resetGameData = async () => {
    try {
      await update(ref(db, roomPath), { numbers: null, revealNumbers: null });
    } catch (e) {
      console.error('Error resetting game data: ', e);
    }
  };

  const handleClickNumber = async (number) => {
    const revealNumbersRef = ref(db, `${roomPath}/revealNumbers`);

    try {
      const snapshot = await get(revealNumbersRef);
      const isNumberRevealed = snapshotToList(snapshot).some((item) => item.number === number);
      if (isNumberRevealed) {
        alert('เลขนี้เคยถูกเปิดเผยแล้ว');
        return;
      }

      if (confirm('เปิดเผยเลขของคุณให้สังคมรับรู้')) {
        await set(push(revealNumbersRef), {
          number,
          userName,
          createdAt: serverTimestamp(),
        });
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleResetHeart = () => {
    set(ref(db, `${roomPath}/heart`), 3);
  };

  // ใช้ transaction กันกดพร้อมกันแล้วหัวใจลดไม่ครบ
  const handleReduceHeart = () => {
    runTransaction(ref(db, `${roomPath}/heart`), (current) => {
      const value = current ?? 3;
      if (value <= 0) return; // abort
      return value - 1;
    }).catch(console.error);
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
    get(ref(db, roomPath)).then((snapshot) => {
      if (!snapshot.exists()) {
        navigate("/");
      }
    }).catch((error) => {
      console.error("Error fetching room data:", error);
      alert('somethings wrong ')
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
          <h3> ...LOADING...</h3>
          :
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '0 12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', padding: '0 12px' }} >
              <button className="button-common" onClick={() => handleClickBack()}>ย้อนกลับ</button>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', }}>
                <h2 style={{ margin: '0' }}> ห้อง: </h2>
                <h2 style={{ margin: '0' }}>{roomId}</h2>
                {roomId && (
                  <button onClick={copyToClipboard} style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center"
                  }}>
                    {copied ? <img src={CopiedIcon} alt="copy" /> : <img src={CopyIcon} alt="copy" />}
                  </button>
                )}
              </div>
              {/* <RuleDetail /> */}
            </div>

            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px', }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: "8px", alignItems: 'center', border: '1px solid gray', borderRadius: '4px', padding: "16px" }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <button className="button-common" onClick={handleRandomTopic}>สุ่มหัวข้อ</button>
                  {isHost &&<button className="button-common" onClick={clearUsedTopics} >เคลียร์หัวข้อที่เคยสุ่มแล้ว</button> }
                </div>

                <div style={{ display: "flex", flexDirection: "row", gap: '8px', alignItems: 'center' }}>
                  <p style={{ margin: "0", fontSize: '22px', fontWeight: '500' }}> หัวข้อ: </p>
                  <h2 style={{ margin: "0" }}> {currentTopic}</h2>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: "16px", alignItems: 'center', border: '1px solid gray', borderRadius: '4px', padding: "16px" }}>
                <h2 style={{ margin: "8px" }}>สุ่มเลข 1-{maxNumber}</h2>

                <button className="button-common" style={{ width: "120px" }} disabled={myNumbers.length >= 1} onClick={drawNumber}>สุ่มเลข</button>
                {myNumbers.length > 0 && myNumbers.length < maxNumbersPerPlayer && <button className="button-common" onClick={drawNumber}>สุ่มอีกเลข</button>}

                {myNumbers &&
                  <div style={{ display: 'flex', flexDirection: "column", gap: "16px", alignItems: 'center' }}>
                    <h2 style={{ margin: "16px 0 0", color: myNumbers.length > 0 ? 'default' : 'transparent' }}>เลขที่ออก</h2>
                    <div style={{ display: 'flex', gap: '14px' }}>
                      {myNumbers.map((value) => (
                        <h1 key={value}
                          onClick={() => handleClickNumber(value)}
                          style={{
                            width: '79px',
                            margin: '0 0 16px', cursor: 'pointer', color: `hsl(${200 - ((value - 1) * 2)}, 100%, 40%)`,
                            borderRadius: "8px",
                            boxShadow: "2px 2px 5px rgb(0, 0, 0)",
                            padding: "8px 12px",
                            display: "inline-block",
                            background: "rgb(44, 44, 44)",
                          }}
                        >
                          {value}
                        </h1>
                      ))}
                    </div>
                  </div>
                }

                <button className="button-common" onClick={clearMyNumbers}>เคลียร์เลขของตัวเอง</button>
                {isHost && <button className="button-common" onClick={clearUsedNumbers}>เคลียร์เลขทุกคน</button>}
              </div>

              <HeartDisplay roomId={roomId} heart={heart} setHeart={setHeart} onReduceHeart={handleReduceHeart} onResetHeart={handleResetHeart} />
              <RevealNumbers roomId={roomId} />
            </div>

            {
              showNameModal && <NameModal userName={userName} setUserName={setUserName} setShowNameModal={setShowNameModal} />
            }
          </div>
        }
      </div>
    </div>
  );
}

export default MainPage;
