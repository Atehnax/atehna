update audit_events
set retention_until = case
  when entity_type = 'order' then occurred_at + interval '2 months'
  when entity_type in ('item', 'category', 'media', 'system') then occurred_at + interval '3 years'
  else retention_until
end
where entity_type in ('item', 'order', 'category', 'media', 'system');
