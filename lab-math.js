/**
 * Pure Scientific & Engineering Models for Elephant Poop Science & Bio-Lab
 * Decoupled for browser use (window.LabMath) and Node unit testing (module.exports).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.LabMath = factory();
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const SUBSTRATE_PROFILES = {
    composted: {
      W: 0.48,
      C: 0.42,
      N: 0.028,
      whc: 400,
      label: 'Термофильно компостированный субстрат (C:N 15:1)'
    },
    'raw-wet': {
      W: 0.78,
      C: 0.45,
      N: 0.015,
      whc: 420,
      label: 'Сырой навоз влажного сезона C₄ (C:N 30:1)'
    },
    'raw-dry': {
      W: 0.70,
      C: 0.50,
      N: 0.010,
      whc: 460,
      label: 'Сырой навоз сухого сезона C₃ (C:N 50:1)'
    }
  };

  /**
   * Computes (C:N)_mix, nitrogen deficit ΔN, urea/nitrate doses, soil bulk density,
   * field capacity FC_mix, and Penman-Monteith evaporation attenuation.
   */
  function calculateMassBalance(params) {
    const profileKey = params && params.profileKey ? params.profileKey : 'raw-dry';
    const profile = SUBSTRATE_PROFILES[profileKey] || SUBSTRATE_PROFILES['raw-dry'];
    const mSoil = Math.max(0, Number(params && params.mSoil != null ? params.mSoil : 10));
    const mSub = Math.max(0.1, Number(params && params.mSub != null ? params.mSub : 1));
    const targetCn = Math.max(5, Number(params && params.targetCn != null ? params.targetCn : 20));
    const hMulch = Math.max(0, Number(params && params.hMulch != null ? params.hMulch : 3));

    const cSoil = 0.0116;
    const nSoil = 0.0010;
    const mSubDry = mSub * (1 - profile.W);

    const totalC = mSoil * cSoil + mSubDry * profile.C;
    const totalN = mSoil * nSoil + mSubDry * profile.N;
    const cnMix = totalC / Math.max(totalN, 0.00001);

    const rawDeltaN = ((mSubDry * profile.C) / targetCn - mSubDry * profile.N) * 1000;
    const deltaNGrams = Math.max(0, rawDeltaN);
    const ureaGrams = deltaNGrams / 0.46;
    const nitrateGrams = deltaNGrams / 0.34;

    const totalDryMass = mSoil + mSubDry;
    const xOrg = totalDryMass > 0 ? mSubDry / totalDryMass : 1;
    const fcMix = 28.0 * (1 - xOrg) + profile.whc * xOrg;
    const bulkDensity = +(1.45 - Math.min(0.35, xOrg * 1.9)).toFixed(2);

    const E0 = 6.0;
    const beta = 0.38;
    const E = E0 * Math.exp(-beta * hMulch);
    const evapReductionPct = (1 - E / E0) * 100;

    return {
      profile,
      mSoil,
      mSub,
      targetCn,
      hMulch,
      mSubDry,
      totalC,
      totalN,
      cnMix,
      deltaNGrams,
      ureaGrams,
      nitrateGrams,
      xOrg,
      fcMix,
      bulkDensity,
      E0,
      beta,
      E,
      evapReductionPct
    };
  }

  /**
   * Computes alkaline delignification & paper tensile strength metrics.
   */
  function calculatePaperDelignification(params) {
    const naoh = Number(params && params.naoh != null ? params.naoh : 2.0);
    const temp = Number(params && params.temp != null ? params.temp : 100);
    const timeMin = Number(params && params.timeMin != null ? params.timeMin : 300);
    const musaRatio = Number(params && params.musaRatio != null ? params.musaRatio : 0.40);

    const tempFactor = Math.max(0.2, (temp - 70) / 30);
    const timeFactor = timeMin / 300;
    const alkaliFactor = naoh / 2.0;

    const ligninRemoval = Math.min(96.0, +(42.0 + 36.5 * tempFactor * Math.sqrt(timeFactor * alkaliFactor)).toFixed(1));

    let fiberDamage = 2.0 + Math.max(0, (naoh - 1.5) * 2.2) + Math.max(0, (temp - 98) * 0.55) + (timeMin / 300) * 1.2;
    if (naoh > 3.2 || temp > 105) fiberDamage += 7.5;
    fiberDamage = +Math.min(45.0, fiberDamage).toFixed(1);

    let odorIndex = 4.5 / (tempFactor * timeFactor * Math.max(0.4, alkaliFactor));
    if (temp >= 98 && timeMin >= 240 && naoh >= 1.5) {
      odorIndex = Math.min(0.45, odorIndex * 0.18);
    }
    odorIndex = +Math.max(0.05, odorIndex).toFixed(2);

    const musaBonus = 16.0 * (1 - Math.abs(musaRatio - 0.40) * 2.4);
    const deligBonus = Math.min(18.0, (ligninRemoval / 75.0) * 16.5);
    const damagePenalty = Math.max(0, (fiberDamage - 5.0) * 1.15);
    const tensileMPa = +Math.max(8.0, deligBonus + musaBonus - damagePenalty).toFixed(1);

    const yieldKg = +(12.0 * (0.76 - fiberDamage * 0.004)).toFixed(1);
    const sheetsA4 = Math.round(yieldKg * 19.1);

    return {
      rawFiberInputGrams: 12000,
      liquorRatio: 9,
      naohConcentrationPercent: naoh,
      cookingTemperatureC: temp,
      cookingTimeMinutes: timeMin,
      bananaPseudoStemRatio: musaRatio,
      ligninRemovalPercent: ligninRemoval,
      celluloseYieldGrams: yieldKg * 1000,
      yieldKg,
      sheetsA4,
      fiberDamageAlphaLossPercent: fiberDamage,
      residualOdorIndex: odorIndex,
      sheetTensileStrengthMPa: tensileMPa
    };
  }

  return {
    SUBSTRATE_PROFILES,
    calculateMassBalance,
    calculatePaperDelignification
  };
}));
