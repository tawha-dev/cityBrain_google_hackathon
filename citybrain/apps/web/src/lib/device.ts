const DEVICE_KEY = 'citybrain_device_id';

function randomId(): string {
  return `web-${crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
}

export function getDeviceId(): string {
  if (typeof window === 'undefined') return 'web-server';
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = randomId();
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}
