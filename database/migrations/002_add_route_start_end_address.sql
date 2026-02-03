-- Migration: Add start_address and end_address columns to routes table
-- Run this on an existing database to add the new columns

ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS start_address text;
ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS end_address text;
