/**
 * Logika korzyści podatkowych dla faktur zakupowych.
 * Obliczenia zgodne ze skalą podatkową (PIT, składka zdrowotna, VAT).
 * Moduł zaprojektowany tak, aby w przyszłości można było dodać inne formy opodatkowania.
 */

const round2 = (n: number): number => Math.round(n * 100) / 100;

function toNum(v: number | null | undefined): number {
  if (v == null || Number.isNaN(v)) return 0;
  return Number(v);
}

export type CompanyTaxConfig = {
  /** Stawka PIT – skala (np. 0.12 lub 0.32) */
  pitRate: number;
  /** Stawka składki zdrowotnej (np. 0.09) */
  healthRate: number;
  /** Czy firma jest płatnikiem VAT */
  isVatPayer: boolean;
};

/** Kontekst samochodu – gdy wydatek przypisany do samochodu */
export type CarTaxContext = {
  value: number; // wartość samochodu w PLN (do wyboru progu)
  limit100k: number;
  limit150k: number;
  limit200k: number;
  vatDeductionPercent: number; // 0.5 lub 1
};

export type PurchaseInvoiceTaxInput = {
  grossAmount: number | null | undefined;
  netAmount: number | null | undefined;
  vatAmount: number | null | undefined;
  /** Udział VAT do odliczenia (1.0 = 100%, 0.5 = 50%) – domyślnie 1.0; nadpisywane przez car */
  vatDeductionPercent?: number | null;
  /** Udział kosztu do odliczenia (1.0 = 100%, 0.75 = 75%) – domyślnie 1.0 */
  costDeductionPercent?: number | null;
  /** Gdy ustawione – wydatek samochodowy: używane VAT % i limit kosztu (progi 100/150/200 tys.) */
  car?: CarTaxContext | null;
  /** Faktura ujęta w kosztach – brak korzyści podatkowej */
  includedInCosts?: boolean;
};

export type PurchaseInvoiceTaxResult = {
  vatRecovered: number;
  costBase: number;
  incomeTaxSaving: number;
  healthSaving: number;
  totalTaxBenefit: number;
  realCost: number;
};

/**
 * Zwraca limit odliczenia kosztu dla samochodu (progi 100 / 150 / 200 tys. po wartości).
 */
export function getCarCostLimit(car: CarTaxContext): number {
  const v = car.value;
  if (v <= 100_000) return toNum(car.limit100k) || 100_000;
  if (v <= 150_000) return toNum(car.limit150k) || 150_000;
  return toNum(car.limit200k) || 200_000;
}

/**
 * Proporcja do limitu KUP: limit / wartość pojazdu (np. 100 000 / 117 000 = 85,47%).
 * Stosowana do każdej raty/wydatku – do kosztów podatkowych trafia (netto + nieodliczony VAT) × proporcja.
 */
export function getCarCostProportion(car: CarTaxContext): number {
  const limit = getCarCostLimit(car);
  const value = toNum(car.value);
  if (value <= 0) return 1;
  return Math.min(1, limit / value);
}

/**
 * Oblicza korzyści podatkowe dla faktury zakupowej (skala podatkowa).
 * Wartości null/undefined traktowane jako 0; wynik zaokrąglony do 2 miejsc po przecinku.
 * Gdy input.car jest ustawione – stosowane są stawki i limit kosztu dla wydatku samochodowego.
 */
export function computePurchaseInvoiceTaxBenefit(
  input: PurchaseInvoiceTaxInput,
  config: CompanyTaxConfig
): PurchaseInvoiceTaxResult {
  if (input.includedInCosts === true) {
    return {
      vatRecovered: 0,
      costBase: 0,
      incomeTaxSaving: 0,
      healthSaving: 0,
      totalTaxBenefit: 0,
      realCost: round2(toNum(input.grossAmount)),
    };
  }
  const gross = toNum(input.grossAmount);
  const net = toNum(input.netAmount);
  const vatAmount = toNum(input.vatAmount);
  const costDeduction = toNum(input.costDeductionPercent);
  const costDeductionPct = costDeduction <= 0 ? 1 : Math.min(1, costDeduction);

  const pitRate = toNum(config.pitRate);
  const healthRate = toNum(config.healthRate);
  const isVatPayer = config.isVatPayer === true;

  let vatDeductionPct: number;
  let costBaseRaw: number;

  if (input.car) {
    vatDeductionPct = input.car.vatDeductionPercent === 1 ? 1 : 0.5;
    // Do kosztów podatkowych: (netto + nieodliczony VAT) × proporcja (limit / wartość pojazdu)
    const costBeforeProportion = net + vatAmount * (1 - vatDeductionPct);
    const proportion = getCarCostProportion(input.car);
    costBaseRaw = costBeforeProportion * proportion;
  } else {
    const vatDeduction = toNum(input.vatDeductionPercent);
    vatDeductionPct = vatDeduction <= 0 ? 1 : Math.min(1, vatDeduction);
    costBaseRaw = net * costDeductionPct;
  }

  const vatRecovered = isVatPayer ? round2(vatAmount * vatDeductionPct) : 0;
  const costBase = round2(costBaseRaw);
  const incomeTaxSaving = round2(costBase * pitRate);
  const healthSaving = round2(costBase * healthRate);
  const totalTaxBenefit = round2(vatRecovered + incomeTaxSaving + healthSaving);
  const realCost = round2(gross - totalTaxBenefit);

  return {
    vatRecovered,
    costBase,
    incomeTaxSaving,
    healthSaving,
    totalTaxBenefit,
    realCost,
  };
}
