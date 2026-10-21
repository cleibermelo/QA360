-- QAPulse - schema do Supabase (Postgres).
-- Como usar: Supabase > SQL Editor > New query > colar este arquivo inteiro > Run.
-- Pode ser executado de novo sem erro (usa "if not exists" / "or replace" / "on conflict").
-- Regras de negocio espelham src/custom-code/domain/rules.ts.

-- ---------------------------------------------------------------------------
-- Tipos de teste (lista gerenciada). Nome e unidade vivem nos arquivos i18n (TestType_<key>_Name / _Unit).
-- ---------------------------------------------------------------------------
create table if not exists public.test_types (
  key    text primary key check (key ~ '^[a-z0-9_]+$'),
  active boolean not null default true
);

-- ---------------------------------------------------------------------------
-- Equipes e aplicacoes
-- ---------------------------------------------------------------------------
create table if not exists public.teams (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(btrim(name)) between 1 and 60),
  created_at timestamptz not null default now()
);
-- Nome do proprietario da equipe (texto livre, opcional). "add column if not exists" atualiza bancos ja criados.
alter table public.teams add column if not exists owner_name text not null default '' check (char_length(owner_name) <= 60);
-- Nome de equipe unico, sem diferenciar maiusculas/espacos nas pontas.
create unique index if not exists teams_name_unique on public.teams (lower(btrim(name)));

create table if not exists public.applications (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.teams (id) on delete cascade,
  name       text not null check (char_length(btrim(name)) between 1 and 60),
  created_at timestamptz not null default now()
);
-- Uma aplicacao nao pode estar em duas equipes: o nome e unico em todas as equipes.
drop index if exists public.applications_team_name_unique;
create unique index if not exists applications_name_unique on public.applications (lower(btrim(name)));

-- Tipos de teste habilitados em cada aplicacao.
-- "Pelo menos um tipo por aplicacao" e validado pelo app (nao da para expressar como constraint simples).
create table if not exists public.application_test_types (
  application_id uuid not null references public.applications (id) on delete cascade,
  test_type_key  text not null references public.test_types (key),
  primary key (application_id, test_type_key)
);

-- ---------------------------------------------------------------------------
-- Registros de cobertura: um valor atual por aplicacao + tipo de teste + mes.
-- A equipe se obtem pela aplicacao (applications.team_id).
-- ---------------------------------------------------------------------------
create table if not exists public.coverage_entries (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  test_type_key  text not null references public.test_types (key),
  year           smallint not null check (year between 2000 and 2100),
  month          smallint not null check (month between 1 and 12),
  percent        numeric(5, 2) not null check (percent between 0 and 100),
  note           text not null default '' check (char_length(note) <= 200),
  updated_at     timestamptz not null default now(),
  unique (application_id, test_type_key, year, month)
);

-- Historico: data da alteracao e valor anterior.
create table if not exists public.coverage_history (
  id               uuid primary key default gen_random_uuid(),
  entry_id         uuid not null references public.coverage_entries (id) on delete cascade,
  changed_at       timestamptz not null default now(),
  previous_percent numeric(5, 2) not null,
  previous_note    text not null default ''
);
create index if not exists coverage_history_entry_idx on public.coverage_history (entry_id, changed_at);

-- Ao alterar percentual ou observacao, grava o valor anterior no historico.
-- Regravar o mesmo valor nao altera nada (nao polui o historico).
create or replace function public.coverage_entries_track_history()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.percent is not distinct from old.percent and new.note is not distinct from old.note then
    return old;
  end if;
  insert into public.coverage_history (entry_id, previous_percent, previous_note)
  values (old.id, old.percent, old.note);
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists coverage_entries_track_history on public.coverage_entries;
create trigger coverage_entries_track_history
  before update on public.coverage_entries
  for each row execute function public.coverage_entries_track_history();

-- ---------------------------------------------------------------------------
-- Dados iniciais: somente a lista de tipos de teste, a equipe TOCT e suas 4 aplicacoes (sem registros).
-- ---------------------------------------------------------------------------
insert into public.test_types (key, active) values
  ('unit', true),
  ('integration', true),
  ('api', true),
  ('ui', true),
  ('performance', false)
on conflict (key) do nothing;

do $$
declare
  v_team uuid;
  v_app  uuid;
  v_item record;
begin
  select id into v_team from public.teams where lower(btrim(name)) = 'toct';
  if v_team is null then
    insert into public.teams (name) values ('TOCT') returning id into v_team;
  end if;

  for v_item in
    select * from (values
      ('APIs',  array['unit', 'integration', 'api']),
      ('Usage', array['unit', 'integration']),
      ('SRS',   array['unit', 'integration']),
      ('CBMS',  array['unit', 'integration'])
    ) as t (app_name, types)
  loop
    select id into v_app from public.applications
      where lower(btrim(name)) = lower(v_item.app_name);
    if v_app is null then
      insert into public.applications (team_id, name) values (v_team, v_item.app_name) returning id into v_app;
      insert into public.application_test_types (application_id, test_type_key)
        select v_app, unnest(v_item.types);
    end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Cobertura do SonarCloud: ultimo valor medido de cada mes, por projeto.
-- Gravada somente pelo job scripts/sonar-sync (service role, que ignora o RLS);
-- o app so le. Por isso nao ha policy de escrita.
-- ---------------------------------------------------------------------------
create table if not exists public.sonar_coverage_monthly (
  project_key  text not null,
  project_name text,
  month        date not null check (month = date_trunc('month', month)::date),
  coverage     numeric(5, 2),
  measured_on  date not null,
  updated_at   timestamptz not null default now(),
  primary key (project_key, month)
);

alter table public.sonar_coverage_monthly enable row level security;

-- Leitura so para usuarios autenticados, como nas demais tabelas (o site e publico, os projetos nao).
drop policy if exists "authenticated read" on public.sonar_coverage_monthly;
create policy "authenticated read" on public.sonar_coverage_monthly
  for select to authenticated using (true);

-- Um registro por projeto (nome mais recente) para o seletor do app; a consulta direta passaria do limite de linhas da API.
create or replace view public.sonar_projects with (security_invoker = true) as
  select distinct on (project_key) project_key, project_name
  from public.sonar_coverage_monthly
  order by project_key, month desc;

-- ---------------------------------------------------------------------------
-- Seguranca: RLS ligado em todas as tabelas.
-- Sem nenhuma policy ninguem acessa; aqui so usuarios autenticados (Supabase Auth) podem ler e escrever.
-- O app exige login (papel authenticated). Nao execute supabase/dev-anon-policies.sql com dados reais (ver docs/supabase.md).
-- ---------------------------------------------------------------------------
do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'test_types', 'teams', 'applications', 'application_test_types', 'coverage_entries', 'coverage_history'
  ]
  loop
    execute format('alter table public.%I enable row level security', v_table);
    execute format('drop policy if exists "authenticated full access" on public.%I', v_table);
    execute format(
      'create policy "authenticated full access" on public.%I for all to authenticated using (true) with check (true)',
      v_table
    );
  end loop;
end;
$$;
