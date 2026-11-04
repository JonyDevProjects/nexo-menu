-- ==============================================================================
-- NEXO PLATFORM - SEED DATA FOR LOCAL DEVELOPMENT / TESTING
-- Description: Seed data creating a demo restaurant, categories, and dishes.
-- ==============================================================================

DO $$
DECLARE
    demo_user_id UUID := 'a0000000-0000-0000-0000-000000000001'::UUID;
    res_id UUID := 'b0000000-0000-0000-0000-000000000001'::UUID;
    cat_tapas UUID := 'c0000000-0000-0000-0000-000000000001'::UUID;
    cat_carnes UUID := 'c0000000-0000-0000-0000-000000000002'::UUID;
    cat_postres UUID := 'c0000000-0000-0000-0000-000000000003'::UUID;
BEGIN
    -- 0. Ensure Demo User exists in auth.users to satisfy restaurants_user_id_fkey
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = demo_user_id) THEN
        BEGIN
            INSERT INTO auth.users (
                instance_id,
                id,
                aud,
                role,
                email,
                encrypted_password,
                email_confirmed_at,
                raw_app_meta_data,
                raw_user_meta_data,
                created_at,
                updated_at,
                confirmation_token,
                recovery_token
            ) VALUES (
                '00000000-0000-0000-0000-000000000000',
                demo_user_id,
                'authenticated',
                'authenticated',
                'demo-bar-pepe@nexo.internal',
                '',
                NOW(),
                '{"provider":"email","providers":["email"]}'::jsonb,
                '{"name":"Bar Pepe Demo Owner"}'::jsonb,
                NOW(),
                NOW(),
                '',
                ''
            );
        EXCEPTION WHEN OTHERS THEN
            BEGIN
                INSERT INTO auth.users (id, aud, role, email, created_at, updated_at)
                VALUES (demo_user_id, 'authenticated', 'authenticated', 'demo-bar-pepe@nexo.internal', NOW(), NOW());
            EXCEPTION WHEN OTHERS THEN
                SELECT id INTO demo_user_id FROM auth.users LIMIT 1;
            END;
        END;
    END IF;

    -- 1. Insert Demo Restaurant
    INSERT INTO public.restaurants (
        id, user_id, name, slug, description, currency, is_published, subscription_tier
    ) VALUES (
        res_id,
        demo_user_id,
        'Bar Pepe & Tapas',
        'bar-pepe',
        'Cervecería de barrio con tapas caseras, raciones y las mejores croquetas de la ciudad.',
        'EUR',
        TRUE,
        'free'
    ) ON CONFLICT (slug) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        is_published = TRUE;

    -- 2. Insert Categories
    INSERT INTO public.categories (id, restaurant_id, name_es, name_en, order_index)
    VALUES
        (cat_tapas, res_id, 'Tapas y Raciones', 'Tapas and Sharing Plates', 0),
        (cat_carnes, res_id, 'Carnes y Platos Fuertes', 'Meats and Mains', 1),
        (cat_postres, res_id, 'Postres y Cafés', 'Desserts & Coffee', 2)
    ON CONFLICT (id) DO NOTHING;

    -- 3. Insert Dishes
    INSERT INTO public.dishes (
        restaurant_id, category_id, name_es, name_en, description_es, description_en, price, allergens, is_available, order_index
    ) VALUES
        (
            res_id, cat_tapas,
            'Croquetas Caseras de Jamón Ibérico',
            'Homemade Iberian Ham Croquettes',
            '6 unidades con bechamel extra cremosa y jamón de bellota crujiente.',
            '6 pieces with extra creamy bechamel and crispy acorn-fed ham.',
            9.50,
            ARRAY['gluten', 'dairy', 'eggs'],
            TRUE, 0
        ),
        (
            res_id, cat_tapas,
            'Patatas Bravas de la Casa',
            'House Special Spicy Bravas Potatoes',
            'Patatas agrias cortadas a mano con salsa brava ahumada y alioli casero.',
            'Hand-cut crispy potatoes with smoky spicy brava sauce and homemade garlic alioli.',
            6.00,
            ARRAY['gluten', 'eggs'],
            TRUE, 1
        ),
        (
            res_id, cat_tapas,
            'Calamares Frescos a la Andaluza',
            'Andalusian Style Fried Squid',
            'Anillas de calamar fresco enharinadas y fritas en aceite de oliva virgen.',
            'Fresh squid rings lightly battered and fried in extra virgin olive oil.',
            11.50,
            ARRAY['gluten', 'molluscs'],
            TRUE, 2
        ),
        (
            res_id, cat_carnes,
            'Smash Burger Especial Nexo',
            'Nexo Special Smash Burger',
            '180g de vaca rubia gallega madurada, cheddar madurado, bacon crujiente y pan brioche.',
            '180g aged Galician beef patty, aged cheddar, crispy bacon in a toasted brioche bun.',
            10.90,
            ARRAY['gluten', 'dairy', 'eggs', 'sesame', 'mustard'],
            TRUE, 0
        ),
        (
            res_id, cat_carnes,
            'Secreto Ibérico a la Brasa',
            'Grilled Iberian Pork Secret',
            'Corte jugoso a la brasa con pimientos de Padrón y escamas de sal marina.',
            'Juicy cut grilled with Padrón peppers and sea salt flakes.',
            14.50,
            ARRAY[]::TEXT[],
            TRUE, 1
        ),
        (
            res_id, cat_postres,
            'Tarta de Queso Fluida al Horno',
            'Baked Creamy Cheesecake',
            'Receta tradicional donostiarra con corazón fundente.',
            'Traditional recipe with a creamy melting core.',
            5.50,
            ARRAY['dairy', 'eggs', 'gluten'],
            TRUE, 0
        )
    ON CONFLICT DO NOTHING;
END $$;
