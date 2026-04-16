alter table if exists orders
  drop column if exists phone;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'orders'
      and column_name = 'payment_notes'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'orders'
      and column_name = 'admin_order_notes'
  ) then
    alter table orders rename column payment_notes to admin_order_notes;
  end if;
end $$;

alter table if exists orders
  add column if not exists admin_order_notes text;

drop table if exists order_attachments;

alter table if exists catalog_categories
  drop column if exists catalog_category,
  drop column if exists catalog_categories;
