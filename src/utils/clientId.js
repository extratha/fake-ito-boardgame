import { auth } from '../firebase';

// uid จาก Firebase Anonymous Auth ใช้ระบุตัวผู้เล่น/host (refresh แล้วยังเป็นคนเดิม)
// App รอ sign-in เสร็จ (AuthGate) ก่อน render หน้าต่าง ๆ จึงมีค่าเสมอเมื่อหน้าเรียกใช้
// database rules ตรวจ id นี้กับ auth.uid ของคนที่เขียน
export const getClientId = () => auth.currentUser?.uid ?? null;
