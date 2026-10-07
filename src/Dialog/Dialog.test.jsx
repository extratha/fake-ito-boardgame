import { render, screen, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DialogHost from '.';
import { showAlert, showConfirm } from './dialogStore';

test('showConfirm แสดงกล่องที่มีหัวข้อ/ข้อความ/ปุ่มตามที่กำหนด และคืน true เมื่อกดยืนยัน', async () => {
  render(<DialogHost />);
  let result;
  act(() => { showConfirm('เลขเดิมจะหายไป', { title: 'แจกเลขใหม่?', confirmText: 'แจกใหม่' }).then((v) => { result = v; }); });

  const dialog = screen.getByRole('alertdialog', { name: 'แจกเลขใหม่?' });
  expect(dialog).toHaveAccessibleDescription('เลขเดิมจะหายไป');
  expect(screen.getByRole('button', { name: 'แจกใหม่' })).toHaveFocus();

  await act(async () => userEvent.click(screen.getByRole('button', { name: 'แจกใหม่' })));
  expect(result).toBe(true);
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
});

test('showConfirm คืน false เมื่อกดยกเลิก, กด Esc หรือแตะนอกกล่อง', async () => {
  render(<DialogHost />);
  const results = [];
  const open = () => act(() => { showConfirm('แน่ใจนะ').then((v) => results.push(v)); });

  open();
  await act(async () => userEvent.click(screen.getByRole('button', { name: 'ยกเลิก' })));
  open();
  await act(async () => { fireEvent.keyDown(screen.getByRole('alertdialog'), { key: 'Escape' }); });
  open();
  await act(async () => { fireEvent.mouseDown(screen.getByRole('alertdialog').parentElement); });

  expect(results).toEqual([false, false, false]);
});

test('showAlert มีปุ่มตกลงปุ่มเดียว และ dialog ที่เรียกซ้อนกันแสดงทีละอันตามลำดับ', async () => {
  render(<DialogHost />);
  act(() => { showAlert('อันแรก'); showAlert('อันที่สอง', { title: 'หัวข้อ' }); });

  expect(screen.getByText('อันแรก')).toBeInTheDocument();
  expect(screen.queryByText('อันที่สอง')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'ยกเลิก' })).not.toBeInTheDocument();

  await act(async () => userEvent.click(screen.getByRole('button', { name: 'ตกลง' })));
  expect(screen.getByText('อันที่สอง')).toBeInTheDocument();
  await act(async () => userEvent.click(screen.getByRole('button', { name: 'ตกลง' })));
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
});

test('Tab วน focus อยู่ในกล่องระหว่างปุ่มยกเลิก/ยืนยัน', () => {
  render(<DialogHost />);
  act(() => { showConfirm('ทดสอบ'); });
  const dialog = screen.getByRole('alertdialog');

  fireEvent.keyDown(dialog, { key: 'Tab' });
  expect(screen.getByRole('button', { name: 'ยกเลิก' })).toHaveFocus();
  fireEvent.keyDown(dialog, { key: 'Tab' });
  expect(screen.getByRole('button', { name: 'ยืนยัน' })).toHaveFocus();
  act(() => fireEvent.keyDown(dialog, { key: 'Escape' }));
});
