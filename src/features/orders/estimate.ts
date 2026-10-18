import type { ArchitectRow, ContractRow } from '@/types/database';

/**
 * Indicatie van de commissie tijdens het invoeren van een order.
 *
 * LET OP: dit is een SPIEGEL van calculate_commission(order_id) in
 * supabase/migrations/..._commission.sql. Die functie is de enige waarheid —
 * zij vult de ledger. Deze versie bestaat alleen omdat er tijdens het invoeren
 * nog geen order-id is om de database mee te bevragen.
 *
 * Wijzigt de formule? Pas dan allebei aan, en laat
 * supabase/tests/02_commission_test.sql de SQL-kant bewaken.
 */
export type EstimateInput = {
  lines: { advice_price: number; sale_price: number }[];
  architect: Pick<
    ArchitectRow,
    'origin' | 'transferred_at' | 'excluded_from_commission' | 'claim_status'
  > | null;
  contract: Pick<
    ContractRow,
    'own_commission_pct' | 'transferred_commission_pct' | 'price_tolerance_pct'
  > | null;
  orderDate: string;
};

export type Estimate = {
  eligible: boolean;
  reason: string | null;
  adviceTotal: number;
  saleTotal: number;
  discount: number;
  tolerance: number;
  discountDeduction: number;
  pct: number;
  commission: number;
};

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function estimateCommission(input: EstimateInput): Estimate {
  const adviceTotal = round2(
    input.lines.reduce((sum, line) => sum + (line.advice_price || 0), 0),
  );
  const saleTotal = round2(
    input.lines.reduce((sum, line) => sum + (line.sale_price || 0), 0),
  );
  const discount = Math.max(0, round2(adviceTotal - saleTotal));

  const base: Estimate = {
    eligible: false,
    reason: null,
    adviceTotal,
    saleTotal,
    discount,
    tolerance: 0,
    discountDeduction: 0,
    pct: 0,
    commission: 0,
  };

  const { architect, contract } = input;

  if (!architect || !contract) {
    return { ...base, reason: 'no_contract' };
  }
  if (architect.excluded_from_commission) {
    return { ...base, reason: 'architect_excluded' };
  }
  if (architect.claim_status !== 'agent') {
    return { ...base, reason: 'claim_not_with_agent' };
  }
  if (
    architect.origin === 'koreman_transferred' &&
    (!architect.transferred_at || input.orderDate < architect.transferred_at)
  ) {
    return { ...base, reason: 'order_before_transfer' };
  }

  const pct =
    architect.origin === 'agent_signed'
      ? Number(contract.own_commission_pct)
      : Number(contract.transferred_commission_pct);

  const tolerance = round2((adviceTotal * Number(contract.price_tolerance_pct)) / 100);
  const discountDeduction = Math.max(0, round2(discount - tolerance));
  const commission = Math.max(0, round2(round2((adviceTotal * pct) / 100) - discountDeduction));

  return {
    eligible: true,
    reason: null,
    adviceTotal,
    saleTotal,
    discount,
    tolerance,
    discountDeduction,
    pct,
    commission,
  };
}
