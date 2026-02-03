-- Migration: Add favorites, recurring stops, and delivery attempts
-- Version: 002
-- Date: 2026-02-04
-- Description: Support for favorite stops, recurring stops, delivery failure tracking

BEGIN;

-- ============================================
-- 1. CREATE NEW ENUM TYPES
-- ============================================

-- Type d'échec de livraison
DO $$ BEGIN
    CREATE TYPE failure_type AS ENUM ('absent', 'rescheduled', 'no_access');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Préférence d'ordre de livraison
DO $$ BEGIN
    CREATE TYPE order_preference AS ENUM ('first', 'auto', 'last');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================
-- 2. CREATE TABLE: favorite_stops
-- ============================================

CREATE TABLE IF NOT EXISTS public.favorite_stops (
    id uuid DEFAULT uuid_generate_v4() NOT NULL PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    
    -- Adresse
    address text NOT NULL,
    address_complement text,
    postal_code text,
    city text,
    latitude double precision NOT NULL,
    longitude double precision NOT NULL,
    
    -- Destinataire
    first_name text,
    last_name text,
    phone_number text,
    
    -- Métadonnées
    label text,
    usage_count integer DEFAULT 0,
    last_used_at timestamp with time zone,
    
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- RLS pour favorite_stops
ALTER TABLE public.favorite_stops ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage their own favorites" ON public.favorite_stops;
CREATE POLICY "Users manage their own favorites" ON public.favorite_stops 
    FOR ALL USING (auth.uid() = user_id);

-- Index
CREATE INDEX IF NOT EXISTS idx_favorite_stops_user ON public.favorite_stops(user_id);
CREATE INDEX IF NOT EXISTS idx_favorite_stops_address ON public.favorite_stops(address);

-- ============================================
-- 3. CREATE TABLE: recurring_stops
-- ============================================

CREATE TABLE IF NOT EXISTS public.recurring_stops (
    id uuid DEFAULT uuid_generate_v4() NOT NULL PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    
    -- Adresse
    address text NOT NULL,
    address_complement text,
    postal_code text,
    city text,
    latitude double precision NOT NULL,
    longitude double precision NOT NULL,
    
    -- Destinataire
    first_name text,
    last_name text,
    phone_number text,
    
    -- Configuration récurrence
    is_active boolean DEFAULT true,
    days_of_week integer[] DEFAULT '{1,2,3,4,5}',  -- 1=Lun, 7=Dim
    default_package_count integer DEFAULT 1,
    default_order_preference order_preference DEFAULT 'auto',
    
    -- Métadonnées
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- RLS pour recurring_stops
ALTER TABLE public.recurring_stops ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage their own recurring stops" ON public.recurring_stops;
CREATE POLICY "Users manage their own recurring stops" ON public.recurring_stops 
    FOR ALL USING (auth.uid() = user_id);

-- Index
CREATE INDEX IF NOT EXISTS idx_recurring_stops_user ON public.recurring_stops(user_id);
CREATE INDEX IF NOT EXISTS idx_recurring_stops_active ON public.recurring_stops(is_active) WHERE is_active = true;

-- ============================================
-- 4. CREATE TABLE: delivery_attempts
-- ============================================

CREATE TABLE IF NOT EXISTS public.delivery_attempts (
    id uuid DEFAULT uuid_generate_v4() NOT NULL PRIMARY KEY,
    stop_id uuid NOT NULL REFERENCES public.stops(id) ON DELETE CASCADE,
    
    attempt_number integer NOT NULL DEFAULT 1,
    failure_type failure_type NOT NULL,
    
    -- Pour "Reporter"
    rescheduled_date date,
    rescheduled_route_id uuid REFERENCES public.routes(id),
    
    -- Métadonnées
    attempted_at timestamp with time zone DEFAULT now() NOT NULL,
    notes text
);

-- Index
CREATE INDEX IF NOT EXISTS idx_delivery_attempts_stop ON public.delivery_attempts(stop_id);

-- ============================================
-- 5. ALTER TABLE: stops - Add new columns
-- ============================================

-- Complément d'adresse
ALTER TABLE public.stops ADD COLUMN IF NOT EXISTS address_complement text;

-- Code postal et ville séparés (pour meilleure gestion)
ALTER TABLE public.stops ADD COLUMN IF NOT EXISTS postal_code text;
ALTER TABLE public.stops ADD COLUMN IF NOT EXISTS city text;

-- Préférence d'ordre de livraison
ALTER TABLE public.stops ADD COLUMN IF NOT EXISTS order_preference order_preference DEFAULT 'auto';

-- Suivi des tentatives
ALTER TABLE public.stops ADD COLUMN IF NOT EXISTS attempt_count integer DEFAULT 0;
ALTER TABLE public.stops ADD COLUMN IF NOT EXISTS last_failure_type failure_type;
ALTER TABLE public.stops ADD COLUMN IF NOT EXISTS rescheduled_from_stop_id uuid REFERENCES public.stops(id);

-- Liens vers favoris/récurrents
ALTER TABLE public.stops ADD COLUMN IF NOT EXISTS favorite_stop_id uuid REFERENCES public.favorite_stops(id);
ALTER TABLE public.stops ADD COLUMN IF NOT EXISTS recurring_stop_id uuid REFERENCES public.recurring_stops(id);

-- Index pour order_preference (utile pour l'optimisation)
CREATE INDEX IF NOT EXISTS idx_stops_order_preference ON public.stops(order_preference) 
    WHERE order_preference != 'auto';

-- ============================================
-- 6. ALTER TABLE: user_preferences - Add navigation settings
-- ============================================

ALTER TABLE public.user_preferences 
    ADD COLUMN IF NOT EXISTS navigation_always_ask boolean DEFAULT true;

-- ============================================
-- 7. ADD 'rescheduled' to stop_status enum (if not exists)
-- ============================================

-- Check if 'rescheduled' value exists, add if not
DO $$ BEGIN
    ALTER TYPE stop_status ADD VALUE IF NOT EXISTS 'rescheduled';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

COMMIT;
