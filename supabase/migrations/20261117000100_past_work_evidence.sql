-- Past-work evidence (Module 3 + Module 4). Evidence used to belong to exactly one selected move. Now it can instead
-- belong to a wish: work done before (or outside) the wish's moves that still counts toward its skills and unlocks.
-- Such evidence never changes a move's status, so it can't open the wish's next step. A buddy can be invited to
-- review one piece of past-work evidence directly, the same way a buddy is invited onto a move.

-- growth.evidence: a wish link on every row (backfilled from the move), and the move link becomes optional.
alter table growth.evidence add column wish_id uuid references wish.wishes (id) on delete cascade;
update growth.evidence e set wish_id = sm.wish_id from wish.selected_moves sm where sm.id = e.selected_move_id;
alter table growth.evidence alter column selected_move_id drop not null;
alter table growth.evidence add constraint evidence_has_target check (selected_move_id is not null or wish_id is not null);
create index evidence_wish_idx on growth.evidence (wish_id);

-- social.invitations: an invitation targets either a selected move or one piece of past-work evidence.
alter table social.invitations add column evidence_id uuid references growth.evidence (id) on delete cascade;
alter table social.invitations alter column selected_move_id drop not null;
alter table social.invitations add constraint invitations_one_target check ((selected_move_id is null) <> (evidence_id is null));
create unique index invitations_evidence_buddy on social.invitations (evidence_id, buddy_id) where evidence_id is not null;
