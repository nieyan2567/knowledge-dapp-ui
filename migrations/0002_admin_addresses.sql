create table if not exists admin_address (
  id uuid primary key,
  wallet_address varchar(42) not null unique,
  is_active boolean not null default true,
  remark text,
  created_by varchar(42),
  create_time timestamptz not null default now(),
  update_time timestamptz not null default now()
);

create index if not exists admin_address_active_idx
  on admin_address (is_active, create_time desc);
