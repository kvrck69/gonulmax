// OTOMATİK ÜRETİLDİ: app/src/core/season.ts dosyasından. Elle düzenleme; kaynağı değiştirip `node tools/build.mjs` çalıştır.
                                                  

                                           

/** month: 1-12. Kuzey yarım kürede Aralık-Şubat kış; güneyde mevsimler ters. */
export function seasonOf(month        , hemisphere             = 'north')         {
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new RangeError(`Invalid month: ${month}`);
  }
  const shifted = hemisphere === 'north' ? month : ((month + 5) % 12) + 1;
  if (shifted === 12 || shifted <= 2) return 'winter';
  if (shifted <= 5) return 'spring';
  if (shifted <= 8) return 'summer';
  return 'autumn';
}

/** hour: 0-23 (yerel saat). 06:00-17:59 gündüz, geri kalanı gece. */
export function dayPartOf(hour        )          {
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    throw new RangeError(`Invalid hour: ${hour}`);
  }
  return hour >= 6 && hour < 18 ? 'day' : 'night';
}

                             
                                              
               
             
                
             
               
 

/** Bir anı, verilen IANA saat diliminin yerel gün/ay/saat değerlerine çevirir. */
export function localParts(instant      , timeZone        )             {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  });
  const parts                         = {};
  for (const part of formatter.formatToParts(instant)) {
    parts[part.type] = part.value;
  }
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    month: Number(parts.month),
    hour: Number(parts.hour),
  };
}
