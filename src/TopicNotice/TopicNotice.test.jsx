import { render, screen, act, fireEvent } from '@testing-library/react';
import * as fakeDb from '../testUtils/fakeDatabase';
import TopicNotice, { TOPIC_NOTICE_MS } from '.';

jest.mock('firebase/database', () => require('../testUtils/fakeDatabase'));
jest.mock('../firebase', () => ({ db: {} }));

const PATH = 'rooms/room1';

beforeEach(() => {
  jest.useFakeTimers();
  jest.spyOn(console, 'info').mockImplementation(() => {});
  fakeDb.__reset({ rooms: { room1: { topic: { '-k1': { topic: 'หัวข้อเก่า', createdAt: 1 } } } } });
});
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

test('หัวข้อที่มีอยู่ก่อนเข้าห้องไม่แจ้งเตือน แต่หัวข้อใหม่แจ้งแล้วหายเอง', () => {
  render(<TopicNotice roomPath={PATH} />);
  expect(screen.queryByRole('status')).not.toBeInTheDocument();

  act(() => fakeDb.__write(`${PATH}/topic/-k2`, { topic: 'อาหารโปรด', createdAt: Date.now() }));
  expect(screen.getByRole('status')).toHaveTextContent('หัวข้อเปลี่ยนแล้วอาหารโปรด');
  expect(console.info).toHaveBeenCalledWith(expect.stringContaining('[latency] topic changed'));

  act(() => { jest.advanceTimersByTime(TOPIC_NOTICE_MS + 10); });
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});

test('host เองไม่ถูกแจ้งซ้ำ และการเคลียร์หัวข้อไม่แจ้ง', () => {
  const { rerender } = render(<TopicNotice roomPath={PATH} silent />);
  act(() => fakeDb.__write(`${PATH}/topic/-k2`, { topic: 'สัตว์', createdAt: 2 }));
  expect(screen.queryByRole('status')).not.toBeInTheDocument();

  rerender(<TopicNotice roomPath={PATH} silent={false} />);
  act(() => fakeDb.__write(`${PATH}/topic`, null));
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});

test('กดปุ่มปิดแล้วป้ายหายทันที', () => {
  render(<TopicNotice roomPath={PATH} />);
  act(() => fakeDb.__write(`${PATH}/topic/-k2`, { topic: 'ผลไม้', createdAt: 2 }));
  fireEvent.click(screen.getByRole('button', { name: 'ปิดแจ้งเตือน' }));
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});
