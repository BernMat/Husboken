-- =============================================================================
-- Husboken: remember when an attachment was last viewed
--
-- The project page shows the four most recently viewed images. Opening an
-- image sets attachments.last_viewed_at = now().
--
-- Viewing is not an edit, so it must NOT bump attachments.updated_at or the
-- parent project's updated_at (that would reorder the project list just by
-- looking at a photo). The two update triggers are therefore recreated with
-- "update of <columns>", which only fires when one of the listed columns is
-- part of the UPDATE statement. last_viewed_at is deliberately left out.
--
-- RLS: the existing attachments_update_own policy already limits updates to
-- the owner's own rows, so no new policies are needed.
-- =============================================================================

alter table public.attachments
    add column last_viewed_at timestamptz;

comment on column public.attachments.last_viewed_at is
    'When the owner last opened this attachment; null if never viewed.';

create index attachments_project_last_viewed_idx
    on public.attachments (project_id, last_viewed_at desc nulls last);


-- updated_at: only for real edits ---------------------------------------------
drop trigger attachments_set_updated_at on public.attachments;

create trigger attachments_set_updated_at
    before update of project_id, kind, storage_path, file_name, mime_type,
                     size_bytes, caption
    on public.attachments
    for each row execute function public.set_updated_at();


-- parent project's updated_at: inserts, deletes and real edits only ---------
drop trigger attachments_touch_project on public.attachments;

create trigger attachments_touch_project
    after insert or delete
    or update of project_id, kind, storage_path, file_name, mime_type,
                 size_bytes, caption
    on public.attachments
    for each row execute function public.touch_parent_project();
