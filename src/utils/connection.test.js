import { withTimeout, DbTimeoutError, DB_TIMEOUT_MS } from './connection';

jest.mock('firebase/database', () => require('../testUtils/fakeDatabase'));
jest.mock('../firebase', () => ({ db: {} }));

afterEach(() => jest.useRealTimers());

test('withTimeout คืนค่าเดิมเมื่อ promise สำเร็จทันเวลา', async () => {
  await expect(withTimeout(Promise.resolve(42), 'x')).resolves.toBe(42);
});

test('withTimeout ส่งต่อ error เดิมของ promise', async () => {
  await expect(withTimeout(Promise.reject(new Error('boom')), 'x')).rejects.toThrow('boom');
});

test('withTimeout reject ด้วย DbTimeoutError เมื่อ promise ค้าง', async () => {
  jest.useFakeTimers();
  const result = withTimeout(new Promise(() => {}), 'create room');
  jest.advanceTimersByTime(DB_TIMEOUT_MS);
  await expect(result).rejects.toBeInstanceOf(DbTimeoutError);
  await expect(result).rejects.toThrow('create room timed out');
});
