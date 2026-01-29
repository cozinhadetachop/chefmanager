export function safeLoad(key, fallback) {
  try {
    const data = localStorage.getItem(key);
    if (!data) return fallback;
    return JSON.parse(data);
  } catch {
    return fallback;
  }
}

export function safeSave(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}
