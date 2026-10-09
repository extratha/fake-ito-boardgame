const fs = require('fs');
const path = require('path');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { ref, get, set, update, remove, onValue, runTransaction, serverTimestamp } = require('firebase/database');

const DAY = 24 * 60 * 60 * 1000;
const ROOM = 'rooms/R001';
const HOST = 'host-uid';
const ALICE = 'alice-uid';
const BOB = 'bob-uid';

let testEnv;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-ito',
    database: {
      rules: fs.readFileSync(path.join(__dirname, '..', 'database.rules.json'), 'utf8'),
      host: '127.0.0.1',
      port: 9000,
    },
  });
});

afterAll(() => testEnv.cleanup());

beforeEach(() => testEnv.clearDatabase());

const seed = (data) => testEnv.withSecurityRulesDisabled((ctx) => set(ref(ctx.database()), data));
const dbAs = (uid) => testEnv.authenticatedContext(uid).database();
const anonDb = () => testEnv.unauthenticatedContext().database();

const player = (name, online = true) => ({ name, online, joinedAt: 1, lastSeen: 1 });

// ห้องปกติ: HOST เป็น host, ALICE อยู่ในห้อง, BOB เป็นคนนอก (ยังไม่ได้ลงชื่อในห้อง)
const seedRoom = (room = {}, extra = {}) => seed({
  rooms: {
    R001: {
      host: 'Host', hostId: HOST, heart: 3, createdAt: Date.now(),
      players: { [HOST]: player('Host'), [ALICE]: player('Alice') },
      ...room,
    },
  },
  roomIndex: { R001: { createdAt: Date.now(), lastSeen: Date.now(), hostName: 'Host', online: { [HOST]: 'Host', [ALICE]: 'Alice' } } },
  ...extra,
});

describe('การอ่าน', () => {
  test('ยังไม่ sign-in อ่านห้องไม่ได้', async () => {
    await seedRoom();
    await assertFails(get(ref(anonDb(), ROOM)));
  });

  test('sign-in แล้วอ่านห้องที่รู้รหัสได้ แต่อ่าน rooms ทั้งก้อนไม่ได้', async () => {
    await seedRoom();
    await assertSucceeds(get(ref(dbAs(BOB), ROOM)));
    await assertFails(get(ref(dbAs(BOB), 'rooms')));
    await assertSucceeds(get(ref(dbAs(BOB), 'roomIndex')));
  });

  test('เลขในมืออ่านได้เฉพาะเจ้าของ (host และคนอื่นอ่านไม่ได้)', async () => {
    await seedRoom({}, { hands: { R001: { [ALICE]: { 42: true }, [HOST]: { 7: true } } } });
    await assertSucceeds(get(ref(dbAs(ALICE), `hands/R001/${ALICE}`)));
    await assertFails(get(ref(dbAs(ALICE), `hands/R001/${HOST}`)));
    await assertFails(get(ref(dbAs(HOST), `hands/R001/${ALICE}`)));
    await assertFails(get(ref(dbAs(ALICE), 'hands/R001')));
  });
});

describe('สร้าง/ลบห้อง', () => {
  const newRoom = (hostId) => ({
    'rooms/NEW1': { host: 'Me', hostId, heart: 3, settings: { numbersPerPlayer: 1 }, createdAt: serverTimestamp() },
    'roomIndex/NEW1': { createdAt: serverTimestamp(), lastSeen: serverTimestamp(), hostName: 'Me' },
  });

  test('สร้างห้องโดยตั้งตัวเองเป็น host ได้', async () => {
    await assertSucceeds(update(ref(dbAs(ALICE)), newRoom(ALICE)));
  });

  test('สร้างห้องให้คนอื่นเป็น host ไม่ได้ / ยังไม่ sign-in สร้างไม่ได้', async () => {
    await assertFails(update(ref(dbAs(ALICE)), newRoom(BOB)));
    await assertFails(update(ref(anonDb()), newRoom('x')));
  });

  test('เขียนทับห้องที่มีอยู่แล้วทั้งก้อนไม่ได้', async () => {
    await seedRoom();
    await assertFails(set(ref(dbAs(BOB), ROOM), { host: 'Bob', hostId: BOB, createdAt: Date.now() }));
  });

  const deleteUpdates = { [ROOM]: null, 'roomIndex/R001': null, 'hands/R001': null };

  test('คนทั่วไปลบห้องที่ยังเล่นอยู่ไม่ได้ (รวมคนในห้อง)', async () => {
    await seedRoom();
    await assertFails(update(ref(dbAs(BOB)), deleteUpdates));
    await assertFails(update(ref(dbAs(ALICE)), deleteUpdates));
  });

  test('host ลบห้องตัวเองได้', async () => {
    await seedRoom({}, { hands: { R001: { [ALICE]: { 42: true } } } });
    await assertSucceeds(update(ref(dbAs(HOST)), deleteUpdates));
  });

  test('cleanup: ใครก็ลบห้องที่อายุเกิน 1 วันได้', async () => {
    await seedRoom({ createdAt: Date.now() - 2 * DAY }, { hands: { R001: { [ALICE]: { 42: true } } } });
    await testEnv.withSecurityRulesDisabled((ctx) => set(ref(ctx.database(), 'roomIndex/R001/createdAt'), Date.now() - 2 * DAY));
    await assertSucceeds(update(ref(dbAs(BOB)), deleteUpdates));
  });

  test('cleanup: ห้องที่ไม่มีใครออนไลน์เกิน 10 นาทีลบได้ แต่ถ้ายังมีคนออนไลน์ลบไม่ได้', async () => {
    const idle = Date.now() - 11 * 60 * 1000;
    await seedRoom();
    await testEnv.withSecurityRulesDisabled((ctx) => set(ref(ctx.database(), 'roomIndex/R001'), { createdAt: idle, lastSeen: idle, online: { [ALICE]: 'Alice' } }));
    await assertFails(update(ref(dbAs(BOB)), deleteUpdates));

    await testEnv.withSecurityRulesDisabled((ctx) => remove(ref(ctx.database(), 'roomIndex/R001/online')));
    await assertSucceeds(update(ref(dbAs(BOB)), deleteUpdates));
  });
});

describe('host', () => {
  test('คนในห้องแก้ host / hostId ตรง ๆ ไม่ได้ขณะ host ยังออนไลน์', async () => {
    await seedRoom();
    await assertFails(set(ref(dbAs(ALICE), `${ROOM}/hostId`), ALICE));
    await assertFails(set(ref(dbAs(ALICE), `${ROOM}/host`), 'Alice'));
  });

  test('host ออฟไลน์: รับ host เป็นตัวเองได้ (ตาม useHost) แล้วค่อยแก้ชื่อ host', async () => {
    await seedRoom({ players: { [HOST]: player('Host', false), [ALICE]: player('Alice') } });
    const db = dbAs(ALICE);
    // useHost ฟัง hostId อยู่ตลอด transaction จึงเห็นค่าปัจจุบันตั้งแต่รอบแรก
    const unsubscribe = onValue(ref(db, `${ROOM}/hostId`), () => {});
    await get(ref(db, `${ROOM}/hostId`));
    const result = await assertSucceeds(runTransaction(ref(db, `${ROOM}/hostId`), (current) => (current === HOST ? ALICE : undefined)));
    unsubscribe();
    expect(result.committed).toBe(true);
    await assertSucceeds(update(ref(db), { [`${ROOM}/host`]: 'Alice', 'roomIndex/R001/hostName': 'Alice' }));
  });

  test('ตั้ง host เป็นคนอื่นไม่ได้แม้ host เดิมออฟไลน์', async () => {
    await seedRoom({ players: { [HOST]: player('Host', false), [ALICE]: player('Alice') } });
    await assertFails(set(ref(dbAs(ALICE), `${ROOM}/hostId`), BOB));
  });

  test('ห้องเก่าที่ไม่มี hostId: รับ host ได้', async () => {
    await seedRoom({ hostId: null });
    await assertSucceeds(set(ref(dbAs(ALICE), `${ROOM}/hostId`), ALICE));
  });
});

describe('สิทธิ์ของ host: แจกเลข / หัวข้อ / ตั้งค่า', () => {
  const dealUpdates = {
    'hands/R001': { [HOST]: { 10: true }, [ALICE]: { 42: true } },
    [`${ROOM}/dealt`]: { [HOST]: 1, [ALICE]: 1 },
    [`${ROOM}/numbers`]: null,
    [`${ROOM}/revealNumbers`]: null,
    [`${ROOM}/taunt`]: null,
  };

  test('host แจกเลขได้ (multi-path update ครั้งเดียว)', async () => {
    await seedRoom({ numbers: { 5: { owner: ALICE } } });
    await assertSucceeds(update(ref(dbAs(HOST)), dealUpdates));
  });

  test('คนที่ไม่ใช่ host แจกเลข / แก้เลขในมือตัวเองไม่ได้', async () => {
    await seedRoom();
    await assertFails(update(ref(dbAs(ALICE)), dealUpdates));
    await assertFails(set(ref(dbAs(ALICE), `hands/R001/${ALICE}/99`), true));
    await assertFails(set(ref(dbAs(ALICE), `${ROOM}/dealt/${ALICE}`), 3));
  });

  test('เขียนเลขรูปแบบเก่า (rooms/.../numbers ที่ทุกคนอ่านได้) ไม่ได้แม้เป็น host', async () => {
    await seedRoom();
    await assertFails(set(ref(dbAs(HOST), `${ROOM}/numbers/5`), { owner: ALICE }));
  });

  test('หัวข้อและการตั้งค่า: host เท่านั้น', async () => {
    await seedRoom();
    const topic = { topic: 'ของกิน', createdAt: serverTimestamp() };
    await assertSucceeds(set(ref(dbAs(HOST), `${ROOM}/topic/-t1`), topic));
    await assertFails(set(ref(dbAs(ALICE), `${ROOM}/topic/-t2`), topic));
    await assertFails(remove(ref(dbAs(ALICE), `${ROOM}/topic`)));
    await assertSucceeds(set(ref(dbAs(HOST), `${ROOM}/settings/numbersPerPlayer`), 3));
    await assertFails(set(ref(dbAs(ALICE), `${ROOM}/settings/numbersPerPlayer`), 2));
  });
});

describe('เปิดเลข', () => {
  const revealData = (uid) => ({ userName: 'Alice', uid, createdAt: serverTimestamp() });
  const seedDealt = (room = {}) => seedRoom(room, { hands: { R001: { [ALICE]: { 42: true }, [HOST]: { 10: true } } } });

  test('เปิดเลขที่อยู่ในมือตัวเองได้', async () => {
    await seedDealt();
    await assertSucceeds(set(ref(dbAs(ALICE), `${ROOM}/revealNumbers/42`), revealData(ALICE)));
  });

  test('เปิดเลขที่ไม่ได้อยู่ในมือ / เปิดในนามคนอื่น ไม่ได้', async () => {
    await seedDealt();
    await assertFails(set(ref(dbAs(ALICE), `${ROOM}/revealNumbers/10`), revealData(ALICE)));
    await assertFails(set(ref(dbAs(ALICE), `${ROOM}/revealNumbers/42`), revealData(HOST)));
  });

  test('เปิดซ้ำ / แก้ / ลบเลขที่เปิดแล้วไม่ได้ แต่ host ล้างทั้งรอบได้', async () => {
    await seedDealt({ revealNumbers: { 42: { userName: 'Alice', uid: ALICE, createdAt: 1 } } });
    await assertFails(set(ref(dbAs(ALICE), `${ROOM}/revealNumbers/42`), revealData(ALICE)));
    await assertFails(remove(ref(dbAs(ALICE), `${ROOM}/revealNumbers/42`)));
    await assertFails(remove(ref(dbAs(ALICE), `${ROOM}/revealNumbers`)));
    await assertSucceeds(remove(ref(dbAs(HOST), `${ROOM}/revealNumbers`)));
  });
});

describe('ผู้เล่น / presence', () => {
  test('ลงชื่อ/แก้สถานะของตัวเองได้ ของคนอื่นไม่ได้', async () => {
    await seedRoom();
    await assertSucceeds(update(ref(dbAs(BOB), `${ROOM}/players/${BOB}`), { name: 'Bob', online: true, lastSeen: serverTimestamp() }));
    await assertSucceeds(set(ref(dbAs(BOB), `roomIndex/R001/online/${BOB}`), 'Bob'));
    await assertSucceeds(set(ref(dbAs(BOB), 'roomIndex/R001/lastSeen'), serverTimestamp()));
    await assertFails(update(ref(dbAs(BOB), `${ROOM}/players/${ALICE}`), { online: false }));
    await assertFails(set(ref(dbAs(BOB), `roomIndex/R001/online/${ALICE}`), 'x'));
  });

  test('ลงชื่อในห้องที่ไม่มีอยู่ไม่ได้ (กันห้องผี)', async () => {
    await assertFails(update(ref(dbAs(BOB), `rooms/GHOST/players/${BOB}`), { name: 'Bob', online: true }));
    await assertFails(set(ref(dbAs(BOB), 'roomIndex/GHOST/lastSeen'), serverTimestamp()));
  });

  test('ชื่อ host ใน lobby แก้ได้เฉพาะ host', async () => {
    await seedRoom();
    await assertFails(set(ref(dbAs(ALICE), 'roomIndex/R001/hostName'), 'Alice'));
    await assertSucceeds(set(ref(dbAs(HOST), 'roomIndex/R001/hostName'), 'Host2'));
  });
});

describe('หัวใจ / ข้อความแซว / แชท', () => {
  test('คนในห้องลด/รีหัวใจได้ คนนอกไม่ได้', async () => {
    await seedRoom();
    await assertSucceeds(runTransaction(ref(dbAs(ALICE), `${ROOM}/heart`), (h) => (h ?? 3) - 1));
    await assertFails(set(ref(dbAs(BOB), `${ROOM}/heart`), 0));
    await assertFails(set(ref(dbAs(ALICE), `${ROOM}/heart`), 5));
  });

  test('คนในห้องเขียนข้อความแซวได้ คนนอกไม่ได้', async () => {
    await seedRoom();
    await assertSucceeds(set(ref(dbAs(ALICE), `${ROOM}/taunt`), { id: 't1', index: 2 }));
    await assertFails(set(ref(dbAs(BOB), `${ROOM}/taunt`), { id: 't2', index: 1 }));
  });

  test('แชท: ส่งในนามตัวเองได้ ในนามคนอื่น/แก้ข้อความไม่ได้ ลบข้อความเก่าได้', async () => {
    await seedRoom({ chat: { '-old': { clientId: HOST, userName: 'Host', text: 'hi', createdAt: 1 } } });
    const msg = (clientId) => ({ clientId, userName: 'Alice', text: 'สวัสดี', createdAt: serverTimestamp() });
    await assertSucceeds(update(ref(dbAs(ALICE), `${ROOM}/chat`), { '-new': msg(ALICE), '-old': null }));
    await assertFails(set(ref(dbAs(ALICE), `${ROOM}/chat/-fake`), msg(HOST)));
    await assertFails(set(ref(dbAs(ALICE), `${ROOM}/chat/-new`), msg(ALICE)));
    await assertFails(set(ref(dbAs(BOB), `${ROOM}/chat/-bob`), msg(BOB)));
  });
});
