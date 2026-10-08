import { render, screen, act } from '@testing-library/react';
import * as fakeDb from '../testUtils/fakeDatabase';
import MissTaunt, { TAUNTS, EDGES, TAUNT_DURATION_MS, createTauntEvent, randomPlacement } from '.';

jest.mock('firebase/database', () => require('../testUtils/fakeDatabase'));
jest.mock('../firebase', () => ({ db: {} }));

const PATH = 'rooms/room1';
const event = (overrides = {}) => ({ id: 'e1', index: 3, ...overrides });

beforeEach(() => {
  jest.useFakeTimers();
  fakeDb.__reset({ rooms: { room1: { heart: 3 } } });
});
afterEach(() => jest.useRealTimers());

test('มีข้อความแซวให้สุ่ม', () => expect(TAUNTS.length).toBeGreaterThan(0));

test('โชว์ข้อความตาม event ที่ทุกเครื่องเห็นเหมือนกัน แล้วหายหลัง 4 วินาที', () => {
  render(<MissTaunt roomPath={PATH} />);
  expect(screen.queryByRole('status')).not.toBeInTheDocument();

  act(() => fakeDb.__write(`${PATH}/taunt`, event()));
  const bubble = screen.getByRole('status');
  expect(bubble).toHaveTextContent(TAUNTS[3]);

  act(() => { jest.advanceTimersByTime(TAUNT_DURATION_MS + 10); });
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});

test('event เก่าที่มีอยู่ก่อนเข้าห้องไม่ถูกโชว์ซ้ำ', () => {
  fakeDb.__reset({ rooms: { room1: { taunt: event() } } });
  render(<MissTaunt roomPath={PATH} />);
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});

test('event ใน DB มีแค่ id กับข้อความ ส่วนตำแหน่งสุ่มในเครื่อง', () => {
  const low = createTauntEvent(() => 0);
  const high = createTauntEvent(() => 0.9999);
  expect(Object.keys(low).sort()).toEqual(['id', 'index']);
  expect([low.index, high.index]).toEqual([0, TAUNTS.length - 1]);

  const a = randomPlacement(() => 0);
  const b = randomPlacement(() => 0.9999);
  expect([a.edge, b.edge]).toEqual([0, EDGES.length - 1]);
  expect(a.offset).toBeGreaterThanOrEqual(10);
  expect(b.offset).toBeLessThanOrEqual(90);
});
