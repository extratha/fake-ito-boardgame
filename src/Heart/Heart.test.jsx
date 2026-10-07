import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HeartDisplay from '.';

let observerCallback;
beforeEach(() => {
  window.IntersectionObserver = jest.fn((cb) => {
    observerCallback = cb;
    return { observe: jest.fn(), disconnect: jest.fn() };
  });
});
afterEach(() => { delete window.IntersectionObserver; });

const card = () => screen.getByText('ลด 1 หัวใจ').closest('section');

test('ยังไม่ scroll ถึง (sentinel อยู่ใต้จอ) = สถานะติดขอบ, scroll ถึงแล้ว = อยู่ที่เดิม', () => {
  render(<HeartDisplay heart={2} onReduceHeart={() => {}} onResetHeart={() => {}} />);
  expect(card()).toHaveClass('heart-card');

  act(() => observerCallback([{ isIntersecting: false, boundingClientRect: { top: 1500 } }]));
  expect(card()).toHaveClass('is-stuck');

  act(() => observerCallback([{ isIntersecting: true, boundingClientRect: { top: 600 } }]));
  expect(card()).not.toHaveClass('is-stuck');

  // scroll เลยลงไปจน section อยู่เหนือจอ ก็ไม่ใช่สถานะติดขอบ
  act(() => observerCallback([{ isIntersecting: false, boundingClientRect: { top: -200 } }]));
  expect(card()).not.toHaveClass('is-stuck');
});

test('ปุ่มลด/รีหัวใจทำงาน และลดไม่ได้เมื่อหัวใจหมด', () => {
  const onReduce = jest.fn();
  const onReset = jest.fn();
  const { rerender } = render(<HeartDisplay heart={1} onReduceHeart={onReduce} onResetHeart={onReset} />);
  userEvent.click(screen.getByText('ลด 1 หัวใจ'));
  userEvent.click(screen.getByText('รีหัวใจ'));
  expect(onReduce).toHaveBeenCalledTimes(1);
  expect(onReset).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('img', { name: 'หัวใจเหลือ 1 จาก 3' })).toBeInTheDocument();

  rerender(<HeartDisplay heart={0} onReduceHeart={onReduce} onResetHeart={onReset} />);
  expect(screen.getByText('ลด 1 หัวใจ')).toBeDisabled();
});
