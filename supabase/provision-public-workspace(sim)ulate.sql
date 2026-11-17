-- Run once after all migrations.
-- No account or Auth user is needed.
-- This creates an isolated software test pond.

BEGIN;

DO $$
DECLARE
    pond uuid := gen_random_uuid();
    gateway uuid := gen_random_uuid();
    source text := 'simulation';
BEGIN

    INSERT INTO public.ponds (id, name, is_public)
    VALUES (
        pond,
        CASE
            WHEN source = 'simulation'
            THEN 'Software test pond (simulated)'
            ELSE 'Research pond A'
        END,
        true
    );

    INSERT INTO public.gateways (id, pond_id, name, data_source)
    VALUES (
        gateway,
        pond,
        'Simulation gateway 01',
        source
    );

    INSERT INTO public.nodes (
        gateway_id,
        slot,
        label,
        position,
        ultrasonic_enabled
    )
    SELECT
        gateway,
        n,
        'Node ' || lpad(n::text, 2, '0'),
        (ARRAY[
            'North inlet',
            'Northeast bank',
            'East center',
            'South outlet',
            'Southwest bank',
            'West center'
        ])[n],
        n <= 3
    FROM generate_series(1, 6) n;

END $$;

COMMIT;
