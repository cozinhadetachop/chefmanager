-- Perfis seguros e permissões do Chef Cozinha.
-- Aplicar apenas depois de criar os três utilizadores no Supabase Auth.

create or replace function public.app_role()
returns text
language sql
stable
as $$
  select case lower(coalesce(auth.jwt() ->> 'email', ''))
    when 'gerente@cozinhadetacho.app' then 'gerente'
    when 'equipa@cozinhadetacho.app' then 'equipa'
    when 'chef@cozinhadetacho.app' then 'chef'
    else null
  end;
$$;

create or replace function public.chef_stock_atual()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  resultado jsonb;
begin
  if public.app_role() not in ('chef', 'gerente') then
    raise exception 'ACESSO_NEGADO';
  end if;

  select coalesce(jsonb_agg(to_jsonb(stock) order by stock.nome), '[]'::jsonb)
  into resultado
  from (
    select
      p.nome,
      p.unidade,
      p.procedencia,
      p.minimo,
      p.preco_unit,
      coalesce(ir.quantidade, 0)
        + coalesce((
            select sum(e.quantidade)
            from public.entradas e
            where e.produto = p.nome
              and e.datahora >= coalesce(ir.updated_at, date_trunc('month', now()))
          ), 0)
        - coalesce((
            select sum(s.quantidade)
            from public.saidas s
            where s.produto = p.nome
              and s."dataHora" >= coalesce(ir.updated_at, date_trunc('month', now()))
          ), 0) as stock_atual
    from public.produtos p
    left join public.inventario_real ir on ir.produto = p.nome
  ) stock;

  return resultado;
end;
$$;

create or replace function public.chef_registar_entradas(p_movimentos jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.app_role() not in ('chef', 'gerente') then
    raise exception 'ACESSO_NEGADO';
  end if;
  if jsonb_typeof(p_movimentos) <> 'array' or jsonb_array_length(p_movimentos) = 0 then
    raise exception 'LISTA_VAZIA';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_movimentos) m
    left join public.produtos p on p.nome = m ->> 'produto'
    where p.nome is null
       or coalesce((m ->> 'quantidade')::numeric, 0) <= 0
  ) then
    raise exception 'MOVIMENTO_INVALIDO';
  end if;

  insert into public.entradas (produto, quantidade, datahora)
  select m ->> 'produto', sum((m ->> 'quantidade')::numeric), now()
  from jsonb_array_elements(p_movimentos) m
  group by m ->> 'produto';
end;
$$;

create or replace function public.chef_registar_saidas(p_movimentos jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.app_role() not in ('chef', 'gerente') then
    raise exception 'ACESSO_NEGADO';
  end if;
  if jsonb_typeof(p_movimentos) <> 'array' or jsonb_array_length(p_movimentos) = 0 then
    raise exception 'LISTA_VAZIA';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_movimentos) m
    left join public.produtos p on p.nome = m ->> 'produto'
    where p.nome is null
       or coalesce((m ->> 'quantidade')::numeric, 0) <= 0
  ) then
    raise exception 'MOVIMENTO_INVALIDO';
  end if;

  perform 1
  from public.produtos p
  where p.nome in (select m ->> 'produto' from jsonb_array_elements(p_movimentos) m)
  for update;

  if exists (
    with pedidos as (
      select m ->> 'produto' as produto, sum((m ->> 'quantidade')::numeric) as quantidade
      from jsonb_array_elements(p_movimentos) m
      group by m ->> 'produto'
    ), stock as (
      select nome, stock_atual
      from jsonb_to_recordset(public.chef_stock_atual()) as x(nome text, stock_atual numeric)
    )
    select 1
    from pedidos p
    left join stock s on s.nome = p.produto
    where s.nome is null or p.quantidade > s.stock_atual
  ) then
    raise exception 'STOCK_INSUFICIENTE';
  end if;

  insert into public.saidas (produto, quantidade, unidade, setor, "dataHora", responsavel)
  select
    m.produto,
    m.quantidade,
    p.unidade,
    'Cozinha',
    now(),
    'Chef Cozinha'
  from (
    select item ->> 'produto' as produto, sum((item ->> 'quantidade')::numeric) as quantidade
    from jsonb_array_elements(p_movimentos) item
    group by item ->> 'produto'
  ) m
  join public.produtos p on p.nome = m.produto;
end;
$$;

revoke all on function public.app_role() from public;
revoke all on function public.chef_stock_atual() from public;
revoke all on function public.chef_registar_entradas(jsonb) from public;
revoke all on function public.chef_registar_saidas(jsonb) from public;
grant execute on function public.app_role() to authenticated;
grant execute on function public.chef_stock_atual() to authenticated;
grant execute on function public.chef_registar_entradas(jsonb) to authenticated;
grant execute on function public.chef_registar_saidas(jsonb) to authenticated;

alter table public.produtos enable row level security;
alter table public.entradas enable row level security;
alter table public.saidas enable row level security;
alter table public.inventario_real enable row level security;
-- Tabela antiga, vazia e não utilizada pela aplicação atual.
-- Mantém-se preservada, mas deixa de estar exposta pela API pública.
alter table public.profiles enable row level security;

-- Remove políticas antigas para não ficar nenhum acesso anónimo ou demasiado amplo.
do $$
declare
  politica record;
begin
  for politica in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('produtos', 'entradas', 'saidas', 'inventario_real')
  loop
    execute format('drop policy %I on %I.%I', politica.policyname, politica.schemaname, politica.tablename);
  end loop;
end;
$$;

revoke all on table public.produtos from anon;
revoke all on table public.entradas from anon;
revoke all on table public.saidas from anon;
revoke all on table public.inventario_real from anon;
revoke all on table public.profiles from anon;
grant select, insert, update, delete on table public.produtos to authenticated;
grant select, insert, update, delete on table public.entradas to authenticated;
grant select, insert, update, delete on table public.saidas to authenticated;
grant select, insert, update, delete on table public.inventario_real to authenticated;

drop policy if exists "produtos_ler_perfis" on public.produtos;
drop policy if exists "produtos_gerente_inserir" on public.produtos;
drop policy if exists "produtos_gerente_atualizar" on public.produtos;
drop policy if exists "produtos_gerente_apagar" on public.produtos;
create policy "produtos_ler_perfis" on public.produtos for select to authenticated using (public.app_role() is not null);
create policy "produtos_gerente_inserir" on public.produtos for insert to authenticated with check (public.app_role() = 'gerente');
create policy "produtos_gerente_atualizar" on public.produtos for update to authenticated using (public.app_role() = 'gerente') with check (public.app_role() = 'gerente');
create policy "produtos_gerente_apagar" on public.produtos for delete to authenticated using (public.app_role() = 'gerente');

drop policy if exists "entradas_gerente_ler" on public.entradas;
drop policy if exists "entradas_gerente_inserir" on public.entradas;
drop policy if exists "entradas_gerente_atualizar" on public.entradas;
drop policy if exists "entradas_gerente_apagar" on public.entradas;
create policy "entradas_gerente_ler" on public.entradas for select to authenticated using (public.app_role() = 'gerente');
create policy "entradas_gerente_inserir" on public.entradas for insert to authenticated with check (public.app_role() = 'gerente');
create policy "entradas_gerente_atualizar" on public.entradas for update to authenticated using (public.app_role() = 'gerente') with check (public.app_role() = 'gerente');
create policy "entradas_gerente_apagar" on public.entradas for delete to authenticated using (public.app_role() = 'gerente');

drop policy if exists "saidas_gerente_ler" on public.saidas;
drop policy if exists "saidas_perfis_inserir" on public.saidas;
drop policy if exists "saidas_gerente_atualizar" on public.saidas;
drop policy if exists "saidas_gerente_apagar" on public.saidas;
create policy "saidas_gerente_ler" on public.saidas for select to authenticated using (public.app_role() = 'gerente');
create policy "saidas_perfis_inserir" on public.saidas for insert to authenticated with check (public.app_role() in ('gerente', 'equipa'));
create policy "saidas_gerente_atualizar" on public.saidas for update to authenticated using (public.app_role() = 'gerente') with check (public.app_role() = 'gerente');
create policy "saidas_gerente_apagar" on public.saidas for delete to authenticated using (public.app_role() = 'gerente');

drop policy if exists "inventario_gerente_ler" on public.inventario_real;
drop policy if exists "inventario_gerente_inserir" on public.inventario_real;
drop policy if exists "inventario_gerente_atualizar" on public.inventario_real;
drop policy if exists "inventario_gerente_apagar" on public.inventario_real;
create policy "inventario_gerente_ler" on public.inventario_real for select to authenticated using (public.app_role() = 'gerente');
create policy "inventario_gerente_inserir" on public.inventario_real for insert to authenticated with check (public.app_role() = 'gerente');
create policy "inventario_gerente_atualizar" on public.inventario_real for update to authenticated using (public.app_role() = 'gerente') with check (public.app_role() = 'gerente');
create policy "inventario_gerente_apagar" on public.inventario_real for delete to authenticated using (public.app_role() = 'gerente');
