import * as fakeDb from '../testUtils/fakeDatabase';
import { cleanupRooms, EMPTY_ROOM_TTL_MS, ROOM_MAX_AGE_MS } from './roomCleanup';

jest.mock('firebase/database', () => require('../testUtils/fakeDatabase'));
jest.mock('../firebase', () => ({ db: {} }));

const NOW = 100_000_000;

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

test('ลบห้องที่ร้างเกิน 10 นาที หรืออายุเกิน 1 วัน เก็บห้องที่ยังมีคนออนไลน์ (ดูจาก roomIndex เหมือน rules)', async () => {
  const idle = NOW - EMPTY_ROOM_TTL_MS - 1;
  fakeDb.__reset({
    rooms: { empty: { host: 'a' }, stillPlaying: { host: 'b' }, fresh: { host: 'c' }, old: { host: 'd' } },
    roomIndex: {
      empty: { createdAt: idle, lastSeen: idle },
      stillPlaying: { createdAt: idle, lastSeen: idle, online: { b: 'Bob' } },
      fresh: { createdAt: NOW - 1000, lastSeen: NOW - 1000 },
      old: { createdAt: NOW - ROOM_MAX_AGE_MS - 1, lastSeen: NOW, online: { d: 'Dan' } },
    },
  });

  await cleanupRooms(NOW);

  expect(Object.keys(fakeDb.__getData('rooms')).sort()).toEqual(['fresh', 'stillPlaying']);
  expect(Object.keys(fakeDb.__getData('roomIndex')).sort()).toEqual(['fresh', 'stillPlaying']);
});
