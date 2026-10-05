-- ==============================================================================
-- Seed Script: dipan@gmail.com (CASHIER ROLE with Email Confirmed)
-- Run this in your Supabase Project -> SQL Editor
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  v_user_id UUID;
BEGIN
  -- 1. Check if user already exists in auth.users
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'dipan@gmail.com';

  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();

    -- Create user in auth.users with confirmed email and bcrypt encrypted password
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
      email_change,
      email_change_token_new,
      recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_user_id,
      'authenticated',
      'authenticated',
      'dipan@gmail.com',
      crypt('dipan123@', gen_salt('bf')),
      timezone('utc'::text, now()),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Dipan (Cashier)","role":"cashier"}'::jsonb,
      timezone('utc'::text, now()),
      timezone('utc'::text, now()),
      '',
      '',
      '',
      ''
    );
  ELSE
    -- If user already exists, update password, confirm email, and set metadata
    UPDATE auth.users
    SET 
      encrypted_password = crypt('dipan123@', gen_salt('bf')),
      email_confirmed_at = timezone('utc'::text, now()),
      raw_user_meta_data = '{"full_name":"Dipan (Cashier)","role":"cashier"}'::jsonb,
      updated_at = timezone('utc'::text, now())
    WHERE id = v_user_id;
  END IF;

  -- 2. Upsert into public.users profiles table
  INSERT INTO public.users (id, email, full_name, role, created_at)
  VALUES (
    v_user_id,
    'dipan@gmail.com',
    'Dipan (Cashier)',
    'cashier',
    timezone('utc'::text, now())
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role;

END $$;
