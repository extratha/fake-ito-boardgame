import { render, screen, waitFor, act, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Cookies from 'js-cookie';
import * as fakeDb from '../testUtils/fakeDatabase';
import topic from '../constant/topic.json';
import { HOST_GRACE_MS } from '../hooks/useHost';
import { showAlert, showConfirm } from '../Dialog/dialogStore';
import MainPage from '.';

jest.mock('firebase/database', () => require('../testUtils/fakeDatabase'));
jest.mock('../firebase', () => ({ db: {}, auth: { currentUser: { uid: 'client-me' } } }));
jest.mock('../Dialog/dialogStore', () => ({ showAlert: jest.fn(), showConfirm: jest.fn() }));
const mockNavigate = jest.fn();
jest.mock('react-router', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => ({ roomId: 'room1' }),
}));

const ROOM = 'rooms/room1';
const ME = 'client-me';

const handData = (hands) => Object.fromEntries(Object.entries(hands).map(([id, nums]) => [id, Object.fromEntries(nums.map((n) => [n, true]))]));
const dealtNumbers = () => Object.fromEntries(Object.entries(fakeDb.__getData('hands/room1') || {}).map(([id, hand]) => [id, Object.keys(hand).map(Number)]));
const reveal = (uid, userName, createdAt) => ({ uid, userName, createdAt });

// ค่าเริ่มต้น: เราเป็น host ของห้อง และต่อ DB ติดแล้ว
// hands = เลขในมือของแต่ละคน เช่น { [ME]: [20, 40], other: [10] } (เก็บที่ hands/room1 และ dealt บอกจำนวน)
const seedRoom = (extra = {}, hands = {}) => fakeDb.__reset({
  '.info': { connected: true },
  rooms: {
    room1: {
      host: 'Alice', hostId: ME, heart: 3, createdAt: 1,
      ...(Object.keys(hands).length > 0 && { dealt: Object.fromEntries(Object.entries(hands).map(([id, nums]) => [id, nums.length])) }),
      ...extra,
    },
  },
  ...(Object.keys(hands).length > 0 && { hands: { room1: handData(hands) } }),
});

const renderPage = async () => {
  render(<MainPage />);
  await screen.findByText('หัวข้อ:');
  await waitFor(() => expect(fakeDb.__getData(`${ROOM}/players/${ME}/online`)).toBe(true));
};

const click = async (text) => {
  userEvent.click(await screen.findByText(text));
  await act(async () => {}); // ให้ dialog (mock) resolve และเริ่ม loading ก่อน
  await waitFor(() => expect(screen.queryByText('กำลังโหลด...')).not.toBeInTheDocument()); // รอให้ loading จบ
};

const myNumberHeadings = () => screen.queryAllByRole('heading', { level: 1 }).map((h) => Number(h.textContent));
const onlinePlayer = (name, joinedAt) => ({ name, online: true, joinedAt });

beforeEach(() => {
  seedRoom();
  Cookies.set('userName', 'Alice');
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
      revealNumbers: { 5: reveal('other', 'Bob', 1) },
    }, { other: [5] });
    await renderPage();
    await click('สุ่มหัวข้อ');

    expect(screen.getByText(remaining)).toBeInTheDocument();
    const topics = Object.values(fakeDb.__getData(`${ROOM}/topic`)).map((t) => t.topic);
    expect(new Set(topics).size).toBe(topic.data.length);
    expect(fakeDb.__getData('hands/room1')).toBeNull();
    expect(fakeDb.__getData(`${ROOM}/dealt`)).toBeNull();
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
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true, state: { missingRoomId: 'room1' } }));
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
      revealNumbers: { 9: reveal('p2', 'Bob', 1) },
    });
    jest.restoreAllMocks(); // ใช้ Math.random จริง
    jest.spyOn(console, 'info').mockImplementation(() => {});
    await renderPage();
    await click('แจกเลข (3 คน)');

    const hands = dealtNumbers();
    expect(Object.keys(hands).sort()).toEqual([ME, 'p2', 'p3'].sort());
    expect(new Set(Object.values(hands).flat()).size).toBe(3);
    expect(fakeDb.__getData(`${ROOM}/dealt`)).toEqual({ [ME]: 1, p2: 1, p3: 1 });
    expect(fakeDb.__getData(`${ROOM}/revealNumbers`)).toBeNull();

    await waitFor(() => expect(myNumberHeadings()).toEqual(hands[ME]));
  });

  test('host เลือกจำนวนเลขต่อคน แล้วแจกตามนั้น', async () => {
    seedRoom({ players: { p2: onlinePlayer('Bob', 2) } });
    await renderPage();

    userEvent.click(screen.getByRole('button', { name: '3 เลข' }));
    await waitFor(() => expect(fakeDb.__getData(`${ROOM}/settings/numbersPerPlayer`)).toBe(3));
    expect(screen.getByRole('button', { name: '3 เลข' })).toHaveAttribute('aria-pressed', 'true');

    await click('แจกเลข (2 คน)');
    const hands = dealtNumbers();
    expect(hands[ME]).toHaveLength(3);
    expect(hands.p2).toHaveLength(3);
    await waitFor(() => expect(myNumberHeadings()).toHaveLength(3));
  });

  test('แจกใหม่กลางรอบต้องยืนยันก่อน ถ้ายกเลิกเลขเดิมไม่เปลี่ยน', async () => {
    seedRoom({}, { [ME]: [42] });
    showConfirm.mockResolvedValue(false);
    await renderPage();
    userEvent.click(screen.getByText('แจกเลขใหม่ (1 คน)'));

    expect(showConfirm).toHaveBeenCalledWith(expect.stringContaining('แจกเลขใหม่ = เริ่มรอบใหม่'), expect.objectContaining({ title: 'แจกเลขใหม่?' }));
    expect(dealtNumbers()).toEqual({ [ME]: [42] });
  });

  test('ผู้เล่นเยอะจนเลขไม่พอ แจ้งเตือนและไม่แจก', async () => {
    const players = Object.fromEntries(Array.from({ length: 34 }, (_, i) => [`p${i}`, onlinePlayer(`P${i}`, i + 10)]));
    seedRoom({ players, settings: { numbersPerPlayer: 3 } });
    await renderPage();
    userEvent.click(screen.getByText('แจกเลข (35 คน)'));

    expect(showAlert).toHaveBeenCalledWith(expect.stringContaining('เกิน 100 เลข'), expect.objectContaining({ title: 'เลขไม่พอแจก' }));
    expect(fakeDb.__getData('hands/room1')).toBeNull();
  });

  test('คนที่ไม่ใช่ host ไม่มีปุ่มแจกเลข เห็นข้อความรอ host แล้วได้เลขเมื่อ host แจก', async () => {
    seedRoom({ hostId: 'host1', players: { host1: onlinePlayer('Alice', 1) } });
    Cookies.set('userName', 'Bob');
    await renderPage();

    expect(screen.getByText('รอ Alice แจกเลข')).toBeInTheDocument();
    expect(screen.queryByText(/^แจกเลข/)).not.toBeInTheDocument();

    act(() => fakeDb.__write('hands/room1', handData({ [ME]: [12], host1: [70] })));
    expect(myNumberHeadings()).toEqual([12]);
  });

  test('เข้าห้องกลางรอบ (ไม่ได้เลข) เห็นข้อความให้รอรอบถัดไป และในรายชื่อขึ้นว่ารอรอบหน้า', async () => {
    seedRoom({
      hostId: 'host1',
      players: { host1: onlinePlayer('Alice', 1) },
    }, { host1: [70] });
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
    seedRoom({}, { [ME]: [42] });
    await renderPage();
    expect(myNumberHeadings()).toEqual([42]);

    act(() => fakeDb.__write('hands/room1', null));
    act(() => fakeDb.__write(`${ROOM}/dealt`, null));
    expect(myNumberHeadings()).toEqual([]);
  });

  test('refresh แล้วยังเห็นเลขของตัวเอง เรียงจากน้อยไปมาก และไม่เห็นเลขของคนอื่น', async () => {
    seedRoom({}, { [ME]: [70, 10], other: [50] });
    await renderPage();
    expect(myNumberHeadings()).toEqual([10, 70]);
    expect(screen.queryByText('50')).not.toBeInTheDocument();
  });
});

describe('reveal', () => {
  test('เปิดเผยเลขแล้วบันทึก และเปิดซ้ำไม่ได้', async () => {
    seedRoom({}, { [ME]: [42] });
    await renderPage();

    userEvent.click(screen.getByRole('heading', { level: 1, name: '42' }));
    await waitFor(() => expect(fakeDb.__getData(`${ROOM}/revealNumbers`)).not.toBeNull());
    expect(fakeDb.__getData(`${ROOM}/revealNumbers`)).toEqual({
      42: { userName: 'Alice', uid: ME, createdAt: expect.any(Number) },
    });

    userEvent.click(screen.getAllByRole('heading', { level: 1, name: '42' })[0]);
    await waitFor(() => expect(showAlert).toHaveBeenCalledWith('เลขนี้เคยถูกเปิดเผยแล้ว'));
    expect(Object.keys(fakeDb.__getData(`${ROOM}/revealNumbers`))).toHaveLength(1);
  });

  test('อีกแท็บเปิดเลขเดียวกันไปก่อน (ระหว่างที่เรายืนยันอยู่) ไม่บันทึกซ้ำและแจ้งว่าเปิดแล้ว', async () => {
    seedRoom({}, { [ME]: [42] });
    showConfirm.mockImplementation(async () => {
      fakeDb.__write(`${ROOM}/revealNumbers/42`, reveal(ME, 'Alice', 5));
      return true;
    });
    await renderPage();

    userEvent.click(screen.getByRole('heading', { level: 1, name: '42' }));
    await waitFor(() => expect(showAlert).toHaveBeenCalledWith('เลขนี้เคยถูกเปิดเผยแล้ว'));
    expect(fakeDb.__getData(`${ROOM}/revealNumbers/42`)).toEqual(reveal(ME, 'Alice', 5));
  });
});

describe('เปิดเลขข้ามคนอื่น', () => {
  const seedDealt = (extra = {}) => seedRoom(extra, { other: [10], [ME]: [20, 40], other2: [30] });

  test('ไฮไลต์เลขของเราที่โดนข้าม', async () => {
    seedDealt({ revealNumbers: { 30: reveal('other2', 'Bob', 1) } });
    await renderPage();
    expect(screen.getByRole('heading', { level: 1, name: '20' })).toHaveClass('is-skipped');
    expect(screen.getByRole('heading', { level: 1, name: '40' })).not.toHaveClass('is-skipped');
  });

  test('เลขที่โดนข้ามแล้วถูกเปิดทีหลัง ยังไฮไลต์ค้างไว้จนกว่าจะแจกใหม่', async () => {
    seedDealt({ revealNumbers: { 30: reveal('other2', 'Bob', 1), 20: reveal(ME, 'Alice', 2) } });
    await renderPage();
    expect(screen.getByRole('heading', { level: 1, name: '20' })).toHaveClass('is-skipped');
  });

  test('คนอื่นเปิดข้ามเลขของเรา: เครื่องเราเขียน taunt event ให้ทุกคนเห็น', async () => {
    seedDealt();
    await renderPage();
    expect(fakeDb.__getData(`${ROOM}/taunt`)).toBeNull();

    act(() => fakeDb.__write(`${ROOM}/revealNumbers/30`, reveal('other2', 'Bob', 1)));
    await waitFor(() => expect(fakeDb.__getData(`${ROOM}/taunt`)).toEqual({
      id: expect.any(String), index: expect.any(Number),
    }));
  });

  test('เราเปิดข้ามเลขตัวเองก็เขียน taunt', async () => {
    seedDealt();
    await renderPage();
    userEvent.click(screen.getByRole('heading', { level: 1, name: '40' })); // ข้าม 20 ของเราเอง
    await waitFor(() => expect(fakeDb.__getData(`${ROOM}/taunt`)).not.toBeNull());
  });

  test('เลขที่โดนข้ามไม่ใช่ของเรา เครื่องเราไม่เขียน taunt (เครื่องเจ้าของเลขเป็นคนเขียน)', async () => {
    seedRoom({}, { other: [10], [ME]: [40] });
    await renderPage();
    act(() => fakeDb.__write(`${ROOM}/revealNumbers/30`, reveal('other2', 'Bob', 1)));
    await act(async () => {});
    expect(fakeDb.__getData(`${ROOM}/taunt`)).toBeNull();
  });

  test('failed แล้วเปิดเลขอื่นต่อไม่แซวซ้ำ จนกว่าจะแจกเลขใหม่', async () => {
    seedDealt();
    await renderPage();
    act(() => fakeDb.__write(`${ROOM}/revealNumbers/30`, reveal('other2', 'Bob', 1))); // ข้าม 20 ของเรา
    await waitFor(() => expect(fakeDb.__getData(`${ROOM}/taunt`)).not.toBeNull());
    const first = fakeDb.__getData(`${ROOM}/taunt`);

    act(() => fakeDb.__write(`hands/room1/${ME}/25`, true));
    userEvent.click(await screen.findByRole('heading', { level: 1, name: '40' })); // ข้าม 25 ของเราอีก
    await waitFor(() => expect(Object.keys(fakeDb.__getData(`${ROOM}/revealNumbers`))).toHaveLength(2));
    await act(async () => {});
    expect(fakeDb.__getData(`${ROOM}/taunt`)).toEqual(first);

    await click('แจกเลขใหม่ (1 คน)');
    expect(fakeDb.__getData(`${ROOM}/taunt`)).toBeNull();
  });

  test('เปิดเรียงถูกลำดับไม่มี taunt', async () => {
    seedRoom({}, { [ME]: [10], other: [20] });
    await renderPage();
    userEvent.click(screen.getByRole('heading', { level: 1, name: '10' }));
    await waitFor(() => expect(fakeDb.__getData(`${ROOM}/revealNumbers`)).not.toBeNull());
    expect(fakeDb.__getData(`${ROOM}/taunt`)).toBeNull();
  });
});

describe('ชนะรอบ', () => {
  const hasRainbow = () => document.querySelector('.win-border') !== null;

  test('ทุกคนเปิดครบและเรียงถูก: แสดงขอบรุ้งและป้ายผ่านหมด แจกใหม่แล้วหายไป', async () => {
    seedRoom({ revealNumbers: { 10: reveal('other', 'Bob', 1) } }, { other: [10], [ME]: [20] });
    await renderPage();
    expect(hasRainbow()).toBe(false);

    userEvent.click(screen.getByRole('heading', { level: 1, name: '20' }));
    await waitFor(() => expect(hasRainbow()).toBe(true));
    expect(screen.getByText('ผ่านหมด!')).toBeInTheDocument();

    await click('แจกเลขใหม่ (1 คน)');
    expect(hasRainbow()).toBe(false);
  });

  test('เปิดครบแต่มีใบโดนข้าม: ไม่ฉลอง', async () => {
    seedRoom({ revealNumbers: { 20: reveal(ME, 'Alice', 1), 10: reveal('other', 'Bob', 2) } }, { other: [10], [ME]: [20] });
    await renderPage();
    expect(hasRainbow()).toBe(false);
  });
});

describe('เลขที่เปิดไปแล้ว', () => {
  test('การ์ดที่เปิดแล้วเป็นสีเทา ที่ยังไม่เปิดคงสีเดิม', async () => {
    seedRoom({ revealNumbers: { 10: reveal(ME, 'Alice', 1) } }, { [ME]: [10, 20] });
    await renderPage();
    const opened = screen.getByRole('heading', { level: 1, name: '10' });
    const unopened = screen.getByRole('heading', { level: 1, name: '20' });
    expect(opened).toHaveClass('is-revealed');
    expect(opened.style.color).toBe('');
    expect(unopened).not.toHaveClass('is-revealed');
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
