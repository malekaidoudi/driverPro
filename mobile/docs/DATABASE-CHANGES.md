# DriverPro — Changements Base de Données & Backend
## Pour supporter les nouvelles fonctionnalités UX

---

# 1. NOUVELLES TABLES

## 1.1 Table `favorite_stops` — Stops favoris

```sql
CREATE TABLE public.favorite_stops (
    id uuid DEFAULT uuid_generate_v4() NOT NULL PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    
    -- Adresse
    address text NOT NULL,
    address_complement text,  -- Bât, Villa, Digicode, Étage...
    postal_code text,
    city text,
    latitude double precision NOT NULL,
    longitude double precision NOT NULL,
    
    -- Destinataire
    first_name text,
    last_name text,
    phone_number text,
    
    -- Métadonnées
    label text,  -- Nom personnalisé (ex: "M. Dupont - Lundi")
    usage_count integer DEFAULT 0,  -- Nombre de fois utilisé
    last_used_at timestamp with time zone,
    
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- RLS
ALTER TABLE public.favorite_stops ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own favorites" ON public.favorite_stops 
    FOR ALL USING (auth.uid() = user_id);

-- Index pour recherche rapide
CREATE INDEX idx_favorite_stops_user ON public.favorite_stops(user_id);
CREATE INDEX idx_favorite_stops_address ON public.favorite_stops(address);
```

---

## 1.2 Table `recurring_stops` — Stops récurrents (quotidiens)

```sql
CREATE TABLE public.recurring_stops (
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
    default_order_preference text DEFAULT 'auto',  -- 'first', 'auto', 'last'
    
    -- Métadonnées
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- RLS
ALTER TABLE public.recurring_stops ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own recurring stops" ON public.recurring_stops 
    FOR ALL USING (auth.uid() = user_id);
```

---

## 1.3 Table `delivery_attempts` — Suivi tentatives livraison

```sql
-- Enum pour le type d'échec
CREATE TYPE failure_type AS ENUM ('absent', 'rescheduled', 'no_access');

CREATE TABLE public.delivery_attempts (
    id uuid DEFAULT uuid_generate_v4() NOT NULL PRIMARY KEY,
    stop_id uuid NOT NULL REFERENCES public.stops(id) ON DELETE CASCADE,
    
    attempt_number integer NOT NULL DEFAULT 1,  -- 1, 2, 3
    failure_type failure_type NOT NULL,
    
    -- Pour "Reporter"
    rescheduled_date date,
    rescheduled_route_id uuid REFERENCES public.routes(id),
    
    -- Métadonnées
    attempted_at timestamp with time zone DEFAULT now() NOT NULL,
    notes text
);

-- Index
CREATE INDEX idx_delivery_attempts_stop ON public.delivery_attempts(stop_id);
```

---

# 2. MODIFICATIONS TABLE `stops`

## 2.1 Nouveaux champs à ajouter

```sql
-- Complément d'adresse
ALTER TABLE public.stops ADD COLUMN address_complement text;

-- Ordre de livraison préféré
CREATE TYPE order_preference AS ENUM ('first', 'auto', 'last');
ALTER TABLE public.stops ADD COLUMN order_preference order_preference DEFAULT 'auto';

-- Lien avec favoris/récurrents
ALTER TABLE public.stops ADD COLUMN favorite_stop_id uuid REFERENCES public.favorite_stops(id);
ALTER TABLE public.stops ADD COLUMN recurring_stop_id uuid REFERENCES public.recurring_stops(id);

-- Suivi tentatives
ALTER TABLE public.stops ADD COLUMN attempt_count integer DEFAULT 0;
ALTER TABLE public.stops ADD COLUMN last_failure_type failure_type;
ALTER TABLE public.stops ADD COLUMN rescheduled_from_stop_id uuid REFERENCES public.stops(id);

-- Statut étendu
ALTER TYPE stop_status ADD VALUE 'rescheduled';
```

---

## 2.2 Script migration complet

```sql
-- Migration: Add new UX fields to stops table
-- Date: 2026-02-04

BEGIN;

-- 1. Créer les nouveaux types enum
CREATE TYPE failure_type AS ENUM ('absent', 'rescheduled', 'no_access');
CREATE TYPE order_preference AS ENUM ('first', 'auto', 'last');

-- 2. Ajouter colonnes à stops
ALTER TABLE public.stops 
    ADD COLUMN IF NOT EXISTS address_complement text,
    ADD COLUMN IF NOT EXISTS order_preference order_preference DEFAULT 'auto',
    ADD COLUMN IF NOT EXISTS attempt_count integer DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_failure_type failure_type,
    ADD COLUMN IF NOT EXISTS rescheduled_from_stop_id uuid REFERENCES public.stops(id);

-- 3. Créer table favorite_stops
CREATE TABLE IF NOT EXISTS public.favorite_stops (
    id uuid DEFAULT uuid_generate_v4() NOT NULL PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    address text NOT NULL,
    address_complement text,
    postal_code text,
    city text,
    latitude double precision NOT NULL,
    longitude double precision NOT NULL,
    first_name text,
    last_name text,
    phone_number text,
    label text,
    usage_count integer DEFAULT 0,
    last_used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.favorite_stops ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own favorites" ON public.favorite_stops 
    FOR ALL USING (auth.uid() = user_id);

-- 4. Créer table recurring_stops
CREATE TABLE IF NOT EXISTS public.recurring_stops (
    id uuid DEFAULT uuid_generate_v4() NOT NULL PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    address text NOT NULL,
    address_complement text,
    postal_code text,
    city text,
    latitude double precision NOT NULL,
    longitude double precision NOT NULL,
    first_name text,
    last_name text,
    phone_number text,
    is_active boolean DEFAULT true,
    days_of_week integer[] DEFAULT '{1,2,3,4,5}',
    default_package_count integer DEFAULT 1,
    default_order_preference order_preference DEFAULT 'auto',
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.recurring_stops ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own recurring stops" ON public.recurring_stops 
    FOR ALL USING (auth.uid() = user_id);

-- 5. Créer table delivery_attempts
CREATE TABLE IF NOT EXISTS public.delivery_attempts (
    id uuid DEFAULT uuid_generate_v4() NOT NULL PRIMARY KEY,
    stop_id uuid NOT NULL REFERENCES public.stops(id) ON DELETE CASCADE,
    attempt_number integer NOT NULL DEFAULT 1,
    failure_type failure_type NOT NULL,
    rescheduled_date date,
    rescheduled_route_id uuid REFERENCES public.routes(id),
    attempted_at timestamp with time zone DEFAULT now() NOT NULL,
    notes text
);

-- 6. Ajouter les foreign keys à stops
ALTER TABLE public.stops 
    ADD COLUMN IF NOT EXISTS favorite_stop_id uuid REFERENCES public.favorite_stops(id),
    ADD COLUMN IF NOT EXISTS recurring_stop_id uuid REFERENCES public.recurring_stops(id);

-- 7. Index
CREATE INDEX IF NOT EXISTS idx_favorite_stops_user ON public.favorite_stops(user_id);
CREATE INDEX IF NOT EXISTS idx_recurring_stops_user ON public.recurring_stops(user_id);
CREATE INDEX IF NOT EXISTS idx_delivery_attempts_stop ON public.delivery_attempts(stop_id);
CREATE INDEX IF NOT EXISTS idx_stops_order_preference ON public.stops(order_preference);

COMMIT;
```

---

# 3. MODIFICATIONS TABLE `user_preferences`

```sql
-- Ajouter préférence navigation
ALTER TABLE public.user_preferences 
    ADD COLUMN IF NOT EXISTS navigation_app text DEFAULT 'waze',
    ADD COLUMN IF NOT EXISTS navigation_always_ask boolean DEFAULT true;
```

---

# 4. NOUVEAUX ENDPOINTS BACKEND

## 4.1 Favorite Stops API

```python
# app/api/favorite_stops.py

@router.get("/favorite-stops")
async def get_favorite_stops(user: User = Depends(get_current_user)):
    """Liste tous les stops favoris de l'utilisateur"""
    pass

@router.post("/favorite-stops")
async def create_favorite_stop(data: FavoriteStopCreate, user: User = Depends(get_current_user)):
    """Crée un nouveau stop favori"""
    pass

@router.delete("/favorite-stops/{stop_id}")
async def delete_favorite_stop(stop_id: str, user: User = Depends(get_current_user)):
    """Supprime un stop favori"""
    pass

@router.post("/favorite-stops/{stop_id}/add-to-route/{route_id}")
async def add_favorite_to_route(stop_id: str, route_id: str, user: User = Depends(get_current_user)):
    """Ajoute un favori à une tournée"""
    pass
```

## 4.2 Recurring Stops API

```python
# app/api/recurring_stops.py

@router.get("/recurring-stops")
async def get_recurring_stops(user: User = Depends(get_current_user)):
    """Liste tous les stops récurrents"""
    pass

@router.post("/recurring-stops")
async def create_recurring_stop(data: RecurringStopCreate, user: User = Depends(get_current_user)):
    """Crée un stop récurrent"""
    pass

@router.put("/recurring-stops/{stop_id}")
async def update_recurring_stop(stop_id: str, data: RecurringStopUpdate, user: User = Depends(get_current_user)):
    """Met à jour un stop récurrent (jours, actif, etc.)"""
    pass

@router.delete("/recurring-stops/{stop_id}")
async def delete_recurring_stop(stop_id: str, user: User = Depends(get_current_user)):
    """Supprime un stop récurrent"""
    pass
```

## 4.3 Delivery Attempts API

```python
# app/api/delivery_attempts.py

@router.post("/stops/{stop_id}/fail")
async def record_delivery_failure(
    stop_id: str, 
    data: DeliveryFailureCreate,  # { failure_type, attempt_number, rescheduled_date? }
    user: User = Depends(get_current_user)
):
    """
    Enregistre un échec de livraison.
    - Si 'absent': incrémente attempt_count, reprogramme auto si < 3
    - Si 'rescheduled': crée copie du stop dans la tournée de la date choisie
    - Si 'no_access': marque comme échec définitif
    """
    pass

@router.get("/stops/{stop_id}/attempts")
async def get_delivery_attempts(stop_id: str, user: User = Depends(get_current_user)):
    """Historique des tentatives pour un stop"""
    pass
```

## 4.4 Route Creation avec Recurring Stops

```python
# Modifier app/api/routes.py

@router.post("/routes")
async def create_route(data: RouteCreate, user: User = Depends(get_current_user)):
    """
    Crée une tournée.
    NOUVEAU: Auto-ajoute les recurring_stops actifs pour ce jour de la semaine.
    """
    # 1. Créer la route
    route = await create_route_in_db(data, user.id)
    
    # 2. Récupérer les stops récurrents pour ce jour
    day_of_week = data.route_date.isoweekday()  # 1=Lun, 7=Dim
    recurring = await get_recurring_stops_for_day(user.id, day_of_week)
    
    # 3. Ajouter automatiquement les stops récurrents
    for rec in recurring:
        await add_stop_from_recurring(route.id, rec)
    
    return route
```

---

# 5. NOUVEAUX MODÈLES PYDANTIC

```python
# app/models/favorite_stop.py

class FavoriteStopBase(BaseModel):
    address: str
    address_complement: Optional[str] = None
    postal_code: Optional[str] = None
    city: Optional[str] = None
    latitude: float
    longitude: float
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone_number: Optional[str] = None
    label: Optional[str] = None

class FavoriteStopCreate(FavoriteStopBase):
    pass

class FavoriteStopResponse(FavoriteStopBase):
    id: str
    usage_count: int
    last_used_at: Optional[datetime]
    created_at: datetime


# app/models/recurring_stop.py

class RecurringStopBase(BaseModel):
    address: str
    address_complement: Optional[str] = None
    postal_code: Optional[str] = None
    city: Optional[str] = None
    latitude: float
    longitude: float
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone_number: Optional[str] = None
    is_active: bool = True
    days_of_week: List[int] = [1, 2, 3, 4, 5]  # Lun-Ven par défaut
    default_package_count: int = 1
    default_order_preference: str = "auto"
    notes: Optional[str] = None

class RecurringStopCreate(RecurringStopBase):
    pass

class RecurringStopResponse(RecurringStopBase):
    id: str
    created_at: datetime


# app/models/delivery_attempt.py

class FailureType(str, Enum):
    absent = "absent"
    rescheduled = "rescheduled"
    no_access = "no_access"

class DeliveryFailureCreate(BaseModel):
    failure_type: FailureType
    attempt_number: int = 1  # 1, 2, ou 3
    rescheduled_date: Optional[date] = None  # Si failure_type == rescheduled
    notes: Optional[str] = None


# app/models/stop.py - MODIFICATIONS

class OrderPreference(str, Enum):
    first = "first"
    auto = "auto"
    last = "last"

class StopCreate(BaseModel):
    # ... champs existants ...
    address_complement: Optional[str] = None  # NOUVEAU
    order_preference: OrderPreference = OrderPreference.auto  # NOUVEAU
    is_favorite: bool = False  # NOUVEAU - crée aussi un favori
    is_recurring: bool = False  # NOUVEAU - crée aussi un récurrent
```

---

# 6. LOGIQUE MÉTIER

## 6.1 Auto-reprogrammation Absent

```python
async def handle_absent_failure(stop_id: str, attempt_number: int, user_id: str):
    """
    Logique quand un stop est marqué 'Absent'
    """
    stop = await get_stop(stop_id)
    
    # Enregistrer la tentative
    await create_delivery_attempt(
        stop_id=stop_id,
        attempt_number=attempt_number,
        failure_type="absent"
    )
    
    # Mettre à jour le stop
    await update_stop(stop_id, {
        "status": "failed",
        "attempt_count": attempt_number,
        "last_failure_type": "absent"
    })
    
    if attempt_number < 3:
        # Reprogrammer pour demain
        tomorrow = date.today() + timedelta(days=1)
        tomorrow_route = await get_or_create_route_for_date(user_id, tomorrow)
        
        # Créer une copie du stop dans la tournée de demain
        new_stop = await clone_stop_to_route(stop, tomorrow_route.id)
        new_stop.attempt_count = attempt_number
        new_stop.rescheduled_from_stop_id = stop_id
        
        return {"rescheduled_to": tomorrow, "new_stop_id": new_stop.id}
    else:
        # 3ème échec = définitif
        # Envoyer notification alerte
        await send_notification(user_id, f"Stop #{stop.sequence_order} - 3 échecs consécutifs")
        return {"final_failure": True}
```

## 6.2 Auto-ajout Recurring Stops

```python
async def add_recurring_stops_to_route(route_id: str, route_date: date, user_id: str):
    """
    Appelé automatiquement à la création d'une tournée
    """
    day_of_week = route_date.isoweekday()  # 1=Lun, 7=Dim
    
    recurring_stops = await db.fetch_all(
        """
        SELECT * FROM recurring_stops 
        WHERE user_id = $1 
        AND is_active = true 
        AND $2 = ANY(days_of_week)
        """,
        user_id, day_of_week
    )
    
    for rec in recurring_stops:
        await create_stop(StopCreate(
            route_id=route_id,
            address=rec.address,
            address_complement=rec.address_complement,
            latitude=rec.latitude,
            longitude=rec.longitude,
            first_name=rec.first_name,
            last_name=rec.last_name,
            phone_number=rec.phone_number,
            package_count=rec.default_package_count,
            order_preference=rec.default_order_preference,
            recurring_stop_id=rec.id
        ))
```

---

# 7. RÉSUMÉ DES CHANGEMENTS

| Élément | Type | Description |
|---------|------|-------------|
| `favorite_stops` | Nouvelle table | Stops favoris réutilisables |
| `recurring_stops` | Nouvelle table | Stops quotidiens auto-ajoutés |
| `delivery_attempts` | Nouvelle table | Historique tentatives livraison |
| `stops.address_complement` | Nouveau champ | Bât, Villa, Digicode... |
| `stops.order_preference` | Nouveau champ | first/auto/last |
| `stops.attempt_count` | Nouveau champ | Compteur tentatives |
| `stops.favorite_stop_id` | Nouveau champ | Lien vers favori source |
| `stops.recurring_stop_id` | Nouveau champ | Lien vers récurrent source |
| `failure_type` | Nouveau enum | absent/rescheduled/no_access |
| `order_preference` | Nouveau enum | first/auto/last |
| `/favorite-stops` | Nouveau endpoint | CRUD favoris |
| `/recurring-stops` | Nouveau endpoint | CRUD récurrents |
| `/stops/{id}/fail` | Nouveau endpoint | Enregistrer échec |
| Route creation | Modification | Auto-ajout recurring stops |

---

# 8. ORDRE D'IMPLÉMENTATION RECOMMANDÉ

1. **Migration DB** - Exécuter le script SQL de migration
2. **Modèles Pydantic** - Créer les nouveaux modèles
3. **API Favorite Stops** - CRUD basique
4. **API Recurring Stops** - CRUD + logique jours
5. **API Delivery Failures** - Logique échecs + reprogrammation
6. **Modifier Route Creation** - Auto-ajout recurring
7. **Modifier Optimisation** - Respecter order_preference
8. **Tests** - Valider tous les flows

