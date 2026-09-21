-- Cada fecho mensal e correção pontual grava o stock e o respetivo motivo
-- na mesma transação. O histórico só pode ser consultado pelo Gerente.
create table if not exists public.inventario_ajustes (
  id bigint generated always as identity primary key,
  produto text not null,
  quantidade_anterior numeric,
  quantidade_nova numeric not null,
  tipo text not null check (tipo in ('mensal', 'pontual')),
  mes_referencia text,
  motivo text not null check (length(btrim(motivo)) between 1 and 500),
  autor_id uuid not null,
  autor_email text not null,
  criado_em timestamptz not null default now()
);

create index if not exists inventario_ajustes_criado_em_idx
  on public.inventario_ajustes (criado_em desc, id desc);

alter table public.inventario_ajustes enable row level security;
revoke all on table public.inventario_ajustes from public, anon, authenticated;
grant select on table public.inventario_ajustes to authenticated;
drop policy if exists inventario_ajustes_gerente_ler on public.inventario_ajustes;
create policy inventario_ajustes_gerente_ler on public.inventario_ajustes
  for select to authenticated using (public.app_role() = 'gerente');

create or replace function public.gerente_gravar_inventario(
  p_itens jsonb, p_motivo text, p_tipo text, p_mes text default null
)
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
  if public.app_role() is distinct from 'gerente' or autor is null then
    raise exception 'ACESSO_NEGADO';
  end if;
  if length(btrim(coalesce(p_motivo, ''))) not between 1 and 500 then
    raise exception 'MOTIVO_OBRIGATORIO';
  end if;
  if p_tipo is null or p_tipo not in ('mensal', 'pontual') then
    raise exception 'TIPO_INVALIDO';
  end if;
  if (p_tipo = 'mensal' and (p_mes is null or p_mes !~ '^[0-9]{4}-(0[1-9]|1[0-2])$'))
     or (p_tipo = 'pontual' and p_mes is not null) then
    raise exception 'MES_INVALIDO';
  end if;
  if jsonb_typeof(p_itens) is distinct from 'array' or jsonb_array_length(p_itens) = 0 then
    raise exception 'LISTA_VAZIA';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_itens) m
    where jsonb_typeof(m) <> 'object'
       or jsonb_typeof(m -> 'quantidade') <> 'number'
       or nullif(btrim(m ->> 'produto'), '') is null
  ) then
    raise exception 'ITEM_INVALIDO';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_itens) m
    group by m ->> 'produto' having count(*) > 1
  ) then
    raise exception 'PRODUTO_DUPLICADO';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_itens) m
    left join public.produtos p on p.nome = m ->> 'produto'
    where p.nome is null or (m ->> 'quantidade')::numeric < 0
  ) then
    raise exception 'ITEM_INVALIDO';
  end if;

  -- Ordem estável também para gravações mensais simultâneas.
  perform 1 from public.produtos p
  where p.nome in (select m ->> 'produto' from jsonb_array_elements(p_itens) m)
  order by p.nome for update;

  for item in
    select m ->> 'produto' as produto, (m ->> 'quantidade')::numeric as quantidade
    from jsonb_array_elements(p_itens) m order by m ->> 'produto'
  loop
    quantidade := item.quantidade;
    select ir.quantidade into anterior from public.inventario_real ir
      where ir.produto = item.produto;

    insert into public.inventario_real (produto, quantidade, updated_at)
      values (item.produto, quantidade, instante)
      on conflict (produto) do update
      set quantidade = excluded.quantidade, updated_at = excluded.updated_at;

    insert into public.inventario_ajustes
      (produto, quantidade_anterior, quantidade_nova, tipo, mes_referencia, motivo, autor_id, autor_email, criado_em)
      values (item.produto, anterior, quantidade, p_tipo, p_mes, btrim(p_motivo), autor, email, instante);
    total := total + 1;
  end loop;
  return total;
end;
$$;

revoke all on function public.gerente_gravar_inventario(jsonb, text, text, text) from public;
grant execute on function public.gerente_gravar_inventario(jsonb, text, text, text) to authenticated;

-- Obriga as gravações feitas pela aplicação a passar pela transação auditada.
drop policy if exists inventario_gerente_inserir on public.inventario_real;
drop policy if exists inventario_gerente_atualizar on public.inventario_real;
drop policy if exists inventario_gerente_apagar on public.inventario_real;
revoke insert, update, delete on table public.inventario_real from authenticated;
