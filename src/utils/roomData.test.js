import { getLatestTopic, handToNumbers, toRevealList, pickRandomUnused, range, getSkippedNumbers, numberColor } from './roomData';

const snapshotOf = (value) => ({
  exists: () => value != null,
  forEach: (cb) => Object.keys(value).forEach((key) => cb({ key, val: () => value[key] })),
});

test('getLatestTopic คืนตัวสุดท้าย หรือ string ว่าง', () => {
  expect(getLatestTopic([{ topic: 'a' }, { topic: 'b' }])).toBe('b');
  expect(getLatestTopic([])).toBe('');
});

test('handToNumbers แปลงเลขในมือเป็น array เรียงจากน้อยไปมาก', () => {
  expect(handToNumbers({ 70: true, 5: true, 42: true })).toEqual([5, 42, 70]);
  expect(handToNumbers(null)).toEqual([]);
});

test('toRevealList เรียงตามลำดับที่เปิด (createdAt) และรองรับข้อมูลเก่าแบบ push id', () => {
  const list = toRevealList(snapshotOf({
    40: { uid: 'a', createdAt: 30 },
    10: { uid: 'b', createdAt: 20 },
    '-old': { number: 7, createdAt: 10 },
    '-bad': { createdAt: 5 },
  }));
  expect(list.map((item) => item.number)).toEqual([7, 10, 40]);
  expect(toRevealList(snapshotOf(null))).toEqual([]);
});

test('pickRandomUnused ไม่คืนตัวที่ใช้แล้ว และคืน null เมื่อหมด แม้ used มีตัวที่ไม่อยู่ใน pool', () => {
  expect(pickRandomUnused(['a', 'b', 'c'], ['a', 'c'])).toBe('b');
  expect(pickRandomUnused(['a', 'b'], ['a', 'b', 'removed-topic'])).toBeNull();
  for (let i = 0; i < 200; i++) {
    expect([3, 4]).toContain(pickRandomUnused(range(1, 4), [1, 2]));
  }
});

import { dealNumbers, getOnlinePlayers, pickHostCandidate } from './roomData';

test('dealNumbers แจกครบทุกคน คนละ n เลข ไม่ซ้ำกัน และเรียงจากน้อยไปมาก', () => {
  for (let round = 0; round < 50; round++) {
    const dealt = dealNumbers(['a', 'b', 'c', 'd'], 3);
    const all = Object.values(dealt).flat();
    expect(Object.keys(dealt)).toEqual(['a', 'b', 'c', 'd']);
    Object.values(dealt).forEach((nums) => {
      expect(nums).toHaveLength(3);
      expect(nums).toEqual([...nums].sort((x, y) => x - y));
    });
    expect(new Set(all).size).toBe(12);
    all.forEach((n) => expect(n >= 1 && n <= 100).toBe(true));
  }
});

test('dealNumbers แจกได้พอดี 100 เลข แต่เกินแล้ว throw', () => {
  const ids = Array.from({ length: 50 }, (_, i) => `p${i}`);
  expect(new Set(Object.values(dealNumbers(ids, 2)).flat()).size).toBe(100);
  expect(() => dealNumbers([...ids, 'extra'], 2)).toThrow();
});

test('getOnlinePlayers / pickHostCandidate เลือกคนออนไลน์ที่เข้าห้องก่อนสุด', () => {
  const players = [
    { id: 'late', online: true, joinedAt: 30 },
    { id: 'offline', online: false, joinedAt: 1 },
    { id: 'early', online: true, joinedAt: 10 },
    { id: 'noJoin', online: true },
  ];
  expect(getOnlinePlayers(players).map((p) => p.id)).toEqual(['early', 'late', 'noJoin']);
  expect(pickHostCandidate(players).id).toBe('early');
  expect(pickHostCandidate([{ id: 'x', online: false }])).toBeNull();
});

describe('เลขที่โดนข้าม', () => {
  const entries = [10, 20, 30, 40].map((number) => ({ number }));

  test('getSkippedNumbers: เลขที่ยังไม่เปิดและน้อยกว่าเลขสูงสุดที่เปิดแล้ว', () => {
    expect(getSkippedNumbers(entries, [])).toEqual([]);
    expect(getSkippedNumbers(entries, [10, 20])).toEqual([]);
    expect(getSkippedNumbers(entries, [40])).toEqual([10, 20, 30]);
    expect(getSkippedNumbers(entries, [40, 20])).toEqual([10, 20, 30]); // 20 ถูกเปิดทีหลัง ยังถือว่าโดนข้าม
    expect(getSkippedNumbers(entries, [10, 20, 40])).toEqual([30]);
  });
});
