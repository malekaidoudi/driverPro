-- Activer l'extension pour les UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table des utilisateurs (gérée en partie par Supabase Auth)
CREATE TABLE public.users (
    id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email character varying,
    full_name character varying,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Table des préférences utilisateur
CREATE TABLE public.user_preferences (
    user_id uuid NOT NULL PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    theme text DEFAULT 'system'::text,
    default_stop_duration_minutes integer DEFAULT 3,
    default_vehicle_type text DEFAULT 'car'::text,
    avoid_tolls boolean DEFAULT false,
    navigation_app text DEFAULT 'google_maps'::text
);

-- Table des tournées
CREATE TABLE public.routes (
    id uuid DEFAULT uuid_generate_v4() NOT NULL PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    name character varying NOT NULL,
    route_date date NOT NULL,
    status text DEFAULT 'draft'::text,
    total_distance_meters integer,
    total_duration_seconds integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Enum pour le type d'arrêt
CREATE TYPE stop_type AS ENUM ('delivery', 'collection', 'break');

-- Enum pour le statut de l'arrêt
CREATE TYPE stop_status AS ENUM ('pending', 'completed', 'failed', 'skipped');

-- Table des arrêts
CREATE TABLE public.stops (
    id uuid DEFAULT uuid_generate_v4() NOT NULL PRIMARY KEY,
    route_id uuid NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
    sequence_order integer,
    address text NOT NULL,
    latitude double precision NOT NULL,
    longitude double precision NOT NULL,
    notes text,
    type stop_type DEFAULT 'delivery'::stop_type NOT NULL,
    status stop_status DEFAULT 'pending'::stop_status NOT NULL,
    arrival_time timestamp with time zone,
    departure_time timestamp with time zone,
    estimated_duration_seconds integer DEFAULT 180,
    package_count integer DEFAULT 1,
    package_finder_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Activer les Row Level Security (RLS) pour la sécurité des données multi-utilisateurs
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stops ENABLE ROW LEVEL SECURITY;

-- Politiques RLS
CREATE POLICY "Allow users to see their own data" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Allow users to manage their own preferences" ON public.user_preferences FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Allow users to manage their own routes" ON public.routes FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Allow users to manage stops on their own routes" ON public.stops FOR ALL USING (
    (SELECT user_id FROM public.routes WHERE id = route_id) = auth.uid()
);
