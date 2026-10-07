import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as fakeDb from '../testUtils/fakeDatabase';
import Chat, { CHAT_HISTORY_LIMIT, CHAT_MAX_LENGTH } from '.';

jest.mock('firebase/database', () => require('../testUtils/fakeDatabase'));
jest.mock('../firebase', () => ({ db: {} }));

const ROOM = 'rooms/room1';
const renderChat = () => render(<Chat roomPath={ROOM} clientId="me" userName="Alice" />);

beforeEach(() => fakeDb.__reset({ rooms: { room1: { host: 'Alice' } } }));

test('ส่งข้อความแล้วบันทึกพร้อมชื่อ/ผู้ส่ง และล้างช่องพิมพ์', async () => {
  renderChat();
  const input = screen.getByLabelText('ข้อความ');
  expect(screen.getByRole('button', { name: 'ส่ง' })).toBeDisabled();

  userEvent.type(input, '  ใบ้ว่าเม็ดเกลือ  {enter}');
  await waitFor(() => expect(input).toHaveValue(''));

  expect(Object.values(fakeDb.__getData(`${ROOM}/chat`))).toEqual([
    expect.objectContaining({ clientId: 'me', userName: 'Alice', text: 'ใบ้ว่าเม็ดเกลือ', createdAt: expect.any(Number) }),
  ]);
  expect(screen.getByText('ใบ้ว่าเม็ดเกลือ').closest('.chat-message')).toHaveClass('is-mine');
});

test('ข้อความของคนอื่นแสดงชื่อผู้ส่ง เรียงตามลำดับที่ส่ง', () => {
  renderChat();
  act(() => fakeDb.__write(`${ROOM}/chat/-k1`, { clientId: 'bob', userName: 'Bob', text: 'แรก' }));
  act(() => fakeDb.__write(`${ROOM}/chat/-k2`, { clientId: 'me', userName: 'Alice', text: 'สอง' }));

  expect(screen.getByText('Bob')).toBeInTheDocument();
  expect(screen.getAllByText(/^(แรก|สอง)$/).map((el) => el.textContent)).toEqual(['แรก', 'สอง']);
});

test(`โหลดแค่ ${CHAT_HISTORY_LIMIT} ข้อความล่าสุด`, () => {
  const chat = Object.fromEntries(Array.from({ length: CHAT_HISTORY_LIMIT + 20 }, (_, i) => [
    `-k${String(i).padStart(4, '0')}`, { clientId: 'bob', userName: 'Bob', text: `msg ${i}` },
  ]));
  fakeDb.__reset({ rooms: { room1: { chat } } });
  renderChat();
  expect(screen.queryByText('msg 0')).not.toBeInTheDocument();
  expect(screen.getByText(`msg ${CHAT_HISTORY_LIMIT + 19}`)).toBeInTheDocument();
  expect(screen.getAllByText(/^msg /)).toHaveLength(CHAT_HISTORY_LIMIT);
});

test(`จำกัดความยาวข้อความ ${CHAT_MAX_LENGTH} ตัวอักษร`, () => {
  renderChat();
  expect(screen.getByLabelText('ข้อความ')).toHaveAttribute('maxLength', String(CHAT_MAX_LENGTH));
});
