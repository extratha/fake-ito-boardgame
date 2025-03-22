import React, { useState, useEffect } from 'react';
import { getDatabase, ref, set, get, child, onValue, push, remove } from "firebase/database";
import topic from './topic.json';
import HeartDisplay from './heart';
import RevealNumbers from './RevealNumbers';
import Cookies from 'js-cookie';
/* eslint-disable */

const maxNumber = 100;

function App() {
  const [userName, setUserName] = useState('');
  const [myNumbers, setMyNumbers] = useState([]);
  const [usedNumbers, setUsedNumbers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [heart, setHeart] = useState(3);
  const [currentTopic, setCurrentTopic] = useState('');

  const handleUserNameChange = (event) => {
    setUserName(event.target.value);
    Cookies.set('userName', event.target.value, { expires: 7 });
  };

  const fetchUsedNumbers = async () => {
    setIsLoading(true);
    const db = getDatabase();
    const numbersRef = ref(db, 'numbers');
    get(numbersRef).then((snapshot) => {
      if (snapshot.exists()) {
        const numbersData = snapshot.val();
        const numbers = Object.values(numbersData).map(item => item.number);
        setUsedNumbers(numbers);
      } else {
        console.log("No data available");
      }
      setIsLoading(false);
    }).catch((error) => {
      console.error(error);
      setIsLoading(false);
    });
  };

  const generateRandomNumber = async () => {
    await fetchUsedNumbers();
    if (usedNumbers.length === maxNumber) {
      alert('เลขทั้งหมดถูกใช้ไปแล้ว! กรุณาเคลียร์เลขเพื่อสุ่มใหม่');
      return;
    }

    setIsLoading(true)

    let randomNumber;
    do {
      randomNumber = Math.floor(Math.random() * maxNumber) + 1;
    } while (usedNumbers.includes(randomNumber));

    setMyNumbers((prevNumbers) => [...prevNumbers, randomNumber]);

    const db = getDatabase();
    const numbersRef = ref(db, 'numbers');
    const newNumberRef = push(numbersRef);
    set(newNumberRef, {
      number: randomNumber,
      timestamp: new Date().toISOString(),
    });

    setUsedNumbers([...usedNumbers, randomNumber]);
    setIsLoading(false)

  };

  const generateNextNumber = async () => {
    await fetchUsedNumbers();
    if (myNumbers.length >= 3) {
      alert('คุณสุ่มเลขครบแล้ว');
      return;
    }
    if (usedNumbers.length === maxNumber) {
      alert('เลขทั้งหมดถูกใช้ไปแล้ว! กรุณาเคลียร์เลขเพื่อสุ่มใหม่');
      return;
    }

    let randomNumber;
    do {
      randomNumber = Math.floor(Math.random() * maxNumber) + 1;
    } while (usedNumbers.includes(randomNumber));

    setMyNumbers((prevNumbers) => [...prevNumbers, randomNumber]);

    const db = getDatabase();
    const numbersRef = ref(db, 'numbers');
    const newNumberRef = push(numbersRef);
    set(newNumberRef, {
      number: randomNumber,
      timestamp: new Date().toISOString(),
    });

    setUsedNumbers([...usedNumbers, randomNumber]);
  };

  const clearUsedNumbers = async () => {
    if (confirm('ยืนยันจะเคลียร์ที่ทุกคนสุ่มไปแล้วไหม')) {
      setIsLoading(true);
      const db = getDatabase();
      const numbersRef = ref(db, 'numbers');
      remove(numbersRef)
        .then(() => {
          setUsedNumbers([]);
          setMyNumbers([]);
          setIsLoading(false);
          alert('เคลียร์เลขที่ใช้ไปแล้วเรียบร้อย!');
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
      const numbersRef = ref(db, 'numbers');
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

      const randomTopic = topic.data[Math.floor(Math.random() * topic.data.length)];

      const db = getDatabase();
      const topicRef = ref(db, 'topic');
      set(topicRef, {
        topic: randomTopic,
        timestamp: new Date().toISOString(),
      });
      setCurrentTopic(randomTopic);
      setIsLoading(false);
    }
  };

  const resetGameData = async () => {
    try {
      setMyNumbers([]);
      setUsedNumbers([]);

      const db = getDatabase();
      const numbersRef = ref(db, 'numbers');
      remove(numbersRef);

      const revealNumbersRef = ref(db, 'revealNumbers');
      remove(revealNumbersRef);

      await fetchUsedNumbers();
    } catch (e) {
      console.error('Error resetting game data: ', e);
    }
  };

  const handleClickNumber = async (number) => {
    const db = getDatabase();
    const revealNumbersRef = ref(db, 'revealNumbers');
  
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

  const updateHeart = async (newHeart) => {
    const db = getDatabase();
    const heartRef = ref(db, 'heart');
    set(heartRef, {
      heart: newHeart,
      timestamp: new Date().toISOString(),
    });
    setHeart(newHeart);
  };

  useEffect(() => {
    const savedUserName = Cookies.get('userName');
    if (savedUserName) {
      setUserName(savedUserName);
    }
  }, []);

  useEffect(() => {
    fetchUsedNumbers();
  }, []);

  useEffect(() => {
    const db = getDatabase();
    const heartRef = ref(db, 'heart');
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
    const topicRef = ref(db, 'topic');
    const unsubscribe = onValue(topicRef, (snapshot) => {
      if (snapshot.exists()) {
        const topicData = snapshot.val();
        setCurrentTopic(topicData.topic);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return (
    <div className="App">
      <div className='wrapper'>
        {isLoading ?
          <h3> ...LOADING...</h3>
          :
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            <input
              value={userName}
              placeholder="กรอกชื่อ"
              onChange={handleUserNameChange}
            />
            <div style={{ width: "100%", display: 'flex', flexDirection: 'column', gap: "8px", alignItems: 'center', border: '1px solid gray', borderRadius: '4px', padding: "16px" }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button onClick={handleRandomTopic}>สุ่มหัวข้อ</button>
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
              <button onClick={clearUsedNumbers}>เคลียร์เลขทุกคน</button>
            </div>

            <HeartDisplay heart={heart} setHeart={setHeart} handleReduceHeart={handleReduceHeart} handleResetHeart={handleResetHeart} />
            <RevealNumbers />
          </div>
        }
      </div>
    </div>
  );
}

export default App;
