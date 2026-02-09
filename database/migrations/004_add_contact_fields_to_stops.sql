-- Migration: Add contact fields to stops table
-- These fields already exist in schema.sql but may not be in production

-- Add first_name if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stops' AND column_name = 'first_name') THEN
        ALTER TABLE public.stops ADD COLUMN first_name text;
    END IF;
END $$;

-- Add last_name if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stops' AND column_name = 'last_name') THEN
        ALTER TABLE public.stops ADD COLUMN last_name text;
    END IF;
END $$;

-- Add phone_number if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stops' AND column_name = 'phone_number') THEN
        ALTER TABLE public.stops ADD COLUMN phone_number text;
    END IF;
END $$;

-- Add time_window_start if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stops' AND column_name = 'time_window_start') THEN
        ALTER TABLE public.stops ADD COLUMN time_window_start time;
    END IF;
END $$;

-- Add time_window_end if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stops' AND column_name = 'time_window_end') THEN
        ALTER TABLE public.stops ADD COLUMN time_window_end time;
    END IF;
END $$;

-- Add package_weight_kg if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stops' AND column_name = 'package_weight_kg') THEN
        ALTER TABLE public.stops ADD COLUMN package_weight_kg double precision;
    END IF;
END $$;

-- Add package_size if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stops' AND column_name = 'package_size') THEN
        ALTER TABLE public.stops ADD COLUMN package_size text;
    END IF;
END $$;

-- Add is_fragile if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stops' AND column_name = 'is_fragile') THEN
        ALTER TABLE public.stops ADD COLUMN is_fragile boolean DEFAULT false;
    END IF;
END $$;

-- Add package_finder_id if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stops' AND column_name = 'package_finder_id') THEN
        ALTER TABLE public.stops ADD COLUMN package_finder_id text;
    END IF;
END $$;
