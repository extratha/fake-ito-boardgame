import Cookies from 'js-cookie';

// id ประจำเครื่อง ใช้ระบุตัวผู้เล่น/host (refresh แล้วยังเป็นคนเดิม)
export const getClientId = () => {
  let clientId = Cookies.get('clientId');
  if (!clientId) {
    clientId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    Cookies.set('clientId', clientId, { expires: 365 });
  }
  return clientId;
};
