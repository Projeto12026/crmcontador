-- Add productivity strategy fields to tasks table
ALTER TABLE public.tasks
ADD COLUMN is_important boolean DEFAULT false,
ADD COLUMN is_urgent boolean DEFAULT false,
ADD COLUMN is_frog boolean DEFAULT false,
ADD COLUMN ivy_lee_order integer DEFAULT null,
ADD COLUMN is_focus_list boolean DEFAULT false,
ADD COLUMN enabled_views text[] DEFAULT ARRAY['list', 'eisenhower', 'kanban', 'two_lists', 'eat_frog', 'ivy_lee']::text[];

-- Add comment explaining the fields
COMMENT ON COLUMN public.tasks.is_important IS 'Eisenhower Matrix: marks task as important';
COMMENT ON COLUMN public.tasks.is_urgent IS 'Eisenhower Matrix: marks task as urgent';
COMMENT ON COLUMN public.tasks.is_frog IS 'Eat the Frog: marks this as the most difficult/important task to do first';
COMMENT ON COLUMN public.tasks.ivy_lee_order IS 'Ivy Lee Method: priority order 1-6 for daily tasks';
COMMENT ON COLUMN public.tasks.is_focus_list IS 'Two Lists Strategy: true = focus list, false = backlog';
COMMENT ON COLUMN public.tasks.enabled_views IS 'Array of view names where this task should appear';