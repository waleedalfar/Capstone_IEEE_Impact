-- Connections (Module 4): people find each other through the directory and connect. A connection is between two
-- people, not about a move; one row per pair, whoever asked first. Being connected lets either side see the other in
-- their Connections list; profiles themselves are visible to any signed-in user while PEOPLE_DIRECTORY is on.
create table social.connections (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users (id) on delete cascade,
  addressee_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (requester_id <> addressee_id)
);
create unique index connections_pair on social.connections (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index connections_addressee_idx on social.connections (addressee_id, status);
create index connections_requester_idx on social.connections (requester_id, status);

alter table social.connections enable row level security;
