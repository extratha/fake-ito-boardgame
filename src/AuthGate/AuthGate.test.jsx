import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ensureSignedIn } from '../firebase';
import AuthGate from '.';

jest.mock('../firebase', () => ({ ensureSignedIn: jest.fn() }));

beforeEach(() => {
  ensureSignedIn.mockReset();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

test('ระหว่าง sign-in ยังไม่ render หน้า แล้ว render เมื่อเสร็จ', async () => {
  ensureSignedIn.mockResolvedValue('uid-1');
  render(<AuthGate><p>เนื้อหา</p></AuthGate>);
  expect(screen.getByText('กำลังเข้าสู่ระบบ...')).toBeInTheDocument();
  expect(await screen.findByText('เนื้อหา')).toBeInTheDocument();
});

test('sign-in ไม่สำเร็จ: แจ้ง error และกดลองใหม่ได้', async () => {
  ensureSignedIn.mockRejectedValueOnce(new Error('auth/network-request-failed')).mockResolvedValueOnce('uid-1');
  render(<AuthGate><p>เนื้อหา</p></AuthGate>);
  userEvent.click(await screen.findByText('ลองใหม่'));
  expect(await screen.findByText('เนื้อหา')).toBeInTheDocument();
  expect(ensureSignedIn).toHaveBeenCalledTimes(2);
});
