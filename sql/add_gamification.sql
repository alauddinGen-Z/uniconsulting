-- Gamification System (XP Points & Levels)
-- Add XP tracking columns to profiles

-- Add XP columns to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS xp_points INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 1;

-- Function to award XP and auto-level up
CREATE OR REPLACE FUNCTION award_xp(user_id UUID, points INTEGER)
RETURNS TABLE(new_xp INTEGER, new_level INTEGER, leveled_up BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_xp INTEGER;
    current_level INTEGER;
    calculated_level INTEGER;
    level_thresholds INTEGER[] := ARRAY[0, 100, 300, 600, 1000, 1500, 2500, 4000];
BEGIN
    -- Get current XP
    SELECT xp_points, p.level INTO current_xp, current_level
    FROM profiles p WHERE p.id = user_id;
    
    -- Calculate new XP
    new_xp := COALESCE(current_xp, 0) + points;
    
    -- Calculate new level based on thresholds
    calculated_level := 1;
    FOR i IN 1..array_length(level_thresholds, 1) LOOP
        IF new_xp >= level_thresholds[i] THEN
            calculated_level := i;
        END IF;
    END LOOP;
    
    new_level := calculated_level;
    leveled_up := calculated_level > COALESCE(current_level, 1);
    
    -- Update profile
    UPDATE profiles 
    SET xp_points = new_xp, level = new_level
    WHERE id = user_id;
    
    RETURN NEXT;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION award_xp(UUID, INTEGER) TO authenticated;
