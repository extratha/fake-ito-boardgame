import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Cookies from 'js-cookie';
import * as fakeDb from '../testUtils/fakeDatabase';
import topic from '../constant/topic.json';
import MainPage from '.';

jest.mock('firebase/database', () => require('../testUtils/fakeDatabase'));
jest.mock('../firebase', () => ({ db: {} }));
const mockNavigate = jest.fn();
jest.mock('react-router', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => ({ roomId: 'room1' }),
}));

const ROOM = 'rooms/room1';
const ME = 'client-me';

const seedRoom = (extra = {}) => fakeDb.__reset({
  rooms: { room1: { host: 'Alice', heart: 3, createdAt: 1, ...extra } },
});

const renderPage = async () => {
  render(<MainPage />);
  await screen.findByText('สุ่มหัวข้อ');
};

const click = async (text) => {
  userEvent.click(await screen.findByText(text));
  await screen.findByText('สุ่มหัวข้อ'); // รอให้ loading จบ
};

const myNumberHeadings = () => screen.queryAllByRole('heading', { level: 1 }).map((h) => Number(h.textContent));

beforeEach(() => {
  seedRoom();
  Cookies.set('userName', 'Alice');
  Cookies.set('clientId', ME);
  window.confirm = jest.fn(() => true);
  window.alert = jest.fn();
  jest.spyOn(Math, 'random').mockReturnValue(0); // สุ่มได้ตัวแรกที่ยังว่างเสมอ
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
  Cookies.remove('userName');
  Cookies.remove('clientId');
});

describe('topic', () => {
  test('แสดงหัวข้อล่าสุดตามลำดับที่ push จริง ไม่ใช่ timestamp ของเครื่อง client', async () => {
    seedRoom({
      topic: {
        '-k000001': { topic: 'หัวข้อเก่า', timestamp: '2099-01-01T00:00:00.000Z' }, // นาฬิกาเครื่องเพี้ยนไปอนาคต
        '-k000002': { topic: 'หัวข้อใหม่', timestamp: '2020-01-01T00:00:00.000Z' },
      },
    });
    await renderPage();
    expect(screen.getByText('หัวข้อใหม่')).toBeInTheDocument();
    expect(screen.queryByText('หัวข้อเก่า')).not.toBeInTheDocument();
  });

  test('อีกเครื่องเคลียร์หัวข้อ หัวข้อในจอเราหายตาม', async () => {
    seedRoom({ topic: { '-k000001': { topic: 'หัวข้อเดิม' } } });
    await renderPage();
    expect(screen.getByText('หัวข้อเดิม')).toBeInTheDocument();

    act(() => fakeDb.__write(`${ROOM}/topic`, null));
    expect(screen.queryByText('หัวข้อเดิม')).not.toBeInTheDocument();
  });

  test('สุ่มหัวข้อไม่ซ้ำกับที่เคยสุ่ม และรีเซ็ตเลข/เลขที่เปิดของทุกคน', async () => {
    const used = topic.data.slice(0, -1);
    const remaining = topic.data[topic.data.length - 1];
    seedRoom({
      topic: Object.fromEntries(used.map((t, i) => [`-a${String(i).padStart(4, '0')}`, { topic: t }])),
      numbers: { 5: { owner: 'other', userName: 'Bob', createdAt: 1 } },
      revealNumbers: { '-a': { number: 5, userName: 'Bob' } },
    });
    await renderPage();
    await click('สุ่มหัวข้อ');

    expect(screen.getByText(remaining)).toBeInTheDocument();
    const topics = Object.values(fakeDb.__getData(`${ROOM}/topic`)).map((t) => t.topic);
    expect(new Set(topics).size).toBe(topic.data.length);
    expect(fakeDb.__getData(`${ROOM}/numbers`)).toBeNull();
    expect(fakeDb.__getData(`${ROOM}/revealNumbers`)).toBeNull();
  });

  test('หัวข้อถูกใช้หมดแล้วแจ้งเตือนและไม่เพิ่มหัวข้อ', async () => {
    seedRoom({
      topic: Object.fromEntries(topic.data.map((t, i) => [`-a${String(i).padStart(4, '0')}`, { topic: t }])),
    });
    await renderPage();
    await click('สุ่มหัวข้อ');

    expect(window.alert).toHaveBeenCalledWith('หัวข้อทั้งหมดถูกใช้ไปแล้ว! กรุณาเคลียร์หัวข้อเพื่อเริ่มใหม่');
    expect(Object.keys(fakeDb.__getData(`${ROOM}/topic`))).toHaveLength(topic.data.length);
  });

  test('host เคลียร์หัวข้อได้', async () => {
    seedRoom({ topic: { '-k000001': { topic: 'หัวข้อเดิม' } } });
    await renderPage();
    await click('เคลียร์หัวข้อที่เคยสุ่มแล้ว');
    expect(fakeDb.__getData(`${ROOM}/topic`)).toBeNull();
    expect(screen.queryByText('หัวข้อเดิม')).not.toBeInTheDocument();
  });
});

describe('numbers', () => {
  test('สุ่มเลขได้สูงสุด 3 เลข ไม่ซ้ำ และบันทึกเจ้าของไว้ใน DB', async () => {
    await renderPage();
    await click('สุ่มเลข');
    await waitFor(() => expect(myNumberHeadings()).toEqual([1]));
    expect(screen.getByText('สุ่มเลข')).toBeDisabled();

    await click('สุ่มอีกเลข');
    await click('สุ่มอีกเลข');
    await waitFor(() => expect(myNumberHeadings()).toEqual([1, 2, 3]));
    expect(screen.queryByText('สุ่มอีกเลข')).not.toBeInTheDocument();

    const numbers = fakeDb.__getData(`${ROOM}/numbers`);
    expect(Object.keys(numbers)).toEqual(['1', '2', '3']);
    Object.values(numbers).forEach((n) => expect(n).toMatchObject({ owner: ME, userName: 'Alice' }));
  });

  test('ไม่สุ่มได้เลขที่คนอื่นใช้ไปแล้ว (รวมข้อมูลรูปแบบเก่า)', async () => {
    seedRoom({
      numbers: {
        1: { owner: 'other', createdAt: 1 },
        '-legacy1': { number: 2, timestamp: '2020-01-01T00:00:00.000Z' },
      },
    });
    await renderPage();
    await click('สุ่มเลข');
    await waitFor(() => expect(myNumberHeadings()).toEqual([3]));
  });

  test('ถ้ามีคนแย่งเลขเดียวกันไปก่อน จะไม่เขียนทับและสุ่มเลขใหม่ให้', async () => {
    let first = true;
    fakeDb.__setHooks({
      beforeTransaction: (path) => {
        if (first) {
          first = false;
          fakeDb.__write(path, { owner: 'other', userName: 'Bob', createdAt: 1 });
        }
      },
    });
    await renderPage();
    await click('สุ่มเลข');

    await waitFor(() => expect(myNumberHeadings()).toEqual([2]));
    expect(fakeDb.__getData(`${ROOM}/numbers/1`)).toMatchObject({ owner: 'other' });
  });

  test('เลขถูกใช้ครบ 100 แล้วแจ้งเตือน', async () => {
    seedRoom({
      numbers: Object.fromEntries(Array.from({ length: 100 }, (_, i) => [i + 1, { owner: 'other' }])),
    });
    await renderPage();
    await click('สุ่มเลข');
    expect(window.alert).toHaveBeenCalledWith('เลขทั้งหมดถูกใช้ไปแล้ว! กรุณาเคลียร์เลขเพื่อสุ่มใหม่');
  });

  test('อีกเครื่องเริ่มเกมใหม่/เคลียร์เลขทุกคน เลขในจอเราหายตาม', async () => {
    seedRoom({ numbers: { 42: { owner: ME, createdAt: 1 } } });
    await renderPage();
    expect(myNumberHeadings()).toEqual([42]);

    act(() => fakeDb.__write(`${ROOM}/numbers`, null));
    expect(myNumberHeadings()).toEqual([]);
    expect(screen.getByText('สุ่มเลข')).not.toBeDisabled();
  });

  test('refresh แล้วยังเห็นเลขของตัวเอง เรียงตามลำดับที่สุ่ม', async () => {
    seedRoom({
      numbers: {
        10: { owner: ME, createdAt: 30 },
        50: { owner: 'other', createdAt: 10 },
        70: { owner: ME, createdAt: 20 },
      },
    });
    await renderPage();
    expect(myNumberHeadings()).toEqual([70, 10]);
  });

  test('เคลียร์เลขของตัวเองลบเฉพาะเลขของเรา', async () => {
    seedRoom({ numbers: { 10: { owner: ME }, 50: { owner: 'other' } } });
    await renderPage();
    await click('เคลียร์เลขของตัวเอง');

    expect(fakeDb.__getData(`${ROOM}/numbers`)).toEqual({ 50: { owner: 'other' } });
    expect(myNumberHeadings()).toEqual([]);
    expect(window.alert).toHaveBeenCalledWith('เคลียร์เลขที่สุ่มไปแล้วเรียบร้อย!');
  });

  test('host เคลียร์เลขทุกคน', async () => {
    seedRoom({ numbers: { 10: { owner: ME }, 50: { owner: 'other' } } });
    await renderPage();
    await click('เคลียร์เลขทุกคน');
    expect(fakeDb.__getData(`${ROOM}/numbers`)).toBeNull();
  });

  test('คนที่ไม่ใช่ host ไม่เห็นปุ่มเคลียร์ของ host', async () => {
    Cookies.set('userName', 'Bob');
    await renderPage();
    await waitFor(() => expect(screen.queryByText('เคลียร์เลขทุกคน')).not.toBeInTheDocument());
    expect(screen.queryByText('เคลียร์หัวข้อที่เคยสุ่มแล้ว')).not.toBeInTheDocument();
  });
});

describe('reveal', () => {
  test('เปิดเผยเลขแล้วบันทึก และเปิดซ้ำไม่ได้', async () => {
    seedRoom({ numbers: { 42: { owner: ME, createdAt: 1 } } });
    await renderPage();

    userEvent.click(screen.getByRole('heading', { level: 1, name: '42' }));
    await waitFor(() => expect(fakeDb.__getData(`${ROOM}/revealNumbers`)).not.toBeNull());
    expect(Object.values(fakeDb.__getData(`${ROOM}/revealNumbers`))).toEqual([
      expect.objectContaining({ number: 42, userName: 'Alice' }),
    ]);

    userEvent.click(screen.getAllByRole('heading', { level: 1, name: '42' })[0]);
    await waitFor(() => expect(window.alert).toHaveBeenCalledWith('เลขนี้เคยถูกเปิดเผยแล้ว'));
    expect(Object.keys(fakeDb.__getData(`${ROOM}/revealNumbers`))).toHaveLength(1);
  });
});

describe('heart', () => {
  test('กดลดหัวใจพร้อมกันหลายเครื่องแล้วลดครบ และไม่ต่ำกว่า 0', async () => {
    await renderPage();
    const reduce = screen.getByText('ลด 1 หัวใจ');
    userEvent.click(reduce);
    userEvent.click(reduce); // กดซ้ำก่อน state ในจออัปเดต
    await waitFor(() => expect(fakeDb.__getData(`${ROOM}/heart`)).toBe(1));

    act(() => fakeDb.__write(`${ROOM}/heart`, 0));
    userEvent.click(screen.getByText('รีหัวใจ'));
    await waitFor(() => expect(fakeDb.__getData(`${ROOM}/heart`)).toBe(3));
  });

  test('หัวใจเหลือ 1 แล้วกดลดรัว ๆ ไม่ต่ำกว่า 0', async () => {
    seedRoom({ heart: 1 });
    await renderPage();
    const reduce = screen.getByText('ลด 1 หัวใจ');
    userEvent.click(reduce);
    userEvent.click(reduce);
    await waitFor(() => expect(screen.getByText('ลด 1 หัวใจ')).toBeDisabled());
    expect(fakeDb.__getData(`${ROOM}/heart`)).toBe(0);
  });
});
