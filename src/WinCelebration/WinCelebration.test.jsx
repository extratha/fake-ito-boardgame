import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WinCelebration, { WIN_BANNER_MS } from '.';

afterEach(() => jest.useRealTimers());

test('ไม่ชนะ: ไม่แสดงอะไร', () => {
  const { container } = render(<WinCelebration active={false} />);
  expect(container).toBeEmptyDOMElement();
});

test('ชนะ: ขอบรุ้งค้างไว้ ป้ายผ่านหมดหายเองตามเวลา', () => {
  jest.useFakeTimers();
  const { container } = render(<WinCelebration active />);
  expect(screen.getByText('ผ่านหมด!')).toBeInTheDocument();
  expect(container.querySelectorAll('.win-border')).toHaveLength(1);

  act(() => jest.advanceTimersByTime(WIN_BANNER_MS));
  expect(screen.queryByText('ผ่านหมด!')).not.toBeInTheDocument();
  expect(container.querySelectorAll('.win-border')).toHaveLength(1);
});

test('กดปิดป้ายได้ และเริ่มรอบใหม่แล้วขอบรุ้งหายไป', () => {
  const { container, rerender } = render(<WinCelebration active />);
  userEvent.click(screen.getByRole('button', { name: 'ปิด' }));
  expect(screen.queryByText('ผ่านหมด!')).not.toBeInTheDocument();

  rerender(<WinCelebration active={false} />);
  expect(container.querySelector('.win-border')).toBeNull();
});
