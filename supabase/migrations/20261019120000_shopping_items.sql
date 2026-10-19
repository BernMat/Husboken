-- =============================================================================
-- Husboken: shopping list per project
--
-- Works like notes: free-text rows belonging to one of the user's projects.
-- Same security model as every other table: RLS enabled, owner-only
-- policies, child rows may only point at the user's own projects, and the
-- anon role gets no privileges.
-- =============================================================================

create table public.shopping_items (
    id          bigint generated always as identity primary key,
    project_id  bigint not null references public.projects (id) on delete cascade,
    owner_id    uuid not null default auth.uid()
                references auth.users (id) on delete cascade,
    body        text not null check (char_length(body) between 1 and 2000),
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

comment on table public.shopping_items is
    'Shopping list entries for a project (things to buy).';

create index shopping_items_project_id_idx on public.shopping_items (project_id);
create index shopping_items_owner_id_idx on public.shopping_items (owner_id);

create trigger shopping_items_set_updated_at
    before update on public.shopping_items
    for each row execute function public.set_updated_at();

create trigger shopping_items_touch_project
    after insert or update or delete on public.shopping_items
    for each row execute function public.touch_parent_project();


-- Privileges ------------------------------------------------------------------
revoke all on public.shopping_items from anon;

grant select, insert, update, delete on public.shopping_items to authenticated;


-- Row Level Security ----------------------------------------------------------
alter table public.shopping_items enable row level security;

create policy "shopping_items_select_own" on public.shopping_items
    for select to authenticated
    using (owner_id = (select auth.uid()));

create policy "shopping_items_insert_own" on public.shopping_items
    for insert to authenticated
    with check (
        owner_id = (select auth.uid())
        and exists (select 1 from public.projects p
                     where p.id = project_id and p.owner_id = (select auth.uid()))
    );

create policy "shopping_items_update_own" on public.shopping_items
    for update to authenticated
    using (owner_id = (select auth.uid()))
    with check (
        owner_id = (select auth.uid())
        and exists (select 1 from public.projects p
                     where p.id = project_id and p.owner_id = (select auth.uid()))
    );

create policy "shopping_items_delete_own" on public.shopping_items
    for delete to authenticated
    using (owner_id = (select auth.uid()));
