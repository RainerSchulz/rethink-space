-- Anonymisiertes Protokoll des Website-Chats (keine IP, keine Nutzerkennung).
-- Dient dazu, die Wissensbasis anhand echter Fragen zu verbessern.
create table if not exists public.chat_log (
  id                bigint generated always as identity primary key,
  created_at        timestamptz not null default now(),
  lang              text not null check (lang in ('de', 'en')),
  question          text not null,
  answer            text not null,
  model             text,
  input_tokens      integer,
  output_tokens     integer,
  cache_read_tokens integer
);

-- Nur die Service-Rolle (Edge Function) darf schreiben und lesen: RLS an, keine Policies.
alter table public.chat_log enable row level security;
