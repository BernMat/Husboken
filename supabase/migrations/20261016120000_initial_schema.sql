-- =============================================================================
-- Husboken: initial schema
--
-- Tables: projects, notes, measurements, contacts, attachments
-- Storage: private bucket "attachments" with per-user folders
--
-- Security model: the browser talks directly to the database with the public
-- anon key, so EVERY table has Row Level Security (RLS) enabled and policies
-- that only allow a logged-in user to touch rows where owner_id = auth.uid().
-- Child rows (notes etc.) may additionally only point at the user's own projects.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Helper: keep updated_at current on every UPDATE
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

comment on function public.set_updated_at() is
    'Trigger function: sets updated_at to now() before each update.';


-- -----------------------------------------------------------------------------
-- projects
-- -----------------------------------------------------------------------------
create table public.projects (
    id          bigint generated always as identity primary key,
    owner_id    uuid not null default auth.uid()
                references auth.users (id) on delete cascade,
    name        text not null check (char_length(trim(name)) between 1 and 200),
    type        text not null
                check (type in ('garden_planning', 'gardening', 'renovation', 'building')),
    status      text not null default 'planned'
                check (status in ('planned', 'in_progress', 'done')),
    description text check (char_length(description) <= 10000),
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

comment on table public.projects is 'A home project owned by one user.';

create index projects_owner_id_idx on public.projects (owner_id);

create trigger projects_set_updated_at
    before update on public.projects
    for each row execute function public.set_updated_at();


-- -----------------------------------------------------------------------------
-- notes
-- -----------------------------------------------------------------------------
create table public.notes (
    id          bigint generated always as identity primary key,
    project_id  bigint not null references public.projects (id) on delete cascade,
    owner_id    uuid not null default auth.uid()
                references auth.users (id) on delete cascade,
    body        text not null check (char_length(body) between 1 and 20000),
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

comment on table public.notes is 'Free-text notes belonging to a project.';

create index notes_project_id_idx on public.notes (project_id);
create index notes_owner_id_idx on public.notes (owner_id);

create trigger notes_set_updated_at
    before update on public.notes
    for each row execute function public.set_updated_at();


-- -----------------------------------------------------------------------------
-- measurements
-- -----------------------------------------------------------------------------
create table public.measurements (
    id          bigint generated always as identity primary key,
    project_id  bigint not null references public.projects (id) on delete cascade,
    owner_id    uuid not null default auth.uid()
                references auth.users (id) on delete cascade,
    label       text not null check (char_length(trim(label)) between 1 and 200),
    value       numeric not null,
    unit        text not null default 'cm' check (char_length(unit) between 1 and 20),
    comment     text check (char_length(comment) <= 2000),
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

comment on table public.measurements is
    'Named measurements for a project, e.g. "Window width" 120 cm.';

create index measurements_project_id_idx on public.measurements (project_id);
create index measurements_owner_id_idx on public.measurements (owner_id);

create trigger measurements_set_updated_at
    before update on public.measurements
    for each row execute function public.set_updated_at();


-- -----------------------------------------------------------------------------
-- contacts
-- -----------------------------------------------------------------------------
create table public.contacts (
    id          bigint generated always as identity primary key,
    project_id  bigint not null references public.projects (id) on delete cascade,
    owner_id    uuid not null default auth.uid()
                references auth.users (id) on delete cascade,
    name        text not null check (char_length(trim(name)) between 1 and 200),
    role        text check (char_length(role) <= 200),
    phone       text check (char_length(phone) <= 50),
    email       text check (char_length(email) <= 320),
    comment     text check (char_length(comment) <= 2000),
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

comment on table public.contacts is
    'People or companies involved in a project (craftsmen, suppliers, etc.).';

create index contacts_project_id_idx on public.contacts (project_id);
create index contacts_owner_id_idx on public.contacts (owner_id);

create trigger contacts_set_updated_at
    before update on public.contacts
    for each row execute function public.set_updated_at();


-- -----------------------------------------------------------------------------
-- attachments (metadata; the file itself lives in Storage)
-- -----------------------------------------------------------------------------
create table public.attachments (
    id           bigint generated always as identity primary key,
    project_id   bigint not null references public.projects (id) on delete cascade,
    owner_id     uuid not null default auth.uid()
                 references auth.users (id) on delete cascade,
    kind         text not null default 'photo' check (kind in ('photo', 'drawing')),
    storage_path text not null unique,
    file_name    text not null check (char_length(file_name) between 1 and 255),
    mime_type    text not null,
    size_bytes   bigint check (size_bytes >= 0),
    caption      text check (char_length(caption) <= 2000),
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now()
);

comment on table public.attachments is
    'Photos and drawings for a project. storage_path is "<owner_id>/<project_id>/<file>" in bucket "attachments".';

create index attachments_project_id_idx on public.attachments (project_id);
create index attachments_owner_id_idx on public.attachments (owner_id);

create trigger attachments_set_updated_at
    before update on public.attachments
    for each row execute function public.set_updated_at();


-- -----------------------------------------------------------------------------
-- Touch the parent project's updated_at when its notes, measurements,
-- contacts or attachments change, so the project list sorts by real activity.
-- -----------------------------------------------------------------------------
create or replace function public.touch_parent_project()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    update public.projects
       set updated_at = now()
     where id = coalesce(new.project_id, old.project_id);
    return null; -- AFTER trigger: return value is ignored
end;
$$;

comment on function public.touch_parent_project() is
    'Trigger function: bumps projects.updated_at when a child row changes.';

create trigger notes_touch_project
    after insert or update or delete on public.notes
    for each row execute function public.touch_parent_project();

create trigger measurements_touch_project
    after insert or update or delete on public.measurements
    for each row execute function public.touch_parent_project();

create trigger contacts_touch_project
    after insert or update or delete on public.contacts
    for each row execute function public.touch_parent_project();

create trigger attachments_touch_project
    after insert or update or delete on public.attachments
    for each row execute function public.touch_parent_project();


-- -----------------------------------------------------------------------------
-- Privileges: only logged-in users may use the tables (anon gets nothing).
-- RLS below then limits them to their own rows.
-- -----------------------------------------------------------------------------
revoke all on public.projects, public.notes, public.measurements,
              public.contacts, public.attachments
    from anon;

grant select, insert, update, delete
    on public.projects, public.notes, public.measurements,
       public.contacts, public.attachments
    to authenticated;


-- -----------------------------------------------------------------------------
-- Row Level Security
--
-- "(select auth.uid())" instead of "auth.uid()" lets Postgres evaluate the
-- user id once per query instead of once per row (Supabase recommendation).
-- -----------------------------------------------------------------------------
alter table public.projects     enable row level security;
alter table public.notes        enable row level security;
alter table public.measurements enable row level security;
alter table public.contacts     enable row level security;
alter table public.attachments  enable row level security;

-- projects: owner only -------------------------------------------------------
create policy "projects_select_own" on public.projects
    for select to authenticated
    using (owner_id = (select auth.uid()));

create policy "projects_insert_own" on public.projects
    for insert to authenticated
    with check (owner_id = (select auth.uid()));

create policy "projects_update_own" on public.projects
    for update to authenticated
    using (owner_id = (select auth.uid()))
    with check (owner_id = (select auth.uid()));

create policy "projects_delete_own" on public.projects
    for delete to authenticated
    using (owner_id = (select auth.uid()));

-- notes: owner only, and only inside the owner's own projects ----------------
create policy "notes_select_own" on public.notes
    for select to authenticated
    using (owner_id = (select auth.uid()));

create policy "notes_insert_own" on public.notes
    for insert to authenticated
    with check (
        owner_id = (select auth.uid())
        and exists (select 1 from public.projects p
                     where p.id = project_id and p.owner_id = (select auth.uid()))
    );

create policy "notes_update_own" on public.notes
    for update to authenticated
    using (owner_id = (select auth.uid()))
    with check (
        owner_id = (select auth.uid())
        and exists (select 1 from public.projects p
                     where p.id = project_id and p.owner_id = (select auth.uid()))
    );

create policy "notes_delete_own" on public.notes
    for delete to authenticated
    using (owner_id = (select auth.uid()));

-- measurements ---------------------------------------------------------------
create policy "measurements_select_own" on public.measurements
    for select to authenticated
    using (owner_id = (select auth.uid()));

create policy "measurements_insert_own" on public.measurements
    for insert to authenticated
    with check (
        owner_id = (select auth.uid())
        and exists (select 1 from public.projects p
                     where p.id = project_id and p.owner_id = (select auth.uid()))
    );

create policy "measurements_update_own" on public.measurements
    for update to authenticated
    using (owner_id = (select auth.uid()))
    with check (
        owner_id = (select auth.uid())
        and exists (select 1 from public.projects p
                     where p.id = project_id and p.owner_id = (select auth.uid()))
    );

create policy "measurements_delete_own" on public.measurements
    for delete to authenticated
    using (owner_id = (select auth.uid()));

-- contacts -------------------------------------------------------------------
create policy "contacts_select_own" on public.contacts
    for select to authenticated
    using (owner_id = (select auth.uid()));

create policy "contacts_insert_own" on public.contacts
    for insert to authenticated
    with check (
        owner_id = (select auth.uid())
        and exists (select 1 from public.projects p
                     where p.id = project_id and p.owner_id = (select auth.uid()))
    );

create policy "contacts_update_own" on public.contacts
    for update to authenticated
    using (owner_id = (select auth.uid()))
    with check (
        owner_id = (select auth.uid())
        and exists (select 1 from public.projects p
                     where p.id = project_id and p.owner_id = (select auth.uid()))
    );

create policy "contacts_delete_own" on public.contacts
    for delete to authenticated
    using (owner_id = (select auth.uid()));

-- attachments: also require the file path to sit in the user's own folder ---
create policy "attachments_select_own" on public.attachments
    for select to authenticated
    using (owner_id = (select auth.uid()));

create policy "attachments_insert_own" on public.attachments
    for insert to authenticated
    with check (
        owner_id = (select auth.uid())
        and storage_path like (select auth.uid())::text || '/%'
        and exists (select 1 from public.projects p
                     where p.id = project_id and p.owner_id = (select auth.uid()))
    );

create policy "attachments_update_own" on public.attachments
    for update to authenticated
    using (owner_id = (select auth.uid()))
    with check (
        owner_id = (select auth.uid())
        and storage_path like (select auth.uid())::text || '/%'
        and exists (select 1 from public.projects p
                     where p.id = project_id and p.owner_id = (select auth.uid()))
    );

create policy "attachments_delete_own" on public.attachments
    for delete to authenticated
    using (owner_id = (select auth.uid()));


-- -----------------------------------------------------------------------------
-- Storage: private bucket for photos and drawings (max 20 MB per file)
-- Files are stored as "<user_id>/<project_id>/<file name>".
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'attachments',
    'attachments',
    false,
    20971520,
    array[
        'image/jpeg', 'image/png', 'image/webp', 'image/gif',
        'image/heic', 'image/heif', 'application/pdf'
    ]
)
on conflict (id) do nothing;

create policy "attachments_bucket_select_own" on storage.objects
    for select to authenticated
    using (
        bucket_id = 'attachments'
        and (storage.foldername(name))[1] = (select auth.uid())::text
    );

create policy "attachments_bucket_insert_own" on storage.objects
    for insert to authenticated
    with check (
        bucket_id = 'attachments'
        and (storage.foldername(name))[1] = (select auth.uid())::text
    );

create policy "attachments_bucket_update_own" on storage.objects
    for update to authenticated
    using (
        bucket_id = 'attachments'
        and (storage.foldername(name))[1] = (select auth.uid())::text
    )
    with check (
        bucket_id = 'attachments'
        and (storage.foldername(name))[1] = (select auth.uid())::text
    );

create policy "attachments_bucket_delete_own" on storage.objects
    for delete to authenticated
    using (
        bucket_id = 'attachments'
        and (storage.foldername(name))[1] = (select auth.uid())::text
    );
