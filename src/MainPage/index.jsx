import React, { useState, useEffect } from 'react';
import { getDatabase, ref, set, get, onValue, push, remove } from "firebase/database";
import topic from '../constant/topic.json';
import HeartDisplay from '../Heart';
import RevealNumbers from '../RevealNumbers';
import Cookies from 'js-cookie';
import RuleDetail from '../RuleDetail';
import { useNavigate, useParams } from 'react-router';
/* eslint-disable */

const maxNumber = 100;
const topicMaxLength = topic.data.length

function MainPage() {
  const [userName, setUserName] = useState('');
  const [myNumbers, setMyNumbers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [heart, setHeart] = useState(3);
  const [currentTopic, setCurrentTopic] = useState('');
  const [isHost, setIsHost] = useState(false);

  const navigate = useNavigate();
  const { roomId } = useParams();

  const checkIfUserIsHost = async () => {
    setIsLoading(true);
    const db = getDatabase();
    const roomRef = ref(db, `rooms/${roomId}`);

    try {
      const snapshot = await get(roomRef);
      if (snapshot.exists()) {
        const roomData = snapshot.val();
        if (roomData.host === userName) {
          setIsHost(true);  // Set isHost to true if the user is the host
        } else {
          setIsHost(false);
        }
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
    setIsLoading(true);
    const db = getDatabase();
    const topicRef = ref(db, `rooms/${roomId}/topic`);

    try {
      const snapshot = await get(topicRef);
      if (snapshot.exists()) {
        const topicsArray = Object.values(snapshot.val()); // ได้เป็น array ของหัวข้อทั้งหมด
        const latestTopic = topicsArray[topicsArray.length - 1]?.topic || ''; // เอาหัวข้อสุดท้าย
        console.log("จำนวนหัวข้อทั้งหมด", topicMaxLength, "สุ่มไปแล้ว", topicsArray.length)

        setCurrentTopic(latestTopic);
        return topicsArray.map(item => item.topic); // คืนค่าหัวข้อทั้งหมด
      }
      return [];
    } catch (error) {
      console.error(error);
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUsedNumbers = async () => {
    setIsLoading(true);
    const db = getDatabase();
    const numbersRef = ref(db, `rooms/${roomId}/numbers`);

    try {
      const snapshot = await get(numbersRef); // ใช้ await เพื่อให้ข้อมูลถูกดึงขึ้นมาก่อน
      if (snapshot.exists()) {
        const numbersData = snapshot.val();
        const numbers = Object.values(numbersData).map(item => item.number);
        return numbers; // คืนค่า numbers ที่ได้จากฐานข้อมูล
      } else {
        console.log("No data available");
        return []; // ถ้าไม่มีข้อมูล ก็ return เป็น array ว่าง
      }
    } catch (error) {
      console.error(error);
      return []; // ถ้าเกิด error ก็คืนค่า array ว่าง
    } finally {
      setIsLoading(false);
    }
  };


  const generateRandomNumber = async () => {
    const updatedUsedNumbers = await fetchUsedNumbers(); // ดึงเลขที่ใช้ไปแล้ว
    setIsLoading(true)
    if (updatedUsedNumbers?.length >= maxNumber) {
      alert('เลขทั้งหมดถูกใช้ไปแล้ว! กรุณาเคลียร์เลขเพื่อสุ่มใหม่');
      return setIsLoading(false);
    }

    setIsLoading(true);

    let randomNumber;
    do {
      randomNumber = Math.floor(Math.random() * maxNumber) + 1;
    } while (updatedUsedNumbers.includes(randomNumber));

    setMyNumbers((prevNumbers) => [...prevNumbers, randomNumber]);

    const db = getDatabase();
    const numbersRef = ref(db, `rooms/${roomId}/numbers`);
    const newNumberRef = push(numbersRef);
    await set(newNumberRef, {
      number: randomNumber,
      timestamp: new Date().toISOString(),
    });

    setIsLoading(false);
  };

  const generateNextNumber = async () => {
    const updatedUsedNumbers = await fetchUsedNumbers();
    setIsLoading(true);

    if (myNumbers.length >= 3) {
      alert('คุณสุ่มเลขครบแล้ว');
      setIsLoading(false);
      return;
    }

    if (updatedUsedNumbers?.length >= maxNumber) {
      alert('เลขทั้งหมดถูกใช้ไปแล้ว! กรุณาเคลียร์เลขเพื่อสุ่มใหม่');
      setIsLoading(false);
      return;
    }

    let randomNumber;
    do {
      randomNumber = Math.floor(Math.random() * maxNumber) + 1; // ✅ Random 1-3
    } while (updatedUsedNumbers.includes(randomNumber));

    setMyNumbers((prevNumbers) => [...prevNumbers, randomNumber]);

    const db = getDatabase();
    const numbersRef = ref(db, `rooms/${roomId}/numbers`);
    const newNumberRef = push(numbersRef);
    await set(newNumberRef, {
      number: randomNumber,
      timestamp: new Date().toISOString(),
    });

    setIsLoading(false);
  };

  const clearUsedNumbers = async () => {
    if (confirm('ยืนยันจะเคลียร์ที่ทุกคนสุ่มไปแล้วไหม')) {
      setIsLoading(true);
      const db = getDatabase();
      const numbersRef = ref(db, `rooms/${roomId}/numbers`);
      remove(numbersRef)
        .then(() => {
          setMyNumbers([]);
          setIsLoading(false);
        })
        .catch((error) => {
          console.error(error);
          setIsLoading(false);
        });
    }
  };

  const clearMyNumbers = async () => {
    if (confirm('คุณต้องการเคลียร์เลขที่เคยสุ่มไปแล้วใช่หรือไม่?')) {
      setIsLoading(true);
      const db = getDatabase();
      const numbersRef = ref(db, `rooms/${roomId}/numbers`);
      get(numbersRef).then((snapshot) => {
        if (snapshot.exists()) {
          snapshot.forEach(async (childSnapshot) => {
            const numberData = childSnapshot.val();
            if (myNumbers.includes(numberData.number)) {
              remove(childSnapshot.ref);
            }
          });
        }
        setMyNumbers([]);
        setIsLoading(false);
        alert('เคลียร์เลขที่สุ่มไปแล้วเรียบร้อย!');
      }).catch((error) => {
        console.error(error);
        setIsLoading(false);
      });
    }
  };

  const handleRandomTopic = async () => {
    if (confirm('สุ่มหัวข้อใหม่เท่ากับเริ่มเกมใหม่ ยืนยันหรือไม่')) {
      setIsLoading(true);
      await resetGameData();

      try {
        const usedTopics = await fetchUsedTopics()

        if (usedTopics.length >= topicMaxLength) {
          alert('หัวข้อทั้งหมดถูกใช้ไปแล้ว! กรุณาเคลียร์หัวข้อเพื่อเริ่มใหม่');
          setIsLoading(false);
          return;
        }

        let randomTopic;
        do {
          randomTopic = topic.data[Math.floor(Math.random() * topic.data.length)];
        } while (usedTopics.includes(randomTopic)); // สุ่มใหม่ถ้าซ้ำ

        const db = getDatabase();
        const topicRef = ref(db, `rooms/${roomId}/topic`);

        const newUsedTopicRef = push(topicRef);

        await set(newUsedTopicRef, {
          topic: randomTopic,
          timestamp: new Date().toISOString(),
        });

        console.log(usedTopics)
        setCurrentTopic(randomTopic);
      } catch (error) {
        console.error("Error fetching topics:", error);
      }
      setIsLoading(false);
    }
  };

  const clearUsedTopics = async () => {
    if (confirm('ยืนยันจะเคลียร์หัวข้อที่เคยสุ่มแล้วหรือไม่?')) {
      setIsLoading(true);
      const db = getDatabase();
      const topicRef = ref(db, `rooms/${roomId}/topic`);
      await remove(topicRef);
      setCurrentTopic('');
      setIsLoading(false);
    }
  };


  const resetGameData = async () => {
    try {
      setMyNumbers([]);

      const db = getDatabase();
      const numbersRef = ref(db, `rooms/${roomId}/numbers`);
      remove(numbersRef);

      const revealNumbersRef = ref(db, `rooms/${roomId}/revealNumbers`);
      remove(revealNumbersRef);

      await fetchUsedNumbers();
    } catch (e) {
      console.error('Error resetting game data: ', e);
    }
  };

  const handleClickNumber = async (number) => {
    const db = getDatabase();
    const revealNumbersRef = ref(db, `rooms/${roomId}/revealNumbers`);

    get(revealNumbersRef).then((snapshot) => {
      console.log('Firebase Data:', snapshot.val(), 'Exists:', snapshot.exists());

      if (!snapshot.exists()) {
        if (confirm('เปิดเผยเลขของคุณให้สังคมรับรู้')) {
          const newRevealRef = push(revealNumbersRef);
          set(newRevealRef, {
            number,
            userName,
            timestamp: new Date().toISOString(),
          });
        }
        return;
      }

      const isNumberRevealed = Object.values(snapshot.val()).some((item) => item.number === number);
      if (isNumberRevealed) {
        alert('เลขนี้เคยถูกเปิดเผยแล้ว');
        return;
      }

      if (confirm('เปิดเผยเลขของคุณให้สังคมรับรู้')) {
        const newRevealRef = push(revealNumbersRef);
        set(newRevealRef, {
          number,
          userName,
          timestamp: new Date().toISOString(),
        });
      }
    }).catch((error) => {
      console.error(error);
    });
  };

  const handleResetHeart = () => {
    updateHeart(3);
  };

  const handleReduceHeart = () => {
    if (heart > 0) {
      updateHeart(heart - 1);
    }
  };

  const updateHeart = async (roomId, heartChange) => {
    const db = getDatabase();
    const heartRef = ref(db, `rooms/${roomId}/heart`);

    const snapshot = await get(heartRef);
    const currentHeart = snapshot.exists() ? snapshot.val() : 0;

    await set(heartRef, currentHeart + heartChange);
  };

  useEffect(() => {
    const savedUserName = Cookies.get('userName');
    if (savedUserName) {
      setUserName(savedUserName);
    }
  }, []);

  useEffect(() => {
    fetchUsedTopics();
    fetchUsedNumbers();
  }, []);

  useEffect(() => {
    const db = getDatabase();
    const heartRef = ref(db, `rooms/${roomId}/heart`);
    const unsubscribe = onValue(heartRef, (snapshot) => {
      if (snapshot.exists()) {
        const heartData = snapshot.val();
        setHeart(heartData.heart);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const db = getDatabase();
    const topicRef = ref(db, `rooms/${roomId}/topic`);

    const unsubscribe = onValue(topicRef, (snapshot) => {
      if (snapshot.exists()) {
        const topicData = Object.values(snapshot.val()); // แปลง Object เป็น Array
        const latestTopic = topicData
          .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
        setCurrentTopic(latestTopic?.topic || '');
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const db = getDatabase();
    const roomRef = ref(db, `rooms/${roomId}`);

    get(roomRef).then((snapshot) => {
      if (!snapshot.exists()) {
        navigate("/");
      }
    }).catch((error) => {
      console.error("Error fetching room data:", error);
      alert('somethings wrong ')
      navigate("/");
    });
  }, [roomId, navigate]);

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
          <div style={{ padding:"0 1rem", display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            <div style={{display: 'flex' ,gap: '8px', alignItems:'center',}}> <h2 style={{ margin:'0'}}> ห้อง: </h2>
            <h2 style={{margin: '0'}}>{roomId}</h2>
            </div>
            
            <RuleDetail />

           
            <div style={{ width: "100%", display: 'flex', flexDirection: 'column', gap: "8px", alignItems: 'center', border: '1px solid gray', borderRadius: '4px', padding: "16px" }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <button onClick={handleRandomTopic}>สุ่มหัวข้อ</button>
                <button onClick={clearUsedTopics} >เคลียร์หัวข้อที่เคยสุ่มแล้ว</button>
              </div>

              <div style={{ display: "flex", flexDirection: "row", gap: '8px', alignItems: 'center' }}>
                <p style={{ margin: "0", fontSize: '22px', fontWeight: '500' }}> หัวข้อ: </p>
                <h2 style={{ margin: "0" }}> {currentTopic}</h2>
              </div>
            </div>

            <div style={{ width: "100%", display: 'flex', flexDirection: 'column', gap: "16px", alignItems: 'center', border: '1px solid gray', borderRadius: '4px', padding: "16px" }}>
              <h2 style={{ margin: "8px" }}>สุ่มเลข 1-{maxNumber}</h2>

              <button style={{ width: "120px" }} disabled={myNumbers.length >= 1} onClick={generateRandomNumber}>สุ่มเลข</button>
              {myNumbers.length > 0 && myNumbers.length < 3 && <button onClick={generateNextNumber}>สุ่มอีกเลข</button>}

              {myNumbers &&
                <div style={{ display: 'flex', flexDirection: "column", gap: "16px", alignItems: 'center' }}>
                  <h1 style={{ margin: "16px 0 0", color: myNumbers.length > 0 ? 'default' : 'transparent' }}>เลขที่ออก</h1>
                  <div style={{ display: 'flex', gap: '14px' }}>
                    {myNumbers.map((value) => (
                      <h1
                        onClick={() => handleClickNumber(value)}
                        style={{ margin: '0 0 16px', cursor: 'pointer', color: `hsl(${200 - ((value - 1) * 2)}, 100%, 40%)` }} >
                        {value}
                      </h1>
                    ))}
                  </div>
                </div>
              }

              <button onClick={clearMyNumbers}>เคลียร์เลขของตัวเอง</button>
              {isHost && <button onClick={clearUsedNumbers}>เคลียร์เลขทุกคน</button>}
            </div>

            <HeartDisplay roomId={roomId} heart={heart} setHeart={setHeart} handleReduceHeart={handleReduceHeart} handleResetHeart={handleResetHeart} />
            <RevealNumbers roomId={roomId} />
          </div>
        }
      </div>
    </div>
  );
}

export default MainPage;
