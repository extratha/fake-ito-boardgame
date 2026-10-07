import { render, screen, act, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as fakeDb from '../testUtils/fakeDatabase';
import OnlineRooms, { toOnlineRooms } from '.';

jest.mock('firebase/database', () => require('../testUtils/fakeDatabase'));
jest.mock('../firebase', () => ({ db: {} }));

test('toOnlineRooms แสดงเฉพาะห้องที่มีคนออนไลน์ เรียงตามจำนวนคน', () => {
  expect(toOnlineRooms({
    EMPT: { hostName: 'X', lastSeen: 9 },
    AAAA: { hostName: 'Alice', online: { a: 'Alice' }, lastSeen: 5 },
    BBBB: { hostName: 'Bob', online: { b: 'Bob', c: 'Carol' }, lastSeen: 1 },
  }).map((r) => [r.roomId, r.players.length])).toEqual([['BBBB', 2], ['AAAA', 1]]);
  expect(toOnlineRooms(null)).toEqual([]);
});

test('lobby แสดงห้อง/host/จำนวนคนแบบ realtime และกดเข้าห้องได้', () => {
  fakeDb.__reset({ roomIndex: { K7QM: { hostName: 'Alice', online: { a: 'Alice', b: 'Bob' } } } });
  const onJoin = jest.fn();
  render(<OnlineRooms onJoin={onJoin} />);

  const item = screen.getByText('K7QM').closest('li');
  expect(within(item).getByText('host: Alice · 2 คน')).toBeInTheDocument();
  userEvent.click(screen.getByRole('button', { name: 'เข้าห้อง K7QM' }));
  expect(onJoin).toHaveBeenCalledWith('K7QM');

  act(() => fakeDb.__write('roomIndex/K7QM/online', null));
  expect(screen.queryByText('K7QM')).not.toBeInTheDocument();
  expect(screen.getByText('ยังไม่มีห้องที่มีคนออนไลน์ สร้างห้องใหม่ได้เลย')).toBeInTheDocument();
});
