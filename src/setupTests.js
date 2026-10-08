// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// react-router v7 ต้องใช้ TextEncoder ซึ่ง jsdom ของ jest 27 ไม่มี
import { TextEncoder, TextDecoder } from 'util';
Object.assign(global, { TextEncoder, TextDecoder });

// jsdom ของ jest 27 ไม่มี Web Crypto (ใช้สุ่มรหัสห้อง)
if (!global.crypto?.getRandomValues) {
  Object.defineProperty(global, 'crypto', { value: require('crypto').webcrypto });
}

// jsdom ไม่มี PointerEvent (ใช้ทดสอบการลาก reveal panel)
if (typeof window.PointerEvent === 'undefined') {
  class PointerEvent extends MouseEvent {
    constructor(type, init = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 1;
    }
  }
  window.PointerEvent = PointerEvent;
}
