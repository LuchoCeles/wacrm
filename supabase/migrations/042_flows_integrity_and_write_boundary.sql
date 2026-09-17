-- ============================================================
-- Flows integrity and write-boundary hardening.
--
-- Flow definitions are authored through /api/flows, where the request
-- is authenticated, role-checked and validated. Before this migration,
-- an agent could bypass that boundary through the browser's Supabase
-- client: the agent RLS policies allowed direct edits to flows and
-- flow_nodes, including setting an invalid graph straight to `active`.
--
-- This migration keeps read access unchanged, moves definition writes
-- behind the existing server route, and exposes one service-role-only
-- transaction for replacing a flow and its graph. Constraint errors no
-- longer leave a flow with all of its nodes deleted.
-- ============================================================

-- Browser clients may inspect flows, nodes and run history through their
-- existing SELECT policies, but writes must use the authenticated API.
DROP POLICY IF EXISTS flows_insert ON flows;
DROP POLICY IF EXISTS flows_update ON flows;
DROP POLICY IF EXISTS flows_delete ON flows;
DROP POLICY IF EXISTS flow_nodes_modify ON flow_nodes;

-- Atomically apply a definition patch and replace its graph. The API
-- validates p_flow_patch / p_nodes before calling this function; these
-- shape checks are defense in depth for service integrations and make a
-- malformed RPC call fail before deleting the previous graph.
CREATE OR REPLACE FUNCTION replace_flow_definition(
  p_flow_id UUID,
  p_flow_patch JSONB,
  p_nodes JSONB
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_node JSONB;
BEGIN
  IF jsonb_typeof(p_flow_patch) <> 'object' THEN
    RAISE EXCEPTION 'p_flow_patch must be a JSON object';
  END IF;
  IF jsonb_typeof(p_nodes) <> 'array' THEN
    RAISE EXCEPTION 'p_nodes must be a JSON array';
  END IF;

  UPDATE flows
  SET
    name = CASE
      WHEN p_flow_patch ? 'name' THEN p_flow_patch->>'name'
      ELSE name
    END,
    description = CASE
      WHEN p_flow_patch ? 'description' THEN p_flow_patch->>'description'
      ELSE description
    END,
    trigger_type = CASE
      WHEN p_flow_patch ? 'trigger_type' THEN p_flow_patch->>'trigger_type'
      ELSE trigger_type
    END,
    trigger_config = CASE
      WHEN p_flow_patch ? 'trigger_config' THEN p_flow_patch->'trigger_config'
      ELSE trigger_config
    END,
    entry_node_id = CASE
      WHEN p_flow_patch ? 'entry_node_id' THEN p_flow_patch->>'entry_node_id'
      ELSE entry_node_id
    END,
    fallback_policy = CASE
      WHEN p_flow_patch ? 'fallback_policy' THEN p_flow_patch->'fallback_policy'
      ELSE fallback_policy
    END,
    updated_at = NOW()
  WHERE id = p_flow_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'flow % was not found', p_flow_id USING ERRCODE = 'P0002';
  END IF;

  -- Verify every item before mutating the old rows. The API applies the
  -- stricter domain validation (known node types, unique keys, integer
  -- positions); this prevents a hand-crafted RPC request from erasing a
  -- graph before an obvious shape error is raised.
  FOR v_node IN SELECT value FROM jsonb_array_elements(p_nodes)
  LOOP
    IF jsonb_typeof(v_node) <> 'object'
      OR jsonb_typeof(v_node->'config') <> 'object'
      OR COALESCE(v_node->>'node_key', '') = ''
      OR COALESCE(v_node->>'node_type', '') = ''
    THEN
      RAISE EXCEPTION 'each node must contain node_key, node_type and an object config';
    END IF;
  END LOOP;

  DELETE FROM flow_nodes WHERE flow_id = p_flow_id;

  INSERT INTO flow_nodes (
    flow_id,
    node_key,
    node_type,
    config,
    position_x,
    position_y
  )
  SELECT
    p_flow_id,
    item.value->>'node_key',
    item.value->>'node_type',
    item.value->'config',
    COALESCE((item.value->>'position_x')::INTEGER, 0),
    COALESCE((item.value->>'position_y')::INTEGER, 0)
  FROM jsonb_array_elements(p_nodes) AS item(value);
END;
$$;

ALTER FUNCTION replace_flow_definition(UUID, JSONB, JSONB) OWNER TO postgres;
REVOKE ALL ON FUNCTION replace_flow_definition(UUID, JSONB, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION replace_flow_definition(UUID, JSONB, JSONB) FROM anon;
REVOKE ALL ON FUNCTION replace_flow_definition(UUID, JSONB, JSONB) FROM authenticated;
GRANT EXECUTE ON FUNCTION replace_flow_definition(UUID, JSONB, JSONB) TO service_role;

-- Flow media is public so WhatsApp can fetch it, therefore allowing a
-- viewer to upload arbitrary files is an unnecessary public-storage and
-- abuse surface. Definition creation already requires agent+, so align
-- upload/update/delete permissions with that same role.
DROP POLICY IF EXISTS "Members can upload flow media" ON storage.objects;
CREATE POLICY "Members can upload flow media"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'flow-media'
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.account_role IN ('owner', 'admin', 'agent')
        AND (
          ('account-' || p.account_id::text) = (storage.foldername(name))[1]
          OR auth.uid()::text = (storage.foldername(name))[1]
        )
    )
  );

DROP POLICY IF EXISTS "Members can update flow media" ON storage.objects;
CREATE POLICY "Members can update flow media"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'flow-media'
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.account_role IN ('owner', 'admin', 'agent')
        AND (
          ('account-' || p.account_id::text) = (storage.foldername(name))[1]
          OR auth.uid()::text = (storage.foldername(name))[1]
        )
    )
  )
  WITH CHECK (
    bucket_id = 'flow-media'
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.account_role IN ('owner', 'admin', 'agent')
        AND (
          ('account-' || p.account_id::text) = (storage.foldername(name))[1]
          OR auth.uid()::text = (storage.foldername(name))[1]
        )
    )
  );

DROP POLICY IF EXISTS "Members can delete flow media" ON storage.objects;
CREATE POLICY "Members can delete flow media"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'flow-media'
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.account_role IN ('owner', 'admin', 'agent')
        AND (
          ('account-' || p.account_id::text) = (storage.foldername(name))[1]
          OR auth.uid()::text = (storage.foldername(name))[1]
        )
    )
  );
