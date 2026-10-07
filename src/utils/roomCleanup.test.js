import * as fakeDb from '../testUtils/fakeDatabase';
import { cleanupRooms, EMPTY_ROOM_TTL_MS, ROOM_MAX_AGE_MS } from './roomCleanup';

jest.mock('firebase/database', () => require('../testUtils/fakeDatabase'));
jest.mock('../firebase', () => ({ db: {}, databaseURL: 'https://example.firebaseio.test' }));

const NOW = 100_000_000;

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({}) }));
});
afterEach(() => jest.restoreAllMocks());

test('ลบห้องที่ร้างเกิน 10 นาที หรืออายุเกิน 1 วัน เก็บห้องที่ยังมีคนออนไลน์', async () => {
  const idle = NOW - EMPTY_ROOM_TTL_MS - 1;
  fakeDb.__reset({
    rooms: {
      empty: { players: { a: { online: false } } },
      stillPlaying: { players: { a: { online: false }, b: { online: true } } },
      fresh: {},
      old: { players: { a: { online: true } } },
    },
    roomIndex: {
      empty: { createdAt: idle, lastSeen: idle },
      stillPlaying: { createdAt: idle, lastSeen: idle },
      fresh: { createdAt: NOW - 1000, lastSeen: NOW - 1000 },
      old: { createdAt: NOW - ROOM_MAX_AGE_MS - 1, lastSeen: NOW },
    },
  });

  await cleanupRooms(NOW);

  expect(Object.keys(fakeDb.__getData('rooms')).sort()).toEqual(['fresh', 'stillPlaying']);
  expect(Object.keys(fakeDb.__getData('roomIndex')).sort()).toEqual(['fresh', 'stillPlaying']);
});

test('ห้องเก่าที่ไม่มีใน roomIndex: ดึงแค่ชื่อห้อง (shallow) แล้วลบตัวที่อายุเกิน 1 วัน', async () => {
  fakeDb.__reset({
    rooms: {
      legacyOld: { createdAt: NOW - ROOM_MAX_AGE_MS - 1 },
      legacyNew: { createdAt: NOW - 1000 },
    },
  });
  global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ legacyOld: true, legacyNew: true }) }));

  await cleanupRooms(NOW);

  expect(global.fetch).toHaveBeenCalledWith('https://example.firebaseio.test/rooms.json?shallow=true');
  expect(Object.keys(fakeDb.__getData('rooms'))).toEqual(['legacyNew']);
});
