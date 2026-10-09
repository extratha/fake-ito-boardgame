import { render, screen } from '@testing-library/react';
import App from './App';

jest.mock('firebase/database', () => require('./testUtils/fakeDatabase'));
jest.mock('./firebase', () => ({
  db: {},
  auth: { currentUser: { uid: 'client-me' } },
  ensureSignedIn: () => Promise.resolve('client-me'),
}));

test('sign-in เสร็จแล้วหน้าแรกแสดงฟอร์มเข้าร่วม/สร้างห้อง', async () => {
  render(<App />);
  expect(await screen.findByText('Fake Ito Board Game')).toBeInTheDocument();
  expect(screen.getByText('สร้างห้องใหม่')).toBeInTheDocument();
});
