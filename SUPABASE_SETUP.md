# Configuração segura dos perfis

Esta configuração deve ser concluída antes de publicar a nova versão.

## 1. Criar os utilizadores

No Supabase, em **Authentication > Users > Add user**, criar e confirmar estes três utilizadores:

- `gerente@cozinhadetacho.app`
- `equipa@cozinhadetacho.app`
- `chef@cozinhadetacho.app`

A palavra-passe de cada utilizador é formada por `CdT!` seguido do respetivo PIN de quatro algarismos. Os PINs nunca devem ser escritos no repositório.

## 2. Publicar o novo código

Publicar a versão que utiliza autenticação. Nesse momento os perfis Gerente e Equipa já conseguem entrar; o ecrã do Chef só fica operacional depois do passo seguinte.

## 3. Aplicar as permissões

Executar no **SQL Editor** o ficheiro:

`supabase/migrations/20260918_secure_profiles_and_chef.sql`

Este passo:

- ativa RLS;
- mantém o Gerente com gestão completa;
- permite à Equipa consultar produtos e registar saídas;
- permite ao Chef consultar o stock agregado e registar entradas/saídas;
- impede o Chef de consultar históricos, alterar produtos, preços ou inventário real.

## 4. Testar imediatamente

Confirmar os três acessos, testar uma entrada e uma saída de pequena quantidade e apagar os movimentos de teste no perfil Gerente.
