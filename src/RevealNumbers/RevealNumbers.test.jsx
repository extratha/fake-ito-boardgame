import { render, screen, act } from '@testing-library/react';
import * as fakeDb from '../testUtils/fakeDatabase';
import RevealNumbers from '.';

jest.mock('firebase/database', () => require('../testUtils/fakeDatabase'));
jest.mock('../firebase', () => ({ db: {} }));

const names = () => screen.getAllByText(/^(Alice|Bob|Carol)$/).map((el) => el.textContent);

test('เลขที่เปิดล่าสุดอยู่บนสุดตามลำดับ push ไม่ขึ้นกับนาฬิกาเครื่อง', () => {
  fakeDb.__reset({
    rooms: {
      room1: {
        revealNumbers: {
          '-k000001': { number: 10, userName: 'Alice', timestamp: '2099-01-01T00:00:00.000Z' },
          '-k000002': { number: 20, userName: 'Bob', timestamp: '2020-01-01T00:00:00.000Z' },
        },
      },
    },
  });
  render(<RevealNumbers roomId="room1" />);
  expect(names()).toEqual(['Bob', 'Alice']);

  act(() => fakeDb.__write('rooms/room1/revealNumbers/-k000003', { number: 30, userName: 'Carol', timestamp: '2000-01-01T00:00:00.000Z' }));
  expect(names()).toEqual(['Carol', 'Bob', 'Alice']);

  act(() => fakeDb.__write('rooms/room1/revealNumbers', null));
  expect(screen.queryByText('Alice')).not.toBeInTheDocument();
});

test('ปุ่มซ่อน/แสดง panel เลขที่เปิด (เริ่มต้นแสดง)', () => {
  fakeDb.__reset({
    rooms: { room1: { revealNumbers: { '-k000001': { number: 10, userName: 'Alice' } } } },
  });
  render(<RevealNumbers roomId="room1" />);
  const toggle = screen.getByRole('button', { name: 'ซ่อนเลขที่เปิดแล้ว' });
  expect(toggle).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByText('Alice')).toBeInTheDocument();

  act(() => toggle.click());
  expect(screen.queryByText('Alice')).not.toBeInTheDocument();
  expect(screen.getByText('เปิดแล้ว 1')).toBeInTheDocument();

  act(() => screen.getByRole('button', { name: 'แสดงเลขที่เปิดแล้ว' }).click());
  expect(screen.getByText('Alice')).toBeInTheDocument();
});
