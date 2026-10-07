import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Cookies from 'js-cookie';
import * as fakeDb from '../testUtils/fakeDatabase';
import { DB_TIMEOUT_MS } from '../utils/connection';
import WelcomePage from '.';

jest.mock('firebase/database', () => require('../testUtils/fakeDatabase'));
jest.mock('../firebase', () => ({ db: {} }));
const mockNavigate = jest.fn();
jest.mock('react-router', () => ({ useNavigate: () => mockNavigate }));

beforeEach(() => {
  fakeDb.__reset();
  mockNavigate.mockReset();
  Cookies.set('userName', 'Alice');
  Cookies.set('clientId', 'client-alice');
  window.alert = jest.fn();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  Cookies.remove('userName');
  Cookies.remove('clientId');
});

test('สร้างห้องสำเร็จแล้วไปหน้าห้อง', async () => {
  render(<WelcomePage />);
  userEvent.click(screen.getByText('สร้างห้องใหม่'));
  await screen.findByText('สร้างห้องใหม่');
  expect(mockNavigate).toHaveBeenCalledWith(expect.stringMatching(/^\/room\/\w{8}$/));
  const [roomId, room] = Object.entries(fakeDb.__getData('rooms'))[0];
  expect(room).toMatchObject({ host: 'Alice', hostId: 'client-alice', heart: 3, settings: { numbersPerPlayer: 1 } });
  expect(fakeDb.__getData(`roomIndex/${roomId}`)).toEqual({ createdAt: expect.any(Number), lastSeen: expect.any(Number) });
});

test('DB ต่อไม่ได้: ปุ่มขึ้นกำลังสร้างห้อง แล้วแจ้ง error เมื่อหมดเวลา แทนการเงียบ', async () => {
  fakeDb.__setHooks({ offline: true });
  jest.useFakeTimers();
  render(<WelcomePage />);

  userEvent.click(screen.getByText('สร้างห้องใหม่'));
  expect(screen.getByText('กำลังสร้างห้อง...')).toBeDisabled();

  await act(async () => { jest.advanceTimersByTime(DB_TIMEOUT_MS); });
  expect(window.alert).toHaveBeenCalledWith('เชื่อมต่อฐานข้อมูลไม่ได้ ลองรีเฟรชหน้าแล้วกดใหม่อีกครั้ง');
  expect(console.error).toHaveBeenCalledWith('[db] create room failed:', expect.anything());
  expect(screen.getByText('สร้างห้องใหม่')).not.toBeDisabled();
  expect(mockNavigate).not.toHaveBeenCalled();
});
