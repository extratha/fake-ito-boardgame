const CrownIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M3 7l4.5 4L12 4l4.5 7L21 7l-2 12H5L3 7z" />
  </svg>
);

// คนเดิมที่ได้ id ใหม่ (ล้างข้อมูล browser / เปลี่ยนเครื่อง) จะเหลือรายการเก่าค้างเป็นออฟไลน์
// ซ่อนรายการออฟไลน์ที่ชื่อซ้ำกับคนที่ออนไลน์อยู่ หรือซ้ำกับรายการออฟไลน์ที่แสดงไปแล้ว
export const visiblePlayers = (players) => {
  const sorted = [...players].sort((a, b) =>
    (b.online === true) - (a.online === true) || (a.joinedAt ?? Infinity) - (b.joinedAt ?? Infinity));
  const shownNames = new Set(sorted.filter((p) => p.online === true).map((p) => p.name));
  return sorted.filter((player) => {
    if (player.online === true) return true;
    if (shownNames.has(player.name)) return false;
    shownNames.add(player.name);
    return true;
  });
};

const PlayerList = ({ players, hostId, clientId, dealtOwners }) => {
  const sorted = visiblePlayers(players);

  return (
    <section className="card player-card">
      <h2 className="card-title">ผู้เล่น {players.filter((p) => p.online).length} คน</h2>
      <ul className="player-list">
        {sorted.map((player) => (
          <li key={player.id} className={`player ${player.online ? '' : 'is-offline'}`}>
            <span className={`player-dot ${player.online ? 'is-online' : ''}`} aria-hidden="true" />
            <span className="player-name">
              {player.name}
              {player.id === clientId && <span className="player-you"> (คุณ)</span>}
            </span>
            {player.id === hostId && <span className="host-tag"><CrownIcon />host</span>}
            {dealtOwners.size > 0 && !dealtOwners.has(player.id) && player.online && (
              <span className="player-waiting">รอรอบหน้า</span>
            )}
            {!player.online && <span className="player-waiting">ออฟไลน์</span>}
          </li>
        ))}
      </ul>
    </section>
  );
};

export { CrownIcon };
export default PlayerList;
