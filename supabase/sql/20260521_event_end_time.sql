-- Add optional end_time to events. Backwards compatible: NULL allowed, existing rows unaffected.
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS end_time time NULL;
