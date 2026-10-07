// In-memory fake ของ firebase/database เฉพาะ API ที่แอปใช้ (สำหรับ test เท่านั้น)
let data = {};
let listeners = [];
let clock = 1000;
let pushCounter = 0;
let hooks = {};

const segments = (path) => path.split('/').filter(Boolean);
const clone = (value) => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)));
const isEmpty = (value) => value === null || value === undefined ||
  (typeof value === 'object' && Object.keys(value).length === 0);

const getAt = (path) => segments(path).reduce((node, key) => (node == null ? undefined : node[key]), data);

const resolveServerValues = (value) => {
  if (value && typeof value === 'object') {
    if (value['.sv'] === 'timestamp') return ++clock;
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolveServerValues(v)]));
  }
  return value;
};

const writeAt = (path, value) => {
  const keys = segments(path);
  const resolved = resolveServerValues(clone(value));
  if (keys.length === 0) {
    data = isEmpty(resolved) ? {} : resolved;
    return;
  }
  const parents = [data];
  let node = data;
  keys.slice(0, -1).forEach((key) => {
    if (typeof node[key] !== 'object' || node[key] === null) node[key] = {};
    node = node[key];
    parents.push(node);
  });
  const last = keys[keys.length - 1];
  if (isEmpty(resolved)) delete node[last];
  else node[last] = resolved;
  // ลบ parent ที่ว่างแบบเดียวกับ RTDB
  for (let i = keys.length - 1; i > 0; i--) {
    if (isEmpty(parents[i])) delete parents[i - 1][keys[i - 1]];
  }
};

// ลำดับ key แบบ RTDB: key ที่เป็นเลขจำนวนเต็มมาก่อน (เรียงตามค่า) แล้วตามด้วย string
const INT_KEY = /^-?(0|[1-9]\d*)$/;
const compareKeys = (a, b) => {
  const aInt = INT_KEY.test(a);
  const bInt = INT_KEY.test(b);
  if (aInt && bInt) return Number(a) - Number(b);
  if (aInt) return -1;
  if (bInt) return 1;
  return a < b ? -1 : a > b ? 1 : 0;
};

const makeSnapshot = (path, value) => ({
  key: segments(path).pop() ?? null,
  ref: { path },
  exists: () => value !== undefined && value !== null,
  val: () => (value === undefined ? null : clone(value)),
  forEach: (cb) => {
    if (!value || typeof value !== 'object') return false;
    for (const key of Object.keys(value).sort(compareKeys)) {
      if (cb(makeSnapshot(`${path}/${key}`, value[key])) === true) return true;
    }
    return false;
  },
});

const related = (a, b) => {
  const sa = segments(a);
  const sb = segments(b);
  const n = Math.min(sa.length, sb.length);
  return sa.slice(0, n).join('/') === sb.slice(0, n).join('/');
};

const notify = (changedPath) => {
  listeners
    .filter((l) => related(l.path, changedPath))
    .forEach((l) => l.cb(makeSnapshot(l.path, getAt(l.path))));
};

// ---- API เลียนแบบ firebase/database ----
export const getDatabase = () => ({});
export const ref = (_db, path = '') => ({ path });
export const serverTimestamp = () => ({ '.sv': 'timestamp' });

export const get = async (r) => makeSnapshot(r.path, getAt(r.path));

export const set = async (r, value) => {
  writeAt(r.path, value);
  notify(r.path);
};

export const remove = (r) => set(r, null);

export const update = async (r, updates) => {
  Object.entries(updates).forEach(([key, value]) => writeAt(`${r.path}/${key}`, value));
  notify(r.path);
};

export const push = (r) => ({ path: `${r.path}/-k${String(++pushCounter).padStart(6, '0')}` });

export const onValue = (r, cb) => {
  const listener = { path: r.path, cb };
  listeners.push(listener);
  cb(makeSnapshot(r.path, getAt(r.path)));
  return () => { listeners = listeners.filter((l) => l !== listener); };
};

export const runTransaction = async (r, updateFn) => {
  await hooks.beforeTransaction?.(r.path);
  const current = getAt(r.path);
  const next = updateFn(current === undefined ? null : clone(current));
  if (next === undefined) {
    return { committed: false, snapshot: makeSnapshot(r.path, getAt(r.path)) };
  }
  writeAt(r.path, next);
  notify(r.path);
  return { committed: true, snapshot: makeSnapshot(r.path, getAt(r.path)) };
};

// ---- helper สำหรับ test ----
export const __reset = (initial = {}) => {
  data = clone(initial);
  listeners = [];
  clock = 1000;
  pushCounter = 0;
  hooks = {};
};
export const __getData = (path = '') => clone(getAt(path)) ?? null;
// เขียนข้อมูลแทน "ผู้เล่นคนอื่น" แล้วแจ้ง listener
export const __write = (path, value) => { writeAt(path, value); notify(path); };
export const __setHooks = (next) => { hooks = next; };
