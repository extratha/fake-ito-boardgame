import { getLatestTopic, toNumberEntries, getMyNumbers, pickRandomUnused, range, getSkippedNumbers, getNewlySkipped } from './roomData';

test('getLatestTopic คืนตัวสุดท้าย หรือ string ว่าง', () => {
  expect(getLatestTopic([{ topic: 'a' }, { topic: 'b' }])).toBe('b');
  expect(getLatestTopic([])).toBe('');
});

test('toNumberEntries รองรับทั้งรูปแบบใหม่ (key=เลข) และรูปแบบเก่า (push id)', () => {
  expect(toNumberEntries([
    { id: '7', owner: 'x' },
    { id: '-abc', number: 9 },
    { id: '-bad' },
  ]).map((e) => e.number)).toEqual([7, 9]);
});

test('getMyNumbers กรองตาม owner และเรียงตามเวลาที่สุ่ม', () => {
  const entries = [
    { number: 5, owner: 'me', createdAt: 3 },
    { number: 1, owner: 'you', createdAt: 1 },
    { number: 9, owner: 'me', createdAt: 2 },
  ];
  expect(getMyNumbers(entries, 'me')).toEqual([9, 5]);
  expect(getMyNumbers(entries, undefined)).toEqual([]);
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

  test('getNewlySkipped: นับเฉพาะเลขที่เพิ่งโดนข้ามจากการเปิดครั้งนี้', () => {
    expect(getNewlySkipped(entries, [], 10)).toEqual([]);
    expect(getNewlySkipped(entries, [10], 30)).toEqual([20]);
    expect(getNewlySkipped(entries, [], 30)).toEqual([10, 20]);
    // เปิดเลขที่ถูกข้ามอยู่แล้วทีหลัง / เปิดเรียงถูก ไม่ใช่พลาดใหม่
    expect(getNewlySkipped(entries, [40], 10)).toEqual([]);
    expect(getNewlySkipped(entries, [10], 20)).toEqual([]);
  });
});
