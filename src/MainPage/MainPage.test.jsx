import { render, screen, waitFor, act, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Cookies from 'js-cookie';
import * as fakeDb from '../testUtils/fakeDatabase';
import topic from '../constant/topic.json';
import { HOST_GRACE_MS } from '../hooks/useHost';
import { showAlert, showConfirm } from '../Dialog/dialogStore';
import MainPage from '.';

jest.mock('firebase/database', () => require('../testUtils/fakeDatabase'));
jest.mock('../firebase', () => ({ db: {} }));
jest.mock('../Dialog/dialogStore', () => ({ showAlert: jest.fn(), showConfirm: jest.fn() }));
const mockNavigate = jest.fn();
jest.mock('react-router', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => ({ roomId: 'room1' }),
}));

const ROOM = 'rooms/room1';
const ME = 'client-me';

// ค่าเริ่มต้น: เราเป็น host ของห้อง และต่อ DB ติดแล้ว
const seedRoom = (extra = {}) => fakeDb.__reset({
  '.info': { connected: true },
  rooms: { room1: { host: 'Alice', hostId: ME, heart: 3, createdAt: 1, ...extra } },
});

const renderPage = async () => {
  render(<MainPage />);
  await screen.findByText('หัวข้อ:');
  await waitFor(() => expect(fakeDb.__getData(`${ROOM}/players/${ME}/online`)).toBe(true));
};

const click = async (text) => {
  userEvent.click(await screen.findByText(text));
  await act(async () => {}); // ให้ dialog (mock) resolve และเริ่ม loading ก่อน
  await screen.findByText('หัวข้อ:'); // รอให้ loading จบ
};

const myNumberHeadings = () => screen.queryAllByRole('heading', { level: 1 }).map((h) => Number(h.textContent));
const onlinePlayer = (name, joinedAt) => ({ name, online: true, joinedAt });

beforeEach(() => {
  seedRoom();
  Cookies.set('userName', 'Alice');
  Cookies.set('clientId', ME);
  showConfirm.mockReset().mockResolvedValue(true);
  showAlert.mockReset().mockResolvedValue(undefined);
  jest.spyOn(Math, 'random').mockReturnValue(0);
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'info').mockImplementation(() => {});
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  Cookies.remove('userName');
  Cookies.remove('clientId');
});

describe('topic', () => {
  test('แสดงหัวข้อล่าสุดตามลำดับที่ push จริง ไม่ใช่ timestamp ของเครื่อง client', async () => {
    seedRoom({
      topic: {
        '-k000001': { topic: 'หัวข้อเก่า', timestamp: '2099-01-01T00:00:00.000Z' },
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

  test('host สุ่มหัวข้อไม่ซ้ำกับที่เคยสุ่ม และรีเซ็ตเลข/เลขที่เปิดของทุกคน', async () => {
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

    expect(showAlert).toHaveBeenCalledWith('หัวข้อทั้งหมดถูกใช้ไปแล้ว! กรุณาเคลียร์หัวข้อเพื่อเริ่มใหม่', expect.objectContaining({ title: 'หัวข้อหมดแล้ว' }));
    expect(Object.keys(fakeDb.__getData(`${ROOM}/topic`))).toHaveLength(topic.data.length);
  });

  test('host เคลียร์หัวข้อได้', async () => {
    seedRoom({ topic: { '-k000001': { topic: 'หัวข้อเดิม' } } });
    await renderPage();
    await click('เคลียร์หัวข้อที่เคยสุ่มแล้ว');
    expect(fakeDb.__getData(`${ROOM}/topic`)).toBeNull();
  });

  test('คนที่ไม่ใช่ host ไม่เห็นปุ่มสุ่ม/เคลียร์หัวข้อ', async () => {
    seedRoom({ hostId: 'host1', players: { host1: onlinePlayer('Alice', 1) } });
    Cookies.set('userName', 'Bob');
    await renderPage();
    expect(screen.getByText('รอ host สุ่มหัวข้อ')).toBeInTheDocument();
    expect(screen.queryByText('สุ่มหัวข้อ')).not.toBeInTheDocument();
    expect(screen.queryByText('เคลียร์หัวข้อที่เคยสุ่มแล้ว')).not.toBeInTheDocument();
  });
});

describe('presence & host', () => {
  test('เข้าห้องแล้วลงชื่อออนไลน์ และ server จะ mark offline ให้เมื่อหลุด', async () => {
    await renderPage();
    expect(fakeDb.__getData(`${ROOM}/players/${ME}`)).toMatchObject({ name: 'Alice', online: true });
    expect(fakeDb.__getData(`${ROOM}/players/${ME}/joinedAt`)).toEqual(expect.any(Number));
    expect(fakeDb.__getData('roomIndex/room1/lastSeen')).toEqual(expect.any(Number));
    expect(fakeDb.__getData(`roomIndex/room1/online/${ME}`)).toBe('Alice');

    act(() => fakeDb.__disconnect());
    expect(fakeDb.__getData(`${ROOM}/players/${ME}/online`)).toBe(false);
    expect(fakeDb.__getData('roomIndex/room1/online')).toBeNull();
  });

  test('ห้องที่ไม่มีอยู่จริงจะไม่ถูกสร้างจากการลงชื่อ', async () => {
    fakeDb.__reset({ '.info': { connected: true } });
    render(<MainPage />);
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/'));
    expect(fakeDb.__getData('rooms')).toBeNull();
  });

  test('host เห็นป้าย "คุณเป็น host" และรายชื่อผู้เล่นมีมงกุฎที่ host', async () => {
    seedRoom({ players: { p2: onlinePlayer('Bob', 2) } });
    await renderPage();
    expect(screen.getByText('คุณเป็น host')).toBeInTheDocument();

    const list = screen.getByRole('list');
    const me = within(list).getByText('Alice').closest('li');
    expect(within(me).getByText('host')).toBeInTheDocument();
    expect(within(me).getByText('(คุณ)')).toBeInTheDocument();
    expect(within(within(list).getByText('Bob').closest('li')).queryByText('host')).not.toBeInTheDocument();
  });

  test('คนที่ไม่ใช่ host ไม่เห็นป้าย host', async () => {
    seedRoom({ hostId: 'host1', players: { host1: onlinePlayer('Alice', 1) } });
    Cookies.set('userName', 'Bob');
    await renderPage();
    expect(screen.queryByText(/คุณเป็น host/)).not.toBeInTheDocument();
    expect(screen.getByText('host: Alice')).toBeInTheDocument();
  });

  test('host หลุด: คนที่ออนไลน์และเข้าห้องก่อนสุดรับ host ต่อหลังพ้นช่วงรอ', async () => {
    seedRoom({
      hostId: 'host1',
      players: { host1: { name: 'Alice', online: false, joinedAt: 1 }, late: onlinePlayer('Carol', 999999) },
    });
    Cookies.set('userName', 'Bob');
    jest.useFakeTimers();
    await renderPage();

    act(() => jest.advanceTimersByTime(HOST_GRACE_MS - 100));
    expect(fakeDb.__getData(`${ROOM}/hostId`)).toBe('host1');

    await act(async () => { jest.advanceTimersByTime(200); });
    await waitFor(() => expect(fakeDb.__getData(`${ROOM}/hostId`)).toBe(ME));
    expect(fakeDb.__getData(`${ROOM}/host`)).toBe('Bob');
    expect(fakeDb.__getData('roomIndex/room1/hostName')).toBe('Bob');
    expect(screen.getByText('คุณเป็น host')).toBeInTheDocument();
  });

  test('host หลุดแต่เราไม่ได้เข้าห้องก่อนสุด จะไม่แย่ง host', async () => {
    seedRoom({
      hostId: 'host1',
      players: { host1: { name: 'Alice', online: false, joinedAt: 1 }, early: onlinePlayer('Carol', 2) },
    });
    Cookies.set('userName', 'Bob');
    jest.useFakeTimers();
    await renderPage();
    await act(async () => { jest.advanceTimersByTime(HOST_GRACE_MS * 2); });
    expect(fakeDb.__getData(`${ROOM}/hostId`)).toBe('host1');
  });

  test('host แค่รีเฟรช กลับมาทันในช่วงรอ host ไม่ถูกโอน', async () => {
    seedRoom({ hostId: 'host1', players: { host1: { name: 'Alice', online: false, joinedAt: 1 } } });
    Cookies.set('userName', 'Bob');
    jest.useFakeTimers();
    await renderPage();

    act(() => jest.advanceTimersByTime(2000));
    act(() => fakeDb.__write(`${ROOM}/players/host1/online`, true));
    await act(async () => { jest.advanceTimersByTime(HOST_GRACE_MS * 2); });
    expect(fakeDb.__getData(`${ROOM}/hostId`)).toBe('host1');
  });

  test('ห้องเก่าที่เก็บ host เป็นชื่อ: เจ้าของชื่อได้ hostId ทันที', async () => {
    seedRoom({ hostId: null });
    await renderPage();
    await waitFor(() => expect(fakeDb.__getData(`${ROOM}/hostId`)).toBe(ME));
  });
});

describe('deal numbers', () => {
  test('host แจกเลขให้ทุกคนที่ออนไลน์ ไม่ซ้ำกัน และล้างเลขที่เปิดของรอบก่อน', async () => {
    seedRoom({
      players: {
        p2: onlinePlayer('Bob', 2),
        p3: onlinePlayer('Carol', 3),
        off: { name: 'Dave', online: false, joinedAt: 4 },
      },
      revealNumbers: { '-a': { number: 9, userName: 'Bob' } },
    });
    jest.restoreAllMocks(); // ใช้ Math.random จริง
    jest.spyOn(console, 'info').mockImplementation(() => {});
    await renderPage();
    await click('แจกเลข (3 คน)');

    const numbers = fakeDb.__getData(`${ROOM}/numbers`);
    const owners = Object.values(numbers).map((n) => n.owner).sort();
    expect(owners).toEqual([ME, 'p2', 'p3'].sort());
    expect(new Set(Object.keys(numbers)).size).toBe(3);
    expect(fakeDb.__getData(`${ROOM}/revealNumbers`)).toBeNull();

    const mine = Object.entries(numbers).find(([, n]) => n.owner === ME)[0];
    await waitFor(() => expect(myNumberHeadings()).toEqual([Number(mine)]));
  });

  test('host เลือกจำนวนเลขต่อคน แล้วแจกตามนั้น', async () => {
    seedRoom({ players: { p2: onlinePlayer('Bob', 2) } });
    await renderPage();

    userEvent.click(screen.getByRole('button', { name: '3 เลข' }));
    await waitFor(() => expect(fakeDb.__getData(`${ROOM}/settings/numbersPerPlayer`)).toBe(3));
    expect(screen.getByRole('button', { name: '3 เลข' })).toHaveAttribute('aria-pressed', 'true');

    await click('แจกเลข (2 คน)');
    const numbers = Object.values(fakeDb.__getData(`${ROOM}/numbers`));
    expect(numbers.filter((n) => n.owner === ME)).toHaveLength(3);
    expect(numbers.filter((n) => n.owner === 'p2')).toHaveLength(3);
    await waitFor(() => expect(myNumberHeadings()).toHaveLength(3));
  });

  test('แจกใหม่กลางรอบต้องยืนยันก่อน ถ้ายกเลิกเลขเดิมไม่เปลี่ยน', async () => {
    seedRoom({ numbers: { 42: { owner: ME, createdAt: 1 } } });
    showConfirm.mockResolvedValue(false);
    await renderPage();
    userEvent.click(screen.getByText('แจกเลขใหม่ (1 คน)'));

    expect(showConfirm).toHaveBeenCalledWith(expect.stringContaining('แจกเลขใหม่ = เริ่มรอบใหม่'), expect.objectContaining({ title: 'แจกเลขใหม่?' }));
    expect(fakeDb.__getData(`${ROOM}/numbers`)).toEqual({ 42: { owner: ME, createdAt: 1 } });
  });

  test('ผู้เล่นเยอะจนเลขไม่พอ แจ้งเตือนและไม่แจก', async () => {
    const players = Object.fromEntries(Array.from({ length: 34 }, (_, i) => [`p${i}`, onlinePlayer(`P${i}`, i + 10)]));
    seedRoom({ players, settings: { numbersPerPlayer: 3 } });
    await renderPage();
    userEvent.click(screen.getByText('แจกเลข (35 คน)'));

    expect(showAlert).toHaveBeenCalledWith(expect.stringContaining('เกิน 100 เลข'), expect.objectContaining({ title: 'เลขไม่พอแจก' }));
    expect(fakeDb.__getData(`${ROOM}/numbers`)).toBeNull();
  });

  test('คนที่ไม่ใช่ host ไม่มีปุ่มแจกเลข เห็นข้อความรอ host แล้วได้เลขเมื่อ host แจก', async () => {
    seedRoom({ hostId: 'host1', players: { host1: onlinePlayer('Alice', 1) } });
    Cookies.set('userName', 'Bob');
    await renderPage();

    expect(screen.getByText('รอ Alice แจกเลข')).toBeInTheDocument();
    expect(screen.queryByText(/^แจกเลข/)).not.toBeInTheDocument();

    act(() => fakeDb.__write(`${ROOM}/numbers`, { 12: { owner: ME }, 70: { owner: 'host1' } }));
    expect(myNumberHeadings()).toEqual([12]);
  });

  test('เข้าห้องกลางรอบ (ไม่ได้เลข) เห็นข้อความให้รอรอบถัดไป และในรายชื่อขึ้นว่ารอรอบหน้า', async () => {
    seedRoom({
      hostId: 'host1',
      players: { host1: onlinePlayer('Alice', 1) },
      numbers: { 70: { owner: 'host1' } },
    });
    Cookies.set('userName', 'Bob');
    await renderPage();

    expect(screen.getByText('รอบนี้เริ่มไปแล้ว รอรอบถัดไปนะ')).toBeInTheDocument();
    const me = within(screen.getByRole('list')).getByText('Bob').closest('li');
    expect(within(me).getByText('รอรอบหน้า')).toBeInTheDocument();
  });

  test('ไม่มีปุ่มสุ่มเลขเอง/เคลียร์เลขของตัวเองแล้ว', async () => {
    await renderPage();
    expect(screen.queryByText('สุ่มเลข')).not.toBeInTheDocument();
    expect(screen.queryByText('สุ่มอีกเลข')).not.toBeInTheDocument();
    expect(screen.queryByText('เคลียร์เลขของตัวเอง')).not.toBeInTheDocument();
  });

  test('อีกเครื่องเริ่มรอบใหม่ เลขในจอเราหายตาม', async () => {
    seedRoom({ numbers: { 42: { owner: ME, createdAt: 1 } } });
    await renderPage();
    expect(myNumberHeadings()).toEqual([42]);

    act(() => fakeDb.__write(`${ROOM}/numbers`, null));
    expect(myNumberHeadings()).toEqual([]);
  });

  test('refresh แล้วยังเห็นเลขของตัวเอง', async () => {
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
    await waitFor(() => expect(showAlert).toHaveBeenCalledWith('เลขนี้เคยถูกเปิดเผยแล้ว'));
    expect(Object.keys(fakeDb.__getData(`${ROOM}/revealNumbers`))).toHaveLength(1);
  });
});

describe('heart', () => {
  test('กดลดหัวใจพร้อมกันหลายครั้งแล้วลดครบ และรีหัวใจได้', async () => {
    await renderPage();
    const reduce = screen.getByText('ลด 1 หัวใจ');
    userEvent.click(reduce);
    userEvent.click(reduce);
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

describe('connection', () => {
  test('DB ค้างระหว่างแจกเลข: แจ้ง error เมื่อหมดเวลาและหน้าไม่ค้าง LOADING', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    await renderPage();
    jest.useFakeTimers();
    fakeDb.__setHooks({ offline: true });

    userEvent.click(screen.getByText('แจกเลข (1 คน)'));
    expect(screen.getByText('กำลังโหลด...')).toBeInTheDocument();

    await act(async () => { jest.advanceTimersByTime(8000); });
    expect(showAlert).toHaveBeenCalledWith('เชื่อมต่อฐานข้อมูลไม่ได้ ลองรีเฟรชหน้าแล้วกดใหม่อีกครั้ง', expect.objectContaining({ title: 'เชื่อมต่อไม่ได้' }));
    expect(screen.getByText('แจกเลข (1 คน)')).toBeInTheDocument();
  });
});
