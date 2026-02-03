-- Migration: Add priority, time_window, and package fields to stops table
-- Run this on an existing database

-- Create priority enum if not exists
DO $$ BEGIN
    CREATE TYPE stop_priority AS ENUM ('normal', 'high', 'urgent');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add new columns
ALTER TABLE public.stops ADD COLUMN IF NOT EXISTS priority stop_priority DEFAULT 'normal'::stop_priority NOT NULL;
ALTER TABLE public.stops ADD COLUMN IF NOT EXISTS first_name text;
ALTER TABLE public.stops ADD COLUMN IF NOT EXISTS last_name text;
ALTER TABLE public.stops ADD COLUMN IF NOT EXISTS phone_number text;
ALTER TABLE public.stops ADD COLUMN IF NOT EXISTS time_window_start time;
ALTER TABLE public.stops ADD COLUMN IF NOT EXISTS time_window_end time;
ALTER TABLE public.stops ADD COLUMN IF NOT EXISTS package_weight_kg double precision;
ALTER TABLE public.stops ADD COLUMN IF NOT EXISTS package_size text;
ALTER TABLE public.stops ADD COLUMN IF NOT EXISTS is_fragile boolean DEFAULT false;
