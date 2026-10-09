import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ref, set, get, onValue, push, remove, update, runTransaction, serverTimestamp } from "firebase/database";
import { db } from '../firebase';
import topic from '../constant/topic.json';
import HeartDisplay from '../Heart';
import RevealNumbers from '../RevealNumbers';
import Cookies from 'js-cookie';
import { useNavigate, useParams } from 'react-router';
import CopyIcon from "../icons/copy.svg";
import CopiedIcon from "../icons/copied.svg";
import { withTimeout, reportDbError } from '../utils/connection';
import { showAlert, showConfirm } from '../Dialog/dialogStore';
import { getClientId } from '../utils/clientId';
import { snapshotToList, getLatestTopic, handToNumbers, toRevealList, pickRandomUnused, getOnlinePlayers, dealNumbers, getSkippedNumbers, numberColor } from '../utils/roomData';
import { useRoomPresence } from '../hooks/useRoomPresence';
import { useHost } from '../hooks/useHost';
import PlayerList, { CrownIcon } from '../PlayerList';
import Chat from '../Chat';
import TopicNotice from '../TopicNotice';
import MissTaunt, { createTauntEvent } from '../MissTaunt';

import '../App.css'
import NameModal from '../NameModal';
/* eslint-disable */

const maxNumber = 100;
const numbersPerPlayerOptions = [1, 2, 3];
const topicMaxLength = topic.data.length

function MainPage() {
  const [userName, setUserName] = useState('');
  const [clientId] = useState(getClientId);
  const [myNumbers, setMyNumbers] = useState([]);
  const [dealtCounts, setDealtCounts] = useState({});
  const [revealedNumbers, setRevealedNumbers] = useState([]);
  const [numbersPerPlayer, setNumbersPerPlayer] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [heart, setHeart] = useState(3);
  const [currentTopic, setCurrentTopic] = useState('');
  const [roomExists, setRoomExists] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showNameModal, setShowNameModal] = useState(false);

  const navigate = useNavigate();
  const { roomId } = useParams();

  const roomPath = `rooms/${roomId}`;

  const players = useRoomPresence({ roomId, clientId, userName, enabled: roomExists });
  const { hostId, hostName, isHost } = useHost({ roomPath, clientId, userName, players });

  const handPath = `hands/${roomId}`;
  const revealedSet = useMemo(() => new Set(revealedNumbers), [revealedNumbers]);
  // เครื่องเรารู้แค่เลขของตัวเอง: หาเฉพาะเลขของเราที่โดนข้าม
  const skippedNumbers = useMemo(() => new Set(getSkippedNumbers(myNumbers.map((number) => ({ number })), revealedNumbers)), [myNumbers, revealedNumbers]);
  // ใครได้เลขรอบนี้บ้าง (สาธารณะ แค่จำนวน ไม่บอกเลข)
  const dealtOwners = useMemo(() => new Set(Object.keys(dealtCounts)), [dealtCounts]);
  const hasRound = dealtOwners.size > 0;
  const onlinePlayers = getOnlinePlayers(players);

  const fetchUsedTopics = async () => {
    const snapshot = await withTimeout(get(ref(db, `${roomPath}/topic`)), 'fetch topics');
    const topicsArray = snapshotToList(snapshot);
    console.log("จำนวนหัวข้อทั้งหมด", topicMaxLength, "สุ่มไปแล้ว", topicsArray.length)
    return topicsArray.map(item => item.topic);
  };

  const handleChangeNumbersPerPlayer = (value) => {
    withTimeout(set(ref(db, `${roomPath}/settings/numbersPerPlayer`), value), 'set numbers per player')
      .catch((error) => reportDbError(error, 'set numbers per player'));
  };

  // host แจกเลขให้ทุกคนที่ออนไลน์ในครั้งเดียว (เขียน multi-path update ครั้งเดียว เลขจึงไม่มีทางซ้ำ)
  // เลขของแต่ละคนเก็บที่ hands/{roomId}/{uid} ซึ่ง rules ให้อ่านได้เฉพาะเจ้าของ ส่วน dealt บอกแค่ว่าใครได้กี่เลข
  const handleDealNumbers = async () => {
    if (onlinePlayers.length === 0) return;
    if (onlinePlayers.length * numbersPerPlayer > maxNumber) {
      showAlert(`ผู้เล่น ${onlinePlayers.length} คน คนละ ${numbersPerPlayer} เลข เกิน ${maxNumber} เลข ลดจำนวนเลขต่อคนก่อนนะ`, { title: 'เลขไม่พอแจก' });
      return;
    }
    if (hasRound && !(await showConfirm('แจกเลขใหม่ = เริ่มรอบใหม่ เลขเดิมและเลขที่เปิดแล้วจะหายไป ยืนยันหรือไม่', { title: 'แจกเลขใหม่?', confirmText: 'แจกใหม่' }))) {
      return;
    }

    setIsLoading(true);
    try {
      const dealt = dealNumbers(onlinePlayers.map(p => p.id), numbersPerPlayer, maxNumber);
      const hands = {};
      const counts = {};
      onlinePlayers.forEach((player) => {
        hands[player.id] = Object.fromEntries(dealt[player.id].map((number) => [number, true]));
        counts[player.id] = dealt[player.id].length;
      });
      await withTimeout(update(ref(db), {
        ...roundResetUpdates(),
        [handPath]: hands,
        [`${roomPath}/dealt`]: counts,
      }), 'deal numbers');
    } catch (error) {
      reportDbError(error, 'deal numbers');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRandomTopic = async () => {
    if (await showConfirm('สุ่มหัวข้อใหม่เท่ากับเริ่มเกมใหม่ ยืนยันหรือไม่', { title: 'สุ่มหัวข้อใหม่?', confirmText: 'สุ่มเลย' })) {
      setIsLoading(true);

      try {
        await resetGameData();
        const usedTopics = await fetchUsedTopics()
        const randomTopic = pickRandomUnused(topic.data, usedTopics);

        if (randomTopic === null) {
          showAlert('หัวข้อทั้งหมดถูกใช้ไปแล้ว! กรุณาเคลียร์หัวข้อเพื่อเริ่มใหม่', { title: 'หัวข้อหมดแล้ว' });
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
    if (await showConfirm('ยืนยันจะเคลียร์หัวข้อที่เคยสุ่มแล้วหรือไม่?', { title: 'เคลียร์หัวข้อ?', confirmText: 'เคลียร์', tone: 'danger' })) {
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

  // ล้างรอบ: เลขในมือทุกคน ใครได้เลข เลขที่เปิด ข้อความแซว (numbers = ข้อมูลรูปแบบเก่า)
  const roundResetUpdates = () => ({
    [handPath]: null,
    [`${roomPath}/dealt`]: null,
    [`${roomPath}/numbers`]: null,
    [`${roomPath}/revealNumbers`]: null,
    [`${roomPath}/taunt`]: null,
  });

  const resetGameData = () => withTimeout(update(ref(db), roundResetUpdates()), 'reset game');

  const handleClickNumber = async (number) => {
    if (revealedSet.has(number)) {
      showAlert('เลขนี้เคยถูกเปิดเผยแล้ว');
      return;
    }
    if (!(await showConfirm('เปิดเผยเลขของคุณให้สังคมรับรู้', { title: `เปิดเลข ${number}?`, confirmText: 'เปิดเลย' }))) return;

    try {
      // key = เลข และเขียนด้วย transaction: แตะรัว/เปิดสองแท็บก็บันทึกได้ครั้งเดียว (rules ก็ไม่ยอมให้เขียนทับ)
      // ลงแล้วลงเลย: เก็บเลขที่เปิดไว้เสมอ แม้เปิดผิดลำดับ
      const result = await withTimeout(runTransaction(ref(db, `${roomPath}/revealNumbers/${number}`), (current) =>
        current ? undefined : { userName, uid: clientId, createdAt: serverTimestamp() }), 'reveal number');
      if (!result.committed) showAlert('เลขนี้เคยถูกเปิดเผยแล้ว');
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

  // เลขในมือเรา (อ่านได้เฉพาะของตัวเอง)
  useEffect(() => {
    if (!clientId) return undefined;
    const unsubscribe = onValue(ref(db, `${handPath}/${clientId}`), (snapshot) => {
      setMyNumbers(handToNumbers(snapshot.val()));
    });
    return () => unsubscribe();
  }, [handPath, clientId]);

  // ใครได้เลขรอบนี้: ดูว่าใครยังไม่ได้เลข (เข้ามากลางรอบ)
  useEffect(() => {
    const unsubscribe = onValue(ref(db, `${roomPath}/dealt`), (snapshot) => {
      setDealtCounts(snapshot.val() || {});
    });
    return () => unsubscribe();
  }, [roomPath]);

  useEffect(() => {
    const unsubscribe = onValue(ref(db, `${roomPath}/revealNumbers`), (snapshot) => {
      setRevealedNumbers(toRevealList(snapshot).map((item) => item.number));
    });
    return () => unsubscribe();
  }, [roomPath]);

  // มีคนเปิดข้ามเลขของเรา (หรือเราเปิดข้ามเลขตัวเอง) = รอบนี้ failed: เขียนข้อความแซวให้ทุกคนเห็นคำเดียวกัน
  // เครื่องที่เลขโดนข้ามเป็นคนเขียน เพราะคนเปิดไม่รู้เลขของคนอื่น / transaction เขียนครั้งเดียวต่อรอบ จนกว่าจะแจกใหม่
  const skippedCountRef = useRef(0);
  useEffect(() => {
    const count = skippedNumbers.size;
    const increased = count > skippedCountRef.current;
    skippedCountRef.current = count;
    if (!increased) return;
    withTimeout(runTransaction(ref(db, `${roomPath}/taunt`), (current) => (current ? undefined : createTauntEvent())), 'write taunt')
      .catch((error) => reportDbError(error, 'write taunt'));
  }, [skippedNumbers, roomPath]);

  useEffect(() => {
    const settingRef = ref(db, `${roomPath}/settings/numbersPerPlayer`);
    const unsubscribe = onValue(settingRef, (snapshot) => {
      const value = snapshot.val();
      setNumbersPerPlayer(numbersPerPlayerOptions.includes(value) ? value : 1);
    });

    return () => unsubscribe();
  }, [roomPath]);

  useEffect(() => {
    setRoomExists(false);
    withTimeout(get(ref(db, roomPath)), 'check room').then((snapshot) => {
      if (!snapshot.exists()) {
        // ห้องถูกลบไปแล้ว (เช่น ลิงก์เก่า): กลับ lobby พร้อมบอกว่าห้องไหนหาย ให้ lobby โหลดรายชื่อห้องใหม่
        navigate("/", { replace: true, state: { missingRoomId: roomId } });
      } else {
        setRoomExists(true);
      }
    }).catch((error) => {
      reportDbError(error, 'check room');
      navigate("/");
    });
  }, [roomPath, navigate]);

  const renderNumbersStatus = () => {
    if (!hasRound) {
      return <p className="hint">{isHost ? 'เลือกจำนวนเลขต่อคน แล้วกดแจกเลขได้เลย' : `รอ ${hostName || 'host'} แจกเลข`}</p>;
    }
    if (myNumbers.length === 0) {
      return <p className="hint">รอบนี้เริ่มไปแล้ว รอรอบถัดไปนะ</p>;
    }
    return null;
  };

  return (
    <div className="App">
      <div className='wrapper'>
        {/* ระหว่างรอ DB ไม่ซ่อนทั้งหน้า (แชทที่พิมพ์ค้าง/การแจ้งเตือนไม่หาย) แค่แจ้งสถานะและปิดปุ่มของ host */}
        {isLoading && <p className="loading-toast" role="status">กำลังโหลด...</p>}
        <div className="stack" aria-busy={isLoading}>
            <div className="room-header">
              <button className="button-common" onClick={() => handleClickBack()}>ย้อนกลับ</button>
              <div className="room-meta">
                <div className="room-id">
                  <h2>ห้อง: {roomId}</h2>
                  {roomId && (
                    <button className="icon-button" onClick={copyToClipboard} aria-label={copied ? 'คัดลอกรหัสห้องแล้ว' : 'คัดลอกรหัสห้อง'}>
                      {copied ? <img src={CopiedIcon} alt="" /> : <img src={CopyIcon} alt="" />}
                    </button>
                  )}
                </div>
                {isHost
                  ? <span className="host-badge" role="status"><CrownIcon />คุณเป็น host</span>
                  : hostName && <span className="host-badge is-other"><CrownIcon />host: {hostName}</span>}
              </div>
            </div>

            <div className="room-layout">
              <div className="room-main">
                <section className="card">
                  <p className="eyebrow">หัวข้อ:</p>
                  <div className="topic-display">
                    {currentTopic
                      ? <h2>{currentTopic}</h2>
                      : <p className="topic-empty">{isHost ? 'ยังไม่มีหัวข้อ กดสุ่มเพื่อเริ่มเกม' : 'รอ host สุ่มหัวข้อ'}</p>}
                  </div>
                  {isHost && (
                    <div className="button-row">
                      <button className="button-common btn-primary" onClick={handleRandomTopic} disabled={isLoading}>สุ่มหัวข้อ</button>
                      <button className="button-common" onClick={clearUsedTopics} disabled={isLoading}>เคลียร์หัวข้อที่เคยสุ่มแล้ว</button>
                    </div>
                  )}
                </section>

                <section className="card numbers-card">
                  <h2 className="card-title">เลขของคุณ</h2>

                  {isHost && (
                    <div className="deal-controls">
                      <div className="segmented" role="group" aria-label="จำนวนเลขต่อคน">
                        <span className="field-label">จำนวนเลขต่อคน</span>
                        <div className="segmented-options">
                          {numbersPerPlayerOptions.map((value) => (
                            <button
                              key={value}
                              className={`segmented-option ${numbersPerPlayer === value ? 'is-active' : ''}`}
                              aria-pressed={numbersPerPlayer === value}
                              onClick={() => handleChangeNumbersPerPlayer(value)}
                            >
                              {value} เลข
                            </button>
                          ))}
                        </div>
                      </div>
                      <button className="button-common btn-secondary btn-lg" onClick={handleDealNumbers} disabled={isLoading || onlinePlayers.length === 0}>
                        {hasRound ? 'แจกเลขใหม่' : 'แจกเลข'} ({onlinePlayers.length} คน)
                      </button>
                    </div>
                  )}

                  {renderNumbersStatus()}

                  {myNumbers.length > 0 &&
                    <>
                      <div className="number-tiles">
                        {myNumbers.map((value) => (
                          <h1
                            key={value}
                            className={`number-tile ${revealedSet.has(value) ? 'is-revealed' : ''} ${skippedNumbers.has(value) ? 'is-skipped' : ''}`}
                            title={skippedNumbers.has(value) ? 'เลขนี้โดนข้ามไปแล้ว' : undefined}
                            role="heading"
                            aria-level={1}
                            tabIndex={0}
                            onClick={() => handleClickNumber(value)}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClickNumber(value); } }}
                            style={revealedSet.has(value) ? undefined : { color: numberColor(value) }}
                          >
                            {value}
                          </h1>
                          
                        ))}
                      </div>
                      <p className="hint">แตะที่เลขเพื่อเปิดเผยให้ทุกคนเห็น</p>
                    </>
                  }
                </section>

                <HeartDisplay heart={heart} onReduceHeart={handleReduceHeart} onResetHeart={handleResetHeart} />
                {/* มือถือ: CSS order ดันไปไว้หลังแชทเหมือนเดิม */}
                <PlayerList players={players} hostId={hostId} clientId={clientId} dealtOwners={dealtOwners} />
              </div>

              {/* desktop: คอลัมน์ขวาเป็นแชทเต็มความสูง */}
              <div className="room-side">
                <Chat roomPath={roomPath} clientId={clientId} userName={userName} />
              </div>
            </div>

            <RevealNumbers roomId={roomId} />
            <MissTaunt roomPath={roomPath} />
            <TopicNotice roomPath={roomPath} silent={isHost} />
        </div>
        {
          showNameModal && <NameModal userName={userName} setUserName={setUserName} setShowNameModal={setShowNameModal} />
        }
      </div>
    </div>
  );
}

export default MainPage;
