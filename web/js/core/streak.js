// OTOMATİK ÜRETİLDİ: app/src/core/streak.ts dosyasından. Elle düzenleme; kaynağı değiştirip `node tools/build.mjs` çalıştır.
import { addDays, parseIsoDate } from './dates.js';

                               
                                                                                                 
                  
                                                   
                  
 

/** Kayıt tarihlerini ("YYYY-MM-DD", kullanıcının yerel günü) sıralı ve tekil hale getirir. */
function uniqueSorted(dates                   )           {
  // parseIsoDate geçersiz tarihte RangeError atar; tek elemanlı dizide bile bozuk veri sessizce geçmez.
  for (const date of dates) parseIsoDate(date);
  const unique = Array.from(new Set(dates));
  return unique.sort((a, b) => parseIsoDate(a) - parseIsoDate(b));
}

export function wearStreak(dates                   , today        )               {
  parseIsoDate(today);
  const days = uniqueSorted(dates);
  if (days.length === 0) return { current: 0, longest: 0 };

  let longest = 1;
  let run = 1;
  for (let i = 1; i < days.length; i += 1) {
    run = parseIsoDate(days[i]) - parseIsoDate(days[i - 1]) === 1 ? run + 1 : 1;
    if (run > longest) longest = run;
  }

  const logged = new Set(days);
  const yesterday = addDays(today, -1);
  let cursor                = logged.has(today) ? today : logged.has(yesterday) ? yesterday : null;
  let current = 0;
  while (cursor !== null && logged.has(cursor)) {
    current += 1;
    cursor = addDays(cursor, -1);
  }

  return { current, longest };
}

/** Isı haritası için: gün -> o gün kaç parfüm giyildi. */
export function wearCountsByDate(dates                   )                         {
  const counts                         = {};
  for (const date of dates) {
    parseIsoDate(date);
    counts[date] = (counts[date] ?? 0) + 1;
  }
  return counts;
}
