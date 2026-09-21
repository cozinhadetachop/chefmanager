-- A Equipa só regista saídas através desta transação, que verifica o stock
-- depois de bloquear os produtos envolvidos. O Gerente mantém as permissões atuais.
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

  -- Bloquear sempre na mesma ordem evita duas confirmações simultâneas
  -- consumirem o mesmo stock e reduz a possibilidade de deadlocks.
  perform 1
  from public.produtos p
  where p.nome in (select m ->> 'produto' from jsonb_array_elements(p_movimentos) m)
  order by p.nome
  for update;

  if exists (
    with pedidos as (
      select m ->> 'produto' as produto, sum((m ->> 'quantidade')::numeric) as quantidade
      from jsonb_array_elements(p_movimentos) m
      group by m ->> 'produto'
    ), stock as (
      select p.nome,
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
            ), 0) as quantidade
      from public.produtos p
      left join public.inventario_real ir on ir.produto = p.nome
      where p.nome in (select produto from pedidos)
    )
    select 1
    from pedidos ped
    left join stock s on s.nome = ped.produto
    where s.nome is null or ped.quantidade > s.quantidade
  ) then
    raise exception 'STOCK_INSUFICIENTE';
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

drop policy if exists "saidas_perfis_inserir" on public.saidas;
drop policy if exists "saidas_gerente_inserir" on public.saidas;
create policy "saidas_gerente_inserir" on public.saidas
  for insert to authenticated with check (public.app_role() = 'gerente');
