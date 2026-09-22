-- Regista no servidor qual o perfil que confirmou cada entrada.
alter table public.entradas add column if not exists responsavel text;
alter table public.entradas alter column responsavel set default 'Gerente';

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

  insert into public.entradas (produto, quantidade, datahora, responsavel)
  select m ->> 'produto', sum((m ->> 'quantidade')::numeric), now(),
    case public.app_role() when 'chef' then 'Chef' else 'Gerente' end
  from jsonb_array_elements(p_movimentos) m
  group by m ->> 'produto';
end;
$$;

revoke all on function public.chef_registar_entradas(jsonb) from public;
grant execute on function public.chef_registar_entradas(jsonb) to authenticated;
