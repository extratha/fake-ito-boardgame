import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Cookies from 'js-cookie';
import * as fakeDb from '../testUtils/fakeDatabase';
import { DB_TIMEOUT_MS } from '../utils/connection';
import { showAlert } from '../Dialog/dialogStore';
import WelcomePage, { ROOM_ID_CHARS, generateRoomId, normalizeRoomId } from '.';

jest.mock('firebase/database', () => require('../testUtils/fakeDatabase'));
jest.mock('../firebase', () => ({ db: {} }));
jest.mock('../Dialog/dialogStore', () => ({ showAlert: jest.fn() }));
const mockNavigate = jest.fn();
jest.mock('react-router', () => ({ useNavigate: () => mockNavigate }));

beforeEach(() => {
  fakeDb.__reset();
  mockNavigate.mockReset();
  Cookies.set('userName', 'Alice');
  Cookies.set('clientId', 'client-alice');
  showAlert.mockReset();
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
  expect(mockNavigate).toHaveBeenCalledWith(expect.stringMatching(new RegExp(`^/room/[${ROOM_ID_CHARS}]{4}$`)));
  const [roomId, room] = Object.entries(fakeDb.__getData('rooms'))[0];
  expect(room).toMatchObject({ host: 'Alice', hostId: 'client-alice', heart: 3, settings: { numbersPerPlayer: 1 } });
  expect(fakeDb.__getData(`roomIndex/${roomId}`)).toEqual({ createdAt: expect.any(Number), lastSeen: expect.any(Number), hostName: 'Alice' });
});

test('DB ต่อไม่ได้: ปุ่มขึ้นกำลังสร้างห้อง แล้วแจ้ง error เมื่อหมดเวลา แทนการเงียบ', async () => {
  fakeDb.__setHooks({ offline: true });
  jest.useFakeTimers();
  render(<WelcomePage />);

  userEvent.click(screen.getByText('สร้างห้องใหม่'));
  expect(screen.getByText('กำลังสร้างห้อง...')).toBeDisabled();

  await act(async () => { jest.advanceTimersByTime(DB_TIMEOUT_MS); });
  expect(showAlert).toHaveBeenCalledWith('เชื่อมต่อฐานข้อมูลไม่ได้ ลองรีเฟรชหน้าแล้วกดใหม่อีกครั้ง', expect.objectContaining({ title: 'เชื่อมต่อไม่ได้' }));
  expect(console.error).toHaveBeenCalledWith('[db] create room failed:', expect.anything());
  expect(screen.getByText('สร้างห้องใหม่')).not.toBeDisabled();
  expect(mockNavigate).not.toHaveBeenCalled();
});

test('รหัสห้อง 4 ตัว ใช้แค่ตัวใหญ่/ตัวเลขที่ไม่สับสน (ไม่มี 0 O 1 I L)', () => {
  expect(ROOM_ID_CHARS).not.toMatch(/[0O1IL]/);
  for (let i = 0; i < 200; i++) {
    expect(generateRoomId()).toMatch(new RegExp(`^[${ROOM_ID_CHARS}]{4}$`));
  }
});

test('รหัสซ้ำกับห้องที่มีอยู่ จะสุ่มใหม่ไม่ทับห้องเดิม', async () => {
  fakeDb.__reset({ rooms: { AAAA: { host: 'Bob', heart: 1 } } });
  let call = 0;
  jest.spyOn(global.crypto, 'getRandomValues').mockImplementation((array) => {
    array.fill(call++ === 0 ? 0 : 1); // ครั้งแรกได้ AAAA (ซ้ำ) ครั้งถัดไปได้ BBBB
    return array;
  });
  render(<WelcomePage />);
  userEvent.click(screen.getByText('สร้างห้องใหม่'));
  await screen.findByText('สร้างห้องใหม่');

  expect(mockNavigate).toHaveBeenCalledWith('/room/BBBB');
  expect(fakeDb.__getData('rooms/AAAA')).toEqual({ host: 'Bob', heart: 1 });
  expect(fakeDb.__getData('rooms/BBBB')).toMatchObject({ host: 'Alice' });
});

test('เข้าห้องด้วยรหัส 4 ตัวพิมพ์เล็กได้ ส่วนรหัสห้องเก่า 8 ตัวใช้ตามที่พิมพ์', () => {
  expect(normalizeRoomId('ab3d')).toBe('AB3D');
  expect(normalizeRoomId('E3FCwtK8')).toBe('E3FCwtK8');

  render(<WelcomePage />);
  userEvent.type(screen.getByPlaceholderText('รหัสห้อง 4 ตัว'), 'ab3d');
  userEvent.click(screen.getByText('เข้าร่วมห้อง', { selector: 'button' }));
  expect(mockNavigate).toHaveBeenCalledWith('/room/AB3D');
});

test('กดเข้าห้องจากรายชื่อห้องในหน้า lobby', () => {
  fakeDb.__reset({ roomIndex: { K7QM: { hostName: 'Bob', online: { b: 'Bob' } } } });
  render(<WelcomePage />);
  userEvent.click(screen.getByRole('button', { name: 'เข้าห้อง K7QM' }));
  expect(mockNavigate).toHaveBeenCalledWith('/room/K7QM');
});
