alter table user_snapshot
  add column if not exists vote_amount decimal(78,0) not null default 0;

alter table user_snapshot
  add column if not exists activate_after_block bigint not null default 0;

alter table user_snapshot
  add column if not exists withdraw_after_time bigint not null default 0;
