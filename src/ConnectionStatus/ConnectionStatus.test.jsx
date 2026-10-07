import { render, screen, act } from '@testing-library/react';
import * as fakeDb from '../testUtils/fakeDatabase';
import ConnectionStatus, { HIDE_CONNECTED_AFTER_MS } from '.';

jest.mock('firebase/database', () => require('../testUtils/fakeDatabase'));
jest.mock('../firebase', () => ({ db: {} }));

beforeEach(() => {
  fakeDb.__reset();
  jest.useFakeTimers();
  jest.spyOn(console, 'info').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

test('ต่อได้เร็วจะไม่โชว์ "กำลังเชื่อมต่อ" แล้วขึ้น ออนไลน์', () => {
  render(<ConnectionStatus />);
  expect(screen.queryByRole('status')).not.toBeInTheDocument();

  act(() => fakeDb.__write('.info/connected', true));
  expect(screen.getByRole('status')).toHaveTextContent('ออนไลน์');
  expect(console.info).toHaveBeenCalledWith('[db] connected');
});

test('ต่อไม่ได้: โชว์กำลังเชื่อมต่อ แล้วเปลี่ยนเป็นเชื่อมต่อไม่ได้พร้อมปุ่มรีเฟรช และมี log', () => {
  render(<ConnectionStatus />);
  act(() => jest.advanceTimersByTime(1500));
  expect(screen.getByRole('status')).toHaveTextContent('กำลังเชื่อมต่อ...');

  act(() => jest.advanceTimersByTime(10000));
  expect(screen.getByRole('status')).toHaveTextContent('เชื่อมต่อฐานข้อมูลไม่ได้');
  expect(screen.getByRole('button', { name: 'รีเฟรช' })).toBeInTheDocument();
  expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('cannot reach Realtime Database'));
});

test('เคยต่อได้แล้วหลุด โชว์กำลังเชื่อมต่อใหม่ และกลับมาออนไลน์ได้', () => {
  render(<ConnectionStatus />);
  act(() => fakeDb.__write('.info/connected', true));
  act(() => fakeDb.__write('.info/connected', false));
  expect(screen.getByRole('status')).toHaveTextContent('การเชื่อมต่อหลุด');

  act(() => fakeDb.__write('.info/connected', true));
  expect(screen.getByRole('status')).toHaveTextContent('ออนไลน์');
});

test('ออนไลน์แล้วซ่อนป้ายหลังผ่านไปครู่หนึ่ง แต่ถ้าหลุดจะโชว์อีกครั้ง', () => {
  render(<ConnectionStatus />);
  act(() => fakeDb.__write('.info/connected', true));
  expect(screen.getByRole('status')).toHaveTextContent('ออนไลน์');

  act(() => jest.advanceTimersByTime(HIDE_CONNECTED_AFTER_MS));
  expect(screen.queryByRole('status')).not.toBeInTheDocument();

  act(() => fakeDb.__write('.info/connected', false));
  expect(screen.getByRole('status')).toHaveTextContent('การเชื่อมต่อหลุด');
  act(() => jest.advanceTimersByTime(HIDE_CONNECTED_AFTER_MS * 2));
  expect(screen.getByRole('status')).toHaveTextContent('การเชื่อมต่อหลุด');
});
