-- ============================================================
-- 041_inbox_assignment_filters.sql
--
-- Server-backed Inbox assignment partitions. The caller selects only
-- the partition name; "mine" is always resolved from auth.uid() in the
-- database, never from a client-provided agent id. SECURITY INVOKER keeps
-- the existing conversation RLS policies as the permission boundary.
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_conversations_account_assignment_last_message
  ON public.conversations (
    account_id,
    assigned_agent_id,
    last_message_at DESC NULLS LAST
  );

CREATE OR REPLACE FUNCTION public.inbox_conversations(
  p_assignment_filter TEXT DEFAULT 'all'
)
RETURNS SETOF public.conversations
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF p_assignment_filter IS NULL
     OR p_assignment_filter NOT IN ('all', 'mine', 'unassigned') THEN
    RAISE EXCEPTION 'Invalid Inbox assignment filter: %', p_assignment_filter
      USING ERRCODE = '22023';
  END IF;

  -- RLS is evaluated because this function runs as the caller. That applies
  -- the account/role visibility rules before this assignment partition.
  RETURN QUERY
  SELECT c.*
  FROM public.conversations c
  WHERE p_assignment_filter = 'all'
     OR (
       p_assignment_filter = 'mine'
       AND c.assigned_agent_id = auth.uid()
     )
     OR (
       p_assignment_filter = 'unassigned'
       AND c.assigned_agent_id IS NULL
     )
  ORDER BY c.last_message_at DESC NULLS LAST, c.id DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.inbox_assignment_counts()
RETURNS TABLE (
  all_count BIGINT,
  mine_count BIGINT,
  unassigned_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  -- As above, invoker RLS restricts this aggregate to exactly the rows the
  -- current member may already view. auth.uid() then resolves "mine" here.
  SELECT
    COUNT(*)::BIGINT AS all_count,
    COUNT(*) FILTER (WHERE c.assigned_agent_id = auth.uid())::BIGINT
      AS mine_count,
    COUNT(*) FILTER (WHERE c.assigned_agent_id IS NULL)::BIGINT
      AS unassigned_count
  FROM public.conversations c;
$$;

REVOKE ALL ON FUNCTION public.inbox_conversations(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.inbox_assignment_counts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.inbox_conversations(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.inbox_assignment_counts() TO authenticated, service_role;
