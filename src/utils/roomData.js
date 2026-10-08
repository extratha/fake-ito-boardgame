// แปลง snapshot เป็น array ตามลำดับ key
// push key ของ Firebase สร้างจากเวลา server (ปรับ offset แล้ว) จึงเรียงตามลำดับที่สร้างจริง
// ไม่ขึ้นกับนาฬิกาของแต่ละเครื่อง
export const snapshotToList = (snapshot) => {
  const list = [];
  if (!snapshot?.exists()) return list;
  snapshot.forEach((child) => {
    const value = child.val();
    list.push({ id: child.key, ...(typeof value === 'object' ? value : { value }) });
  });
  return list;
};

export const getLatestTopic = (topicList) => topicList[topicList.length - 1]?.topic || '';

// numbers เก็บเป็น numbers/{n} = { owner, userName, createdAt }
// รองรับข้อมูลเก่าที่เก็บเป็น numbers/{pushId} = { number, timestamp }
export const toNumberEntries = (numberList) =>
  numberList
    .map((item) => ({
      ...item,
      number: typeof item.number === 'number' ? item.number : Number(item.id),
    }))
    .filter((item) => Number.isInteger(item.number));

export const getMyNumbers = (entries, clientId) =>
  entries
    .filter((item) => clientId && item.owner === clientId)
    .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0))
    .map((item) => item.number);

// สุ่มจากตัวที่ยังไม่ถูกใช้ คืน null ถ้าไม่เหลือ
export const pickRandomUnused = (pool, used, random = Math.random) => {
  const usedSet = new Set(used);
  const candidates = pool.filter((item) => !usedSet.has(item));
  if (candidates.length === 0) return null;
  return candidates[Math.floor(random() * candidates.length)];
};

export const range = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

// ผู้เล่นที่ออนไลน์ เรียงตามเวลาที่เข้าห้อง (คนเข้าก่อนอยู่หน้า)
export const getOnlinePlayers = (players) =>
  players
    .filter((p) => p.online === true)
    .sort((a, b) => (a.joinedAt ?? Infinity) - (b.joinedAt ?? Infinity) || (a.id < b.id ? -1 : 1));

// host หลุด: ให้คนที่ออนไลน์และเข้าห้องก่อนสุดรับ host ต่อ
export const pickHostCandidate = (players) => getOnlinePlayers(players)[0] ?? null;

// host แจกเลขทีเดียวให้ทุกคน (สุ่มจากสำรับ 1..maxNumber ไม่มีซ้ำ)
export const dealNumbers = (playerIds, perPlayer, maxNumber = 100, random = Math.random) => {
  const total = playerIds.length * perPlayer;
  if (total > maxNumber) throw new Error(`need ${total} numbers but only ${maxNumber} available`);
  const deck = range(1, maxNumber);
  for (let i = 0; i < total; i++) {
    const j = i + Math.floor(random() * (deck.length - i));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return Object.fromEntries(playerIds.map((id, index) => [
    id,
    deck.slice(index * perPlayer, (index + 1) * perPlayer).sort((a, b) => a - b),
  ]));
};

const highestRevealed = (revealedNumbers) => revealedNumbers.reduce((max, n) => Math.max(max, n), 0);

// revealedInOrder = เลขที่เปิดแล้วเรียงตามลำดับที่เปิด
// เลขที่โดนข้าม: ยังไม่ถูกเปิดแต่มีคนเปิดเลขที่มากกว่าไปแล้ว หรือถูกเปิดทีหลังเลขที่มากกว่า (ลงแล้วลงเลย ค้างไว้จนกว่าจะแจกใหม่)
export const getSkippedNumbers = (entries, revealedInOrder) => {
  const skipped = new Set();
  let highest = 0;
  revealedInOrder.forEach((n) => {
    if (n < highest) skipped.add(n);
    else highest = n;
  });
  const revealed = new Set(revealedInOrder);
  entries.forEach(({ number }) => { if (number < highest && !revealed.has(number)) skipped.add(number); });
  return entries.map((e) => e.number).filter((n) => skipped.has(n));
};

// เลขที่เพิ่ง "โดนข้าม" จากการเปิด number นี้ (อยู่ระหว่างเลขสูงสุดที่เปิดมาก่อนหน้ากับ number)
// การเปิดเลขที่ถูกข้ามอยู่แล้วทีหลัง หรือเปิดเลขที่เรียงถูกต้อง ไม่นับเป็นพลาดใหม่
export const getNewlySkipped = (entries, revealedNumbers, number) => {
  const revealed = new Set(revealedNumbers);
  const previousHighest = highestRevealed(revealedNumbers);
  return entries.map((e) => e.number).filter((n) => n > previousHighest && n < number && !revealed.has(n));
};
