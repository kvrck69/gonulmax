-- Gönülmax – ilk şema. Supabase (Postgres) için yazıldı.
-- DURUM: Yazıldı ama HENÜZ ÇALIŞTIRILMADI (bu ortamda Postgres sunucusu yok).
-- Supabase SQL Editor'de veya `supabase db push` ile çalıştırıp hata çıkarsa PROGRESS.md'ye not düş.
--
-- Güvenlik ilkesi: tüm tablolarda RLS açık. İstemci (anon anahtar) yalnızca kendi satırlarını görür/yazar.
-- Katalog ve davet kodları yalnızca service_role (sunucu / SQL Editor) ile yazılır.

create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- Türkçe karakterli arama için yardımcı fonksiyon (İ/ı/I -> i, ş->s, ğ->g, ü->u, ö->o, ç->c)
-- ---------------------------------------------------------------------------
create or replace function public.normalize_search(input text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select lower(extensions.unaccent('extensions.unaccent'::regdictionary, translate(coalesce(input, ''), 'İIı', 'iii')));
$$;

-- ---------------------------------------------------------------------------
-- Katalog
-- ---------------------------------------------------------------------------
create table public.fragrances (
  id            uuid primary key default gen_random_uuid(),
  brand         text not null check (length(brand) between 1 and 120),
  name          text not null check (length(name) between 1 and 160),
  year          smallint check (year between 1700 and 2100),
  family        text not null check (family in
                  ('citrus','aquatic','green','aromatic','floral','woody','chypre','leather','oriental','gourmand')),
  niche         boolean not null default false,
  notes_top     text[] not null default '{}',
  notes_heart   text[] not null default '{}',
  notes_base    text[] not null default '{}',
  -- Yakınlık değerleri 0-1 (src/core/types.ts ile aynı)
  season_winter numeric(3,2) not null check (season_winter between 0 and 1),
  season_spring numeric(3,2) not null check (season_spring between 0 and 1),
  season_summer numeric(3,2) not null check (season_summer between 0 and 1),
  season_autumn numeric(3,2) not null check (season_autumn between 0 and 1),
  part_day      numeric(3,2) not null check (part_day between 0 and 1),
  part_night    numeric(3,2) not null check (part_night between 0 and 1),
  intensity     smallint not null check (intensity between 1 and 5),
  occasions     text[] not null default '{}'
                  check (occasions <@ array['office','casual','sport','date','night_out','formal']),
  -- Veri kaynağı izlenebilirliği: kazıma yok, her kayıt elle/küratörlü
  source        text not null default 'curated',
  reviewed      boolean not null default false,
  search_text   text generated always as (public.normalize_search(brand || ' ' || name)) stored,
  created_at    timestamptz not null default now(),
  unique (brand, name)
);
create index fragrances_search_trgm on public.fragrances using gin (search_text extensions.gin_trgm_ops);

alter table public.fragrances enable row level security;
create policy fragrances_read on public.fragrances
  for select to authenticated using (true);
-- Yazma politikası yok: yalnızca service_role (RLS'yi atlar) katalogu değiştirebilir.

-- ---------------------------------------------------------------------------
-- Davet kodları
-- ---------------------------------------------------------------------------
create table public.invites (
  code        text primary key check (code ~ '^[A-Z0-9]{8}$'),
  created_by  uuid references auth.users (id) on delete set null,
  used_by     uuid,            -- FK yok: kayıt sırasında kullanıcı satırı henüz yok
  used_at     timestamptz,
  expires_at  timestamptz not null default (now() + interval '14 days'),
  created_at  timestamptz not null default now()
);
alter table public.invites enable row level security;
create policy invites_read_own on public.invites
  for select to authenticated using (created_by = auth.uid());
-- İstemci invites tablosuna doğrudan yazamaz; create_invite() kullanır.

-- ---------------------------------------------------------------------------
-- Profil
-- ---------------------------------------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '' check (length(display_name) <= 60),
  city         text check (length(city) <= 120),
  latitude     numeric(5,2),   -- yaklaşık konum: 2 ondalık (~1 km)
  longitude    numeric(5,2),
  time_zone    text not null default 'Europe/Istanbul',
  locale       text not null default 'tr' check (locale in ('tr','en')),
  taste        jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy profiles_own_select on public.profiles for select to authenticated using (id = auth.uid());
create policy profiles_own_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
-- insert/delete istemciden yok: profil kayıt tetikleyicisi oluşturur, hesap silinince cascade ile gider.

-- ---------------------------------------------------------------------------
-- Koleksiyon, giyme kayıtları, skor ve günlük seçim önbelleği
-- ---------------------------------------------------------------------------
create table public.user_fragrances (
  user_id      uuid not null references auth.users (id) on delete cascade,
  fragrance_id uuid not null references public.fragrances (id) on delete cascade,
  status       text not null check (status in ('owned','wishlist')),
  added_at     timestamptz not null default now(),
  primary key (user_id, fragrance_id)
);
alter table public.user_fragrances enable row level security;
create policy uf_own_all on public.user_fragrances for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create table public.wears (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  fragrance_id uuid not null references public.fragrances (id) on delete cascade,
  wear_date    date not null,   -- kullanıcının YEREL günü (istemci hesaplar, src/core/season.ts localParts)
  note         text check (length(note) <= 500),
  created_at   timestamptz not null default now(),
  -- Çift dokunma koruması: aynı gün aynı parfüm tek kayıt. Aynı gün farklı parfümler serbest.
  unique (user_id, fragrance_id, wear_date)
);
create index wears_user_date on public.wears (user_id, wear_date desc);
alter table public.wears enable row level security;
create policy wears_own_all on public.wears for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create table public.score_snapshots (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  computed_at   timestamptz not null default now(),
  version       smallint not null,
  total         smallint not null check (total between 0 and 100),
  season_coverage numeric(4,1) not null,
  diversity       numeric(4,1) not null,
  versatility     numeric(4,1) not null,
  niche           numeric(4,1) not null,
  provisional     boolean not null
);
create index score_snapshots_user on public.score_snapshots (user_id, computed_at desc);
alter table public.score_snapshots enable row level security;
create policy ss_own_all on public.score_snapshots for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create table public.daily_picks (
  user_id     uuid not null references auth.users (id) on delete cascade,
  pick_date   date not null,
  fragrance_ids uuid[] not null,
  weather     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  primary key (user_id, pick_date)
);
alter table public.daily_picks enable row level security;
create policy dp_own_all on public.daily_picks for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Davet koduyla kayıt (sunucu tarafında zorunlu)
-- İstemci: supabase.auth.signUp({ email, password, options: { data: { invite_code: 'ABCD1234' } } })
-- ---------------------------------------------------------------------------
create or replace function public.check_invite_before_signup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  supplied text := upper(coalesce(new.raw_user_meta_data ->> 'invite_code', ''));
begin
  if not exists (
    select 1 from public.invites
    where code = supplied and used_by is null and expires_at > now()
  ) then
    raise exception 'invalid_invite_code' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create or replace function public.finish_signup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  supplied text := upper(coalesce(new.raw_user_meta_data ->> 'invite_code', ''));
  consumed int;
begin
  update public.invites
     set used_by = new.id, used_at = now()
   where code = supplied and used_by is null and expires_at > now();
  get diagnostics consumed = row_count;
  if consumed = 0 then
    -- Aynı kodla eşzamanlı ikinci kayıt: işlem geri alınır.
    raise exception 'invalid_invite_code' using errcode = 'P0001';
  end if;

  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_before_insert
  before insert on auth.users
  for each row execute function public.check_invite_before_signup();

create trigger on_auth_user_after_insert
  after insert on auth.users
  for each row execute function public.finish_signup();

-- Kayıtlı kullanıcı kendi davet kodunu üretir (en çok 5 kullanılmamış kod).
create or replace function public.create_invite()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  open_count int;
  new_code text;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  select count(*) into open_count from public.invites
   where created_by = uid and used_by is null and expires_at > now();
  if open_count >= 5 then
    raise exception 'too_many_open_invites' using errcode = 'P0001';
  end if;
  new_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  insert into public.invites (code, created_by) values (new_code, uid);
  return new_code;
end;
$$;
revoke all on function public.create_invite() from public, anon;
grant execute on function public.create_invite() to authenticated;

-- ---------------------------------------------------------------------------
-- Hesap silme: kullanıcı kendi hesabını siler; bağlı tüm satırlar cascade ile gider.
-- ---------------------------------------------------------------------------
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- ---------------------------------------------------------------------------
-- İLK DAVET KODU (yönetici): kayıt için en az bir kod gerekir. SQL Editor'de elle çalıştır:
--   insert into public.invites (code) values ('ILKKOD01');
-- ---------------------------------------------------------------------------
