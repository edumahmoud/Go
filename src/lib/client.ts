// Helper to generate a stable device fingerprint in the browser
export function generateDeviceId(): string {
  const parts = [
    navigator.userAgent,
    navigator.language,
    navigator.languages?.join(',') || '',
    String(screen.width),
    String(screen.height),
    String(screen.colorDepth),
    String(new Date().getTimezoneOffset()),
    // hardwareConcurrency & deviceMemory (if available)
    String((navigator as unknown as { hardwareConcurrency?: number }).hardwareConcurrency || ''),
    String((navigator as unknown as { deviceMemory?: number }).deviceMemory || ''),
  ]
  const raw = parts.join('|')
  // simple SHA-256-like hash via SubtleCrypto (async) is too cumbersome here; use a simple FNV-1a
  let h1 = 0xdeadbeef ^ raw.length
  let h2 = 0x41c6ce57 ^ raw.length
  for (let i = 0; i < raw.length; i++) {
    const ch = raw.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  const hash = (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0')
  // Pad to 64 hex chars with a stable suffix
  return (hash + hash + hash + hash).slice(0, 64)
}

export function getCurrentPosition(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('المتصفح لا يدعم تحديد الموقع'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => {
        let msg = 'تعذر الحصول على الموقع'
        switch (err.code) {
          case 1:
            msg = 'تم رفض إذن الوصول للموقع. يرجى السماح بالوصول للموقع من إعدادات المتصفح'
            break
          case 2:
            msg = 'تعذر تحديد الموقع. تأكد من تفعيل خدمة الموقع بالجهاز'
            break
          case 3:
            msg = 'انتهت مهلة تحديد الموقع. حاول مرة أخرى'
            break
        }
        reject(new Error(msg))
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    )
  })
}
