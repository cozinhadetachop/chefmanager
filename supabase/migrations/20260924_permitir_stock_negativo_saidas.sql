-- Permitir saídas mesmo quando o stock atual é zero ou negativo.
-- Mantém validações de acesso, produto existente e quantidade positiva.

create or replace function public.equipa_registar_saidas(p_movimentos jsonb, p_responsavel text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.app_role() <> 'equipa' or public.app_role() is null then
    raise exception 'ACESSO_NEGADO';
  end if;

  if nullif(btrim(p_responsavel), '') is null then
    raise exception 'RESPONSAVEL_OBRIGATORIO';
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

  insert into public.saidas (produto, quantidade, unidade, setor, "dataHora", responsavel)
  select pedido.produto, pedido.quantidade, p.unidade, 'Cozinha', now(), btrim(p_responsavel)
  from (
    select m ->> 'produto' as produto, sum((m ->> 'quantidade')::numeric) as quantidade
    from jsonb_array_elements(p_movimentos) m
    group by m ->> 'produto'
  ) pedido
  join public.produtos p on p.nome = pedido.produto;
end;
$$;

revoke all on function public.equipa_registar_saidas(jsonb, text) from public;
grant execute on function public.equipa_registar_saidas(jsonb, text) to authenticated;


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

revoke all on function public.chef_registar_saidas(jsonb) from public;
grant execute on function public.chef_registar_saidas(jsonb) to authenticated;
