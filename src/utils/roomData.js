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
