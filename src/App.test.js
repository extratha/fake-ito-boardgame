import { render, screen } from '@testing-library/react';
import App from './App';

jest.mock('firebase/database', () => require('./testUtils/fakeDatabase'));
jest.mock('./firebase', () => ({ db: {} }));

test('หน้าแรกแสดงฟอร์มเข้าร่วม/สร้างห้อง', () => {
  render(<App />);
  expect(screen.getByText('Fake Ito Board Game')).toBeInTheDocument();
  expect(screen.getByText('สร้างห้องใหม่')).toBeInTheDocument();
});
