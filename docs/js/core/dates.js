// OTOMATİK ÜRETİLDİ: app/src/core/dates.ts dosyasından. Elle düzenleme; kaynağı değiştirip `node tools/build.mjs` çalıştır.
// "YYYY-MM-DD" biçimindeki yerel gün metinleri için küçük, saat dilimi bağımsız tarih işlemleri.
// Tüm hesap UTC gün numarası üzerinden yapılır; yaz/kış saati sonuçları etkilemez.

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

/** "YYYY-MM-DD" -> 1970-01-01'den beri geçen gün sayısı. Geçersiz tarihte RangeError atar. */
export function parseIsoDate(value        )         {
  const match = ISO_DATE.exec(value);
  if (!match) throw new RangeError(`Invalid date: ${value}`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const ms = Date.UTC(year, month - 1, day);
  const check = new Date(ms);
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    throw new RangeError(`Invalid date: ${value}`);
  }
  return ms / MS_PER_DAY;
}

function pad(value        , width        )         {
  return String(value).padStart(width, '0');
}

/** Gün numarası -> "YYYY-MM-DD" */
export function formatIsoDate(dayNumber        )         {
  const date = new Date(dayNumber * MS_PER_DAY);
  return `${pad(date.getUTCFullYear(), 4)}-${pad(date.getUTCMonth() + 1, 2)}-${pad(date.getUTCDate(), 2)}`;
}

export function addDays(date        , delta        )         {
  return formatIsoDate(parseIsoDate(date) + delta);
}

/** `to` - `from`, gün olarak (to daha sonraysa pozitif). */
export function daysBetween(from        , to        )         {
  return parseIsoDate(to) - parseIsoDate(from);
}
