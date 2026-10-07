import { getLatestTopic, toNumberEntries, getMyNumbers, pickRandomUnused, range } from './roomData';

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
