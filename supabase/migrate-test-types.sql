-- QAPulse - migracao dos tipos de teste para: unit, integration, api, ui e performance (inativo).
-- Rode UMA vez no Supabase (SQL Editor) em um banco criado com a lista antiga.
-- Bancos novos ja nascem com a lista nova pelo supabase/schema.sql.
--
-- unit, integration, performance -> permanecem
-- e2e_api -> api   (renomeado)
-- e2e_ui  -> ui    (renomeado)
-- contract, security -> removidos (com os registros que tiverem)

begin;

insert into public.test_types (key, active) values ('api', true), ('ui', true)
on conflict (key) do nothing;

insert into public.test_types (key, active) values ('performance', false)
on conflict (key) do update set active = false;

-- Tipos de teste habilitados em cada aplicacao.
insert into public.application_test_types (application_id, test_type_key)
  select application_id, 'api' from public.application_test_types where test_type_key = 'e2e_api'
on conflict do nothing;

insert into public.application_test_types (application_id, test_type_key)
  select application_id, 'ui' from public.application_test_types where test_type_key = 'e2e_ui'
on conflict do nothing;

-- Registros de cobertura. O gatilho do historico cancela UPDATEs que nao mudam percentual ou observacao,
-- entao ele fica desligado so enquanto o tipo e trocado.
alter table public.coverage_entries disable trigger coverage_entries_track_history;
update public.coverage_entries set test_type_key = 'api' where test_type_key = 'e2e_api';
update public.coverage_entries set test_type_key = 'ui' where test_type_key = 'e2e_ui';
alter table public.coverage_entries enable trigger coverage_entries_track_history;

-- O que sobrou dos tipos antigos e descartado.
delete from public.coverage_entries where test_type_key in ('e2e_api', 'e2e_ui', 'contract', 'security');
delete from public.application_test_types where test_type_key in ('e2e_api', 'e2e_ui', 'contract', 'security');
delete from public.test_types where key in ('e2e_api', 'e2e_ui', 'contract', 'security');

commit;

-- Conferencia: deve listar api, integration, performance (inativo), ui e unit.
select key, active from public.test_types order by key;
