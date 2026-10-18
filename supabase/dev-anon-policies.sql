-- QAPulse - SOMENTE DESENVOLVIMENTO / MVP SEM LOGIN.
-- Libera leitura e escrita para o papel "anon", ou seja, qualquer pessoa com a URL do projeto e a
-- chave publica consegue ler e alterar os dados. Nao use com dados reais.
-- Para remover quando o login for implementado: execute o bloco comentado no final deste arquivo.

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'test_types', 'teams', 'applications', 'application_test_types', 'coverage_entries', 'coverage_history'
  ]
  loop
    execute format('drop policy if exists "dev anon full access" on public.%I', v_table);
    execute format(
      'create policy "dev anon full access" on public.%I for all to anon using (true) with check (true)',
      v_table
    );
  end loop;
end;
$$;

-- Remocao:
-- do $$
-- declare v_table text;
-- begin
--   foreach v_table in array array[
--     'test_types', 'teams', 'applications', 'application_test_types', 'coverage_entries', 'coverage_history'
--   ]
--   loop
--     execute format('drop policy if exists "dev anon full access" on public.%I', v_table);
--   end loop;
-- end;
-- $$;
