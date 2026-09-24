
-- Inventário do Chef: permite contagem física sem expor preços/valores.
-- O Gerente mantém o acesso financeiro e ao histórico completo.

create or replace function public.chef_stock_atual()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  resultado jsonb;
  papel text := public.app_role();
begin
  if papel not in ('chef', 'gerente') then
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
      case when papel = 'gerente' then p.preco_unit else null end as preco_unit,
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

create or replace function public.chef_gravar_inventario(p_itens jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  item record;
  anterior numeric;
  quantidade numeric;
  instante timestamptz := now();
  autor uuid := auth.uid();
  email text := auth.jwt() ->> 'email';
  total integer := 0;
begin
  if public.app_role() is distinct from 'chef' or autor is null then
    raise exception 'ACESSO_NEGADO';
  end if;

  if jsonb_typeof(p_itens) is distinct from 'array' or jsonb_array_length(p_itens) = 0 then
    raise exception 'LISTA_VAZIA';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_itens) m
    where jsonb_typeof(m) <> 'object'
       or jsonb_typeof(m -> 'quantidade') <> 'number'
       or nullif(btrim(m ->> 'produto'), '') is null
  ) then
    raise exception 'ITEM_INVALIDO';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_itens) m
    group by m ->> 'produto'
    having count(*) > 1
  ) then
    raise exception 'PRODUTO_DUPLICADO';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_itens) m
    left join public.produtos p on p.nome = m ->> 'produto'
    where p.nome is null
       or (m ->> 'quantidade')::numeric < 0
  ) then
    raise exception 'ITEM_INVALIDO';
  end if;

  perform 1
  from public.produtos p
  where p.nome in (select m ->> 'produto' from jsonb_array_elements(p_itens) m)
  order by p.nome
  for update;

  for item in
    select
      m ->> 'produto' as produto,
      (m ->> 'quantidade')::numeric as quantidade
    from jsonb_array_elements(p_itens) m
    order by m ->> 'produto'
  loop
    quantidade := item.quantidade;

    select ir.quantidade
      into anterior
      from public.inventario_real ir
      where ir.produto = item.produto;

    insert into public.inventario_real (produto, quantidade, updated_at)
      values (item.produto, quantidade, instante)
      on conflict (produto) do update
      set quantidade = excluded.quantidade,
          updated_at = excluded.updated_at;

    insert into public.inventario_ajustes
      (produto, quantidade_anterior, quantidade_nova, tipo, mes_referencia, motivo, autor_id, autor_email, criado_em)
      values (
        item.produto,
        anterior,
        quantidade,
        'mensal',
        to_char(instante, 'YYYY-MM'),
        'Inventário físico Chef',
        autor,
        coalesce(email, 'chef@cozinhadetacho.app'),
        instante
      );

    total := total + 1;
  end loop;

  return total;
end;
$$;

revoke all on function public.chef_gravar_inventario(jsonb) from public;
grant execute on function public.chef_gravar_inventario(jsonb) to authenticated;
