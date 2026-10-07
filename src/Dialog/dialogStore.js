// คิว dialog กลางของแอป แทน window.alert / window.confirm
// เรียกได้จากทุกที่ (รวมถึง utils นอก React) และได้ Promise คืนมา
let queue = [];
let nextId = 1;
const listeners = new Set();

const emit = () => listeners.forEach((listener) => listener(queue));

export const subscribeDialogs = (listener) => {
  listeners.add(listener);
  listener(queue);
  return () => listeners.delete(listener);
};

export const resolveDialog = (id, value) => {
  const dialog = queue.find((item) => item.id === id);
  if (!dialog) return;
  queue = queue.filter((item) => item.id !== id);
  emit();
  dialog.resolve(value);
};

const showDialog = (options) => new Promise((resolve) => {
  queue = [...queue, { ...options, id: nextId++, resolve }];
  emit();
});

// options: { title, confirmText, tone: 'primary' | 'danger' }
export const showAlert = (message, options = {}) =>
  showDialog({ type: 'alert', message, confirmText: 'ตกลง', ...options }).then(() => undefined);

// คืน true เมื่อกดยืนยัน, false เมื่อยกเลิก/กด Esc/แตะนอกกล่อง
export const showConfirm = (message, options = {}) =>
  showDialog({ type: 'confirm', message, confirmText: 'ยืนยัน', cancelText: 'ยกเลิก', ...options });
