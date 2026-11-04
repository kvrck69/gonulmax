// OTOMATİK ÜRETİLDİ: app/src/core/scentScore.ts dosyasından. Elle düzenleme; kaynağı değiştirip `node tools/build.mjs` çalıştır.
import { DAY_PARTS, FAMILIES, OCCASIONS, SEASONS } from './types.js';
                                                                       

/**
 * Koleksiyon skoru (0-100), plan 6. bölüm. Dört bileşenin her biri 0-25:
 *  - mevsim kapsaması : 4 mevsim x gündüz/gece = 8 hücre; kapsanan hücre sayısı / 8
 *  - çeşitlilik       : aile dağılımının normalize Shannon entropisi
 *  - çok yönlülük     : parfümlerin uygun olduğu durum etiketlerinin birleşimi / tüm etiketler
 *  - niş oranı        : niş parfüm oranı / 0,30 (en çok 1)
 * Aynı koleksiyon (sıra fark etmeksizin) her zaman aynı skoru verir.
 */
export const SCORE_VERSION = 1;
export const COMPONENT_MAX = 25;
/** Bir hücrenin kapsanması için gereken en düşük yakınlık. */
export const COVERAGE_THRESHOLD = 0.6;
/** Bu niş oranında niş bileşeni tam puan alır. */
export const NICHE_TARGET_RATIO = 0.3;
/** Bundan az parfümlü koleksiyonun skoru "geçici" sayılır. */
export const MIN_FOR_FINAL_SCORE = 3;

                                
                 
                   
 

                             
                  
                                      
                
                                              
               
                           
                      
                        
                  
    
                                               
                       
                                               
         
                                    
                                 
    
 

function round1(value        )         {
  return Math.round(value * 10) / 10;
}

function coversCell(fragrance           , season        , dayPart         )          {
  return Math.min(fragrance.seasons[season], fragrance.dayParts[dayPart]) >= COVERAGE_THRESHOLD;
}

export function scentScore(collection                      )             {
  const count = collection.length;

  // 1) Mevsim kapsaması
  const uncoveredCells                  = [];
  let covered = 0;
  for (const season of SEASONS) {
    for (const dayPart of DAY_PARTS) {
      if (collection.some((fragrance) => coversCell(fragrance, season, dayPart))) {
        covered += 1;
      } else {
        uncoveredCells.push({ season, dayPart });
      }
    }
  }
  const seasonCoverage = (covered / (SEASONS.length * DAY_PARTS.length)) * COMPONENT_MAX;

  // 2) Çeşitlilik: normalize Shannon entropisi. Normalleştirici ln(min(n, aile sayısı));
  //    küçük koleksiyon, var olmayan çeşitlilik için cezalandırılmaz. 2'den az parfümde 0.
  let diversity = 0;
  if (count >= 2) {
    const familyCounts = new Map                ();
    for (const fragrance of collection) {
      familyCounts.set(fragrance.family, (familyCounts.get(fragrance.family) ?? 0) + 1);
    }
    let entropy = 0;
    for (const familyCount of familyCounts.values()) {
      const p = familyCount / count;
      entropy -= p * Math.log(p);
    }
    const denominator = Math.log(Math.min(count, FAMILIES.length));
    diversity = Math.min(entropy / denominator, 1) * COMPONENT_MAX;
  }

  // 3) Çok yönlülük
  const occasionSet = new Set          ();
  for (const fragrance of collection) {
    for (const occasion of fragrance.occasions) occasionSet.add(occasion);
  }
  const missingOccasions = OCCASIONS.filter((occasion) => !occasionSet.has(occasion));
  const versatility = (occasionSet.size / OCCASIONS.length) * COMPONENT_MAX;

  // 4) Niş oranı
  const nicheCount = collection.filter((fragrance) => fragrance.niche).length;
  const nicheRatio = count === 0 ? 0 : nicheCount / count;
  const niche = Math.min(nicheRatio / NICHE_TARGET_RATIO, 1) * COMPONENT_MAX;

  const total = Math.round(seasonCoverage + diversity + versatility + niche);

  return {
    version: SCORE_VERSION,
    total,
    components: {
      seasonCoverage: round1(seasonCoverage),
      diversity: round1(diversity),
      versatility: round1(versatility),
      niche: round1(niche),
    },
    provisional: count < MIN_FOR_FINAL_SCORE,
    gaps: { uncoveredCells, missingOccasions },
  };
}
