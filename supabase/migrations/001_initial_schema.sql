-- ==============================================================================
-- NEXO PLATFORM - MIGRATION 001: INITIAL SCHEMA & ROW LEVEL SECURITY (RLS)
-- Description: Core relational schema for multi-tenant digital menus with
--              sub-3-minute onboarding and 0% cross-tenant data leakage.
-- Tables: public.restaurants, public.categories, public.dishes
-- Security: Row Level Security (RLS) on all tables
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. TABLE DEFINITIONS
-- ==============================================================================

-- 2.1 RESTAURANTS TABLE
-- Represents the tenant entity owned by an authenticated user in auth.users.
CREATE TABLE IF NOT EXISTS public.restaurants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    currency VARCHAR(3) DEFAULT 'EUR' NOT NULL,
    logo_url TEXT,
    is_published BOOLEAN DEFAULT TRUE NOT NULL,
    subscription_tier TEXT DEFAULT 'free' NOT NULL CHECK (subscription_tier IN ('free', 'starter', 'pro')),
    ai_scans_today INT DEFAULT 0 NOT NULL,
    ai_scans_reset_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 2.2 CATEGORIES TABLE
-- Represents menu sections (e.g. "Tapas", "Bebidas", "Postres").
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE NOT NULL,
    name_es TEXT NOT NULL,
    name_en TEXT,
    order_index INT DEFAULT 0 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 2.3 DISHES TABLE
-- Represents individual items within a category and restaurant.
CREATE TABLE IF NOT EXISTS public.dishes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE NOT NULL,
    category_id UUID REFERENCES public.categories(id) ON DELETE CASCADE NOT NULL,
    name_es TEXT NOT NULL,
    name_en TEXT,
    description_es TEXT,
    description_en TEXT,
    price DECIMAL(10, 2) NOT NULL CHECK (price >= 0),
    allergens TEXT[] DEFAULT '{}'::TEXT[] NOT NULL,
    is_available BOOLEAN DEFAULT TRUE NOT NULL,
    image_url TEXT,
    order_index INT DEFAULT 0 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ==============================================================================
-- 3. INDEXES FOR HIGH-PERFORMANCE LOOKUPS (< 50ms PUBLIC MENU SLA)
-- ==============================================================================

-- Fast slug-based lookups for public QR scan landing (/m/[slug])
CREATE INDEX IF NOT EXISTS idx_restaurants_slug ON public.restaurants(slug);
CREATE INDEX IF NOT EXISTS idx_restaurants_user_id ON public.restaurants(user_id);
CREATE INDEX IF NOT EXISTS idx_restaurants_published ON public.restaurants(is_published) WHERE is_published = TRUE;

-- Fast category retrieval ordered by display position
CREATE INDEX IF NOT EXISTS idx_categories_restaurant_order ON public.categories(restaurant_id, order_index);

-- Fast dish retrieval by category and restaurant
CREATE INDEX IF NOT EXISTS idx_dishes_category_order ON public.dishes(category_id, order_index);
CREATE INDEX IF NOT EXISTS idx_dishes_restaurant ON public.dishes(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_dishes_available ON public.dishes(is_available) WHERE is_available = TRUE;

-- ==============================================================================
-- 4. AUTOMATIC TIMESTAMP TRIGGERS
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_restaurants_updated_at ON public.restaurants;
CREATE TRIGGER tr_restaurants_updated_at
    BEFORE UPDATE ON public.restaurants
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS tr_dishes_updated_at ON public.dishes;
CREATE TRIGGER tr_dishes_updated_at
    BEFORE UPDATE ON public.dishes
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- ==============================================================================
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- Enable RLS strictly on all public schema tables
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dishes ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 5.1 RESTAURANTS POLICIES
-- ------------------------------------------------------------------------------

-- Policy 1: Anonymous & Public Read (Published only)
-- Anyone (including unauthenticated diners scanning QR codes) can view published restaurants.
CREATE POLICY "restaurants_public_read_published"
    ON public.restaurants
    FOR SELECT
    USING (is_published = TRUE);

-- Policy 2: Owner Read (All states)
-- Authenticated owners can view their restaurants even if in draft or unpublished.
CREATE POLICY "restaurants_owner_select"
    ON public.restaurants
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- Policy 3: Owner Insert
-- Authenticated users can create new restaurants setting themselves as owner.
CREATE POLICY "restaurants_owner_insert"
    ON public.restaurants
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Policy 4: Owner Update
-- Only the authentic owner can update restaurant details, settings, or publish state.
CREATE POLICY "restaurants_owner_update"
    ON public.restaurants
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Policy 5: Owner Delete
-- Only the authentic owner can delete the restaurant (cascades to categories and dishes).
CREATE POLICY "restaurants_owner_delete"
    ON public.restaurants
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- ------------------------------------------------------------------------------
-- 5.2 CATEGORIES POLICIES
-- ------------------------------------------------------------------------------

-- Policy 1: Public Read (Linked to published restaurant)
-- Diners can read categories if the parent restaurant is published.
CREATE POLICY "categories_public_read_published"
    ON public.categories
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.restaurants r
            WHERE r.id = categories.restaurant_id
              AND r.is_published = TRUE
        )
    );

-- Policy 2: Owner Read
-- Owners can read their categories regardless of published state.
CREATE POLICY "categories_owner_select"
    ON public.categories
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.restaurants r
            WHERE r.id = categories.restaurant_id
              AND r.user_id = auth.uid()
        )
    );

-- Policy 3: Owner Insert
-- Owners can only create categories for restaurants they own.
CREATE POLICY "categories_owner_insert"
    ON public.categories
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.restaurants r
            WHERE r.id = categories.restaurant_id
              AND r.user_id = auth.uid()
        )
    );

-- Policy 4: Owner Update
-- Owners can update categories for their own restaurants.
CREATE POLICY "categories_owner_update"
    ON public.categories
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.restaurants r
            WHERE r.id = categories.restaurant_id
              AND r.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.restaurants r
            WHERE r.id = categories.restaurant_id
              AND r.user_id = auth.uid()
        )
    );

-- Policy 5: Owner Delete
-- Owners can delete categories from their own restaurants.
CREATE POLICY "categories_owner_delete"
    ON public.categories
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.restaurants r
            WHERE r.id = categories.restaurant_id
              AND r.user_id = auth.uid()
        )
    );

-- ------------------------------------------------------------------------------
-- 5.3 DISHES POLICIES
-- ------------------------------------------------------------------------------

-- Policy 1: Public Read (Linked to published restaurant)
-- Diners can read dishes if the parent restaurant is published.
CREATE POLICY "dishes_public_read_published"
    ON public.dishes
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.restaurants r
            WHERE r.id = dishes.restaurant_id
              AND r.is_published = TRUE
        )
    );

-- Policy 2: Owner Read
-- Owners can read all dishes for restaurants they own.
CREATE POLICY "dishes_owner_select"
    ON public.dishes
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.restaurants r
            WHERE r.id = dishes.restaurant_id
              AND r.user_id = auth.uid()
        )
    );

-- Policy 3: Owner Insert
-- Owners can insert dishes only into restaurants and categories they own.
CREATE POLICY "dishes_owner_insert"
    ON public.dishes
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.restaurants r
            WHERE r.id = dishes.restaurant_id
              AND r.user_id = auth.uid()
        )
        AND
        EXISTS (
            SELECT 1 FROM public.categories c
            WHERE c.id = dishes.category_id
              AND c.restaurant_id = dishes.restaurant_id
        )
    );

-- Policy 4: Owner Update (Toggle availability, price, allergens)
-- Owners can update dishes belonging to their own restaurants.
CREATE POLICY "dishes_owner_update"
    ON public.dishes
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.restaurants r
            WHERE r.id = dishes.restaurant_id
              AND r.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.restaurants r
            WHERE r.id = dishes.restaurant_id
              AND r.user_id = auth.uid()
        )
    );

-- Policy 5: Owner Delete
-- Owners can delete dishes from their own restaurants.
CREATE POLICY "dishes_owner_delete"
    ON public.dishes
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.restaurants r
            WHERE r.id = dishes.restaurant_id
              AND r.user_id = auth.uid()
        )
    );
