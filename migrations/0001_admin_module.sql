create table if not exists node_request (
  id uuid primary key,
  applicant_address varchar(42) not null,
  node_name varchar(80) not null,
  server_host varchar(255) not null,
  node_rpc_url text,
  enode text not null,
  description text not null default '',
  status varchar(16) not null check (status in ('pending', 'approved', 'rejected', 'revoked')),
  review_comment text,
  reviewed_by varchar(42),
  create_time timestamptz not null default now(),
  update_time timestamptz not null default now()
);

alter table node_request
  drop constraint if exists node_request_status_check;

alter table node_request
  add constraint node_request_status_check
  check (status in ('pending', 'approved', 'rejected', 'revoked'));

alter table node_request
  add column if not exists node_rpc_url text;

create unique index if not exists node_request_enode_active_idx
  on node_request (lower(enode))
  where status in ('pending', 'approved');

create index if not exists node_request_status_idx
  on node_request (status, create_time desc);

create table if not exists validator_request (
  id uuid primary key,
  applicant_address varchar(42) not null,
  node_request_id uuid not null references node_request(id),
  validator_address varchar(42) not null,
  description text not null default '',
  status varchar(16) not null check (status in ('pending', 'approved', 'rejected')),
  review_comment text,
  reviewed_by varchar(42),
  create_time timestamptz not null default now(),
  update_time timestamptz not null default now()
);

create index if not exists validator_request_status_idx
  on validator_request (status, create_time desc);

create unique index if not exists validator_request_node_active_idx
  on validator_request (node_request_id)
  where status in ('pending', 'approved');

create unique index if not exists validator_request_address_active_idx
  on validator_request (lower(validator_address))
  where status in ('pending', 'approved');

create table if not exists admin_action_log (
  id uuid primary key,
  actor_address varchar(42) not null,
  action varchar(64) not null,
  target_id uuid not null,
  success boolean not null,
  detail text,
  create_time timestamptz not null default now()
);

create index if not exists admin_action_log_create_time_idx
  on admin_action_log (create_time desc);
