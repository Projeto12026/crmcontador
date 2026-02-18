
DROP POLICY IF EXISTS "Authenticated users full access" ON public.cash_flow_transactions;

CREATE POLICY "Admin only full access"
  ON public.cash_flow_transactions FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
