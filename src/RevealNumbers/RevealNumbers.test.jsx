import { render, screen, act, fireEvent } from '@testing-library/react';
import * as fakeDb from '../testUtils/fakeDatabase';
import RevealNumbers, { DEFAULT_PANEL_POSITION, PANEL_POSITION_KEY, snapSide, DESKTOP_MEDIA_QUERY } from '.';

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

describe('drag', () => {
  const header = () => screen.getByTitle('ลากเพื่อย้ายไปชิดซ้าย/ขวา');
  const panel = () => screen.getByRole('complementary', { name: 'เลขที่เปิดแล้ว' });
  const drag = (from, to) => {
    fireEvent.pointerDown(header(), { pointerId: 1, button: 0, clientX: from[0], clientY: from[1] });
    fireEvent.pointerMove(header(), { pointerId: 1, clientX: to[0], clientY: to[1] });
    fireEvent.pointerUp(header(), { pointerId: 1, clientX: to[0], clientY: to[1] });
  };

  beforeEach(() => {
    localStorage.clear();
    fakeDb.__reset({ rooms: { room1: { revealNumbers: { '-k1': { number: 10, userName: 'Alice' } } } } });
    window.innerWidth = 400;
    window.innerHeight = 800;
  });

  test('เริ่มต้นชิดซ้าย ใต้ header', () => {
    render(<RevealNumbers roomId="room1" />);
    expect(panel().style.left).toBe('8px');
    expect(panel().style.top).toBe(`${DEFAULT_PANEL_POSITION.top}px`);
  });

  test('ลากไปครึ่งขวาแล้วปล่อย ชิดขวา, ลากกลับครึ่งซ้าย ชิดซ้าย และจำตำแหน่งไว้', () => {
    const { unmount } = render(<RevealNumbers roomId="room1" />);
    drag([20, 100], [300, 400]);
    expect(panel()).toHaveClass('is-right');
    expect(panel().style.right).toBe('8px');
    expect(panel().style.left).toBe('');
    expect(panel().style.top).toBe('300px'); // jsdom: panel เริ่มที่ top 0 แล้วลากลง 300
    expect(JSON.parse(localStorage.getItem(PANEL_POSITION_KEY))).toEqual({ side: 'right', top: 300 });

    unmount();
    render(<RevealNumbers roomId="room1" />);
    expect(panel().style.right).toBe('8px'); // เปิดใหม่ยังอยู่ที่เดิม

    drag([380, 400], [100, 200]);
    expect(panel()).not.toHaveClass('is-right');
    expect(panel().style.left).toBe('8px');
  });

  test('ระหว่างลาก panel ตามนิ้ว และไม่หลุดขอบจอ', () => {
    render(<RevealNumbers roomId="room1" />);
    fireEvent.pointerDown(header(), { pointerId: 1, button: 0, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(header(), { pointerId: 1, clientX: 150, clientY: 5000 });
    expect(panel()).toHaveClass('is-dragging');
    expect(panel().style.left).toBe('150px');
    expect(parseInt(panel().style.top, 10)).toBeLessThanOrEqual(800);
    fireEvent.pointerUp(header(), { pointerId: 1, clientX: 150, clientY: 5000 });
    expect(parseInt(panel().style.top, 10)).toBeLessThanOrEqual(800 - 60);
  });

  test('แตะปุ่ม (ขยับไม่ถึง threshold) ยังพับ/กางได้ และการลากไม่ไปพับ panel', () => {
    render(<RevealNumbers roomId="room1" />);
    const toggle = screen.getByRole('button', { name: 'ซ่อนเลขที่เปิดแล้ว' });
    fireEvent.pointerDown(toggle, { pointerId: 1, button: 0, clientX: 50, clientY: 50 });
    fireEvent.pointerMove(toggle, { pointerId: 1, clientX: 52, clientY: 51 });
    fireEvent.pointerUp(toggle, { pointerId: 1, clientX: 52, clientY: 51 });
    fireEvent.click(toggle);
    expect(screen.getByRole('button', { name: 'แสดงเลขที่เปิดแล้ว' })).toBeInTheDocument();

    const toggle2 = screen.getByRole('button', { name: 'แสดงเลขที่เปิดแล้ว' });
    fireEvent.pointerDown(toggle2, { pointerId: 1, button: 0, clientX: 50, clientY: 50 });
    fireEvent.pointerMove(toggle2, { pointerId: 1, clientX: 300, clientY: 300 });
    fireEvent.pointerUp(toggle2, { pointerId: 1, clientX: 300, clientY: 300 });
    fireEvent.click(toggle2); // click ที่ตามมาหลังลาก ต้องไม่ toggle
    expect(screen.getByRole('button', { name: 'แสดงเลขที่เปิดแล้ว' })).toBeInTheDocument();
  });
});

test('snapSide ใช้จุดกลาง panel เทียบกับครึ่งจอ', () => {
  expect(snapSide(0, 100, 400)).toBe('left');
  expect(snapSide(149, 100, 400)).toBe('left');
  expect(snapSide(151, 100, 400)).toBe('right');
});

describe('โฟกัสช่องพิมพ์', () => {
  beforeEach(() => {
    fakeDb.__reset({ rooms: { room1: { revealNumbers: { '-k1': { number: 10, userName: 'Alice' } } } } });
  });
  const renderWithInput = () => render(<><input aria-label="chat" /><RevealNumbers roomId="room1" /></>);
  const toggleButton = () => screen.getByRole('button', { name: /เลขที่เปิดแล้ว/ });

  test('พับ panel ตอนโฟกัสช่องพิมพ์ แล้วกางกลับตอนเลิกโฟกัส', () => {
    renderWithInput();
    expect(toggleButton()).toHaveAttribute('aria-expanded', 'true');

    act(() => screen.getByLabelText('chat').focus());
    expect(toggleButton()).toHaveAttribute('aria-expanded', 'false');

    act(() => screen.getByLabelText('chat').blur());
    expect(toggleButton()).toHaveAttribute('aria-expanded', 'true');
  });

  test('จอ desktop ไม่พับ panel ตอนโฟกัสช่องพิมพ์', () => {
    window.matchMedia = jest.fn((query) => ({ matches: query === DESKTOP_MEDIA_QUERY }));
    try {
      renderWithInput();
      act(() => screen.getByLabelText('chat').focus());
      expect(toggleButton()).toHaveAttribute('aria-expanded', 'true');
    } finally {
      delete window.matchMedia;
    }
  });

  test('panel ที่ผู้ใช้พับไว้เองอยู่แล้วไม่ถูกกางเองตอนเลิกโฟกัส', () => {
    renderWithInput();
    act(() => toggleButton().click());
    act(() => screen.getByLabelText('chat').focus());
    act(() => screen.getByLabelText('chat').blur());
    expect(toggleButton()).toHaveAttribute('aria-expanded', 'false');
  });

  test('กดกางเองระหว่างพิมพ์ แล้วเลิกโฟกัส panel ยังกางอยู่', () => {
    renderWithInput();
    act(() => screen.getByLabelText('chat').focus());
    act(() => toggleButton().click());
    expect(toggleButton()).toHaveAttribute('aria-expanded', 'true');
    act(() => screen.getByLabelText('chat').blur());
    expect(toggleButton()).toHaveAttribute('aria-expanded', 'true');
  });
});
