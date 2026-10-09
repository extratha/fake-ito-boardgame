import { render, screen, within } from '@testing-library/react';
import PlayerList, { visiblePlayers } from '.';

test('ซ่อนรายการออฟไลน์ที่ชื่อซ้ำกับคนที่ออนไลน์ (คนเดิมได้ id ใหม่) และชื่อออฟไลน์ที่ซ้ำกันเอง', () => {
  const players = [
    { id: 'old-ss', name: 'ss', online: false, joinedAt: 1 },
    { id: 'new-ss', name: 'ss', online: true, joinedAt: 5 },
    { id: 'er', name: 'er', online: true, joinedAt: 2 },
    { id: 'bob1', name: 'Bob', online: false, joinedAt: 3 },
    { id: 'bob2', name: 'Bob', online: false, joinedAt: 4 },
  ];
  expect(visiblePlayers(players).map((p) => p.id)).toEqual(['er', 'new-ss', 'bob1']);
});

test('แสดงรายชื่อที่ไม่ซ้ำ พร้อมนับเฉพาะคนออนไลน์', () => {
  render(
    <PlayerList
      players={[
        { id: 'old-ss', name: 'ss', online: false, joinedAt: 1 },
        { id: 'new-ss', name: 'ss', online: true, joinedAt: 5 },
      ]}
      hostId="new-ss"
      clientId="new-ss"
      dealtOwners={new Set()}
    />,
  );
  expect(screen.getByText('ผู้เล่น 1 คน')).toBeInTheDocument();
  expect(within(screen.getByRole('list')).getAllByRole('listitem')).toHaveLength(1);
  expect(screen.queryByText('ออฟไลน์')).not.toBeInTheDocument();
});
