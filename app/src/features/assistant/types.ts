// AI asistan YER TUTUCUSU. Faz 3 ertelendi (bkz. PROGRESS.md). Bu arayüz, asistan sonradan
// eklendiğinde arayüzün geri kalanını değiştirmek gerekmesin diye şimdiden sabitlenmiştir.
//
// Gerçek uygulama (Faz 3'te): Supabase Edge Function `assistant-chat`. API anahtarı yalnızca orada durur;
// tarayıcı bu fonksiyonu çağırır. Günlük mesaj limiti sunucuda sayılır (değer henüz belirlenmedi).
// Öneri kuralı: model yalnızca katalog id'siyle parfüm önerebilir; katalogda olmayan id gösterilmez.

export interface AssistantMessage {
  role: 'user' | 'assistant';
  content: string;
  /** Asistanın önerdiği parfümler: yalnızca katalogda doğrulanmış id'ler. */
  fragranceIds?: readonly string[];
}

export interface AssistantReply {
  message: AssistantMessage;
  /** Bugün kalan mesaj hakkı; sınırsızsa null. */
  remainingToday: number | null;
}

export type AssistantErrorCode = 'disabled' | 'limit_reached' | 'network' | 'unknown';

export interface AssistantClient {
  readonly enabled: boolean;
  send(history: readonly AssistantMessage[]): Promise<AssistantReply>;
}

export class AssistantError extends Error {
  readonly code: AssistantErrorCode;
  constructor(code: AssistantErrorCode, message: string) {
    super(message);
    this.name = 'AssistantError';
    this.code = code;
  }
}

/** Asistan kapalıyken kullanılan istemci: her çağrıda net bir "kapalı" hatası verir. */
export const disabledAssistant: AssistantClient = {
  enabled: false,
  send() {
    return Promise.reject(new AssistantError('disabled', 'Assistant is not enabled yet.'));
  },
};
