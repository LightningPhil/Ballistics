/**
 * ============================================================================
 * rocket_propellants.js — Propellant Registry & Performance Tables
 * ============================================================================
 *
 * ROLE:  Contains the complete propellant library (metadata + slider bounds)
 *        and placeholder CEA-derived performance lookup/interpolation.
 *        No DOM access — pure data.
 *
 * EXPORTS (via window.RocketPropellants namespace):
 *   REGISTRY         — Array of propellant definition objects
 *   getById(id)      — Look up a propellant by ID string
 *   lookupPerformance(id, MR, Pc_Pa, epsilon, Pa_Pa)
 *                    — Returns { cStar, Cf } (m/s, dimensionless)
 *
 * Placeholder grids use analytical isentropic approximations that give
 * reasonable "shape" for teaching. When real CEA JSON files are loaded
 * later, the lookupPerformance function will switch to interpolated data
 * automatically.
 *
 * LOADED BY: <script src="rocket_propellants.js"> in index.html
 *            (before rocket_physics.js)
 * ============================================================================
 */

(function () {
  'use strict';

  // ── Constants ──────────────────────────────────────────────────────────────
  var G0 = 9.80665; // standard gravity (m/s²)

  // ── Propellant Registry ────────────────────────────────────────────────────
  //
  // Each entry follows the schema from rocket_lab_single_source_of_truth.md
  // Appendix B.  Fields:
  //   id            Unique string key
  //   name          Human-readable name
  //   category      'cryogenic' | 'storable' | 'educational'
  //   MR_bounds     [min, max] O/F ratio slider bounds
  //   MR_default    Default O/F ratio
  //   Pc_bar_bounds [min, max] chamber pressure in bar
  //   eps_bounds    [min, max] expansion ratio
  //   notes         Array of UI info strings
  //   anchor        { MR, Isp_vac_s, Isp_sl_s } — sanity-check anchor point
  //                 (from published textbook values, NOT used as runtime model)
  //   placeholder   { gamma, molWt, Tc_K } — approximate values for the
  //                 analytical placeholder model until real CEA grids arrive
  //

  var REGISTRY = [
    // ─── Cryogenic ───
    {
      id: 'LOX_LH2',
      name: 'LOX / LH\u2082',
      category: 'cryogenic',
      MR_bounds: [4.5, 6.5],
      MR_default: 5.5,
      Pc_bar_bounds: [10, 300],
      eps_bounds: [5, 200],
      notes: [
        'Highest Isp class; very low-density LH\u2082; large tanks.',
        'Many engines run MR \u22485.5\u20136.0 for cooling/cycle reasons.'
      ],
      anchor: { MR: 5.5, Isp_vac_s: 455, Isp_sl_s: 365 },
      placeholder: { gamma: 1.22, molWt: 12.0, Tc_K: 3500 }
    },
    {
      id: 'LOX_CH4',
      name: 'LOX / CH\u2084',
      category: 'cryogenic',
      MR_bounds: [3.0, 4.0],
      MR_default: 3.5,
      Pc_bar_bounds: [10, 300],
      eps_bounds: [5, 200],
      notes: [
        'Mid-high Isp; denser than LH\u2082; good for reusability.',
        'Clean combustion; good compromise propellant.'
      ],
      anchor: { MR: 3.5, Isp_vac_s: 365, Isp_sl_s: 310 },
      placeholder: { gamma: 1.18, molWt: 21.0, Tc_K: 3550 }
    },
    {
      id: 'LOX_RP1',
      name: 'LOX / RP\u20111',
      category: 'cryogenic',
      MR_bounds: [2.2, 2.9],
      MR_default: 2.56,
      Pc_bar_bounds: [10, 300],
      eps_bounds: [5, 200],
      notes: [
        'Great liftoff thrust for given tank size.',
        'Lower Isp than CH\u2084/LH\u2082 but very practical.'
      ],
      anchor: { MR: 2.56, Isp_vac_s: 338, Isp_sl_s: 295 },
      placeholder: { gamma: 1.18, molWt: 23.0, Tc_K: 3600 }
    },

    // ─── Storables / Hypergolics ───
    {
      id: 'N2O4_MMH',
      name: 'N\u2082O\u2084 / MMH',
      category: 'storable',
      MR_bounds: [1.8, 2.3],
      MR_default: 2.0,
      Pc_bar_bounds: [10, 300],
      eps_bounds: [5, 200],
      notes: [
        'Lower Isp than cryogenics; excellent storability.',
        'Hypergolic ignition; common for spacecraft thrusters.'
      ],
      anchor: { MR: 2.0, Isp_vac_s: 326, Isp_sl_s: 280 },
      placeholder: { gamma: 1.22, molWt: 22.0, Tc_K: 3250 }
    },
    {
      id: 'N2O4_UDMH',
      name: 'N\u2082O\u2084 / UDMH',
      category: 'storable',
      MR_bounds: [1.4, 1.9],
      MR_default: 1.65,
      Pc_bar_bounds: [10, 300],
      eps_bounds: [5, 200],
      notes: [
        'Storable hypergolic; historically common.',
        'Used in many Cold War-era launch vehicles.'
      ],
      anchor: { MR: 1.65, Isp_vac_s: 318, Isp_sl_s: 270 },
      placeholder: { gamma: 1.22, molWt: 23.0, Tc_K: 3150 }
    },
    {
      id: 'N2O4_AZ50',
      name: 'N\u2082O\u2084 / Aerozine\u201150',
      category: 'storable',
      MR_bounds: [1.6, 2.1],
      MR_default: 1.8,
      Pc_bar_bounds: [10, 300],
      eps_bounds: [5, 200],
      notes: [
        'Storable hypergolic blend (50/50 hydrazine + UDMH).',
        'Temperature handling and storage robustness.'
      ],
      anchor: { MR: 1.8, Isp_vac_s: 322, Isp_sl_s: 275 },
      placeholder: { gamma: 1.22, molWt: 22.5, Tc_K: 3200 }
    },

    // ─── Educational ───
    {
      id: 'H2O2_RP1',
      name: 'H\u2082O\u2082 (90%) / RP\u20111',
      category: 'educational',
      MR_bounds: [6, 8],
      MR_default: 7.0,
      Pc_bar_bounds: [10, 300],
      eps_bounds: [5, 200],
      notes: [
        'Interesting "simpler oxidizer" trade study.',
        'Performance depends on peroxide concentration (90% here).'
      ],
      anchor: { MR: 7.0, Isp_vac_s: 300, Isp_sl_s: 255 },
      placeholder: { gamma: 1.20, molWt: 24.0, Tc_K: 2900 }
    },
    {
      id: 'IRFNA_RP1',
      name: 'IRFNA / RP\u20111',
      category: 'educational',
      MR_bounds: [4, 6],
      MR_default: 5.0,
      Pc_bar_bounds: [10, 300],
      eps_bounds: [5, 200],
      notes: [
        'Storable oxidizer pairing; historically important.',
        'Lower performance; unpleasant handling.'
      ],
      anchor: { MR: 5.0, Isp_vac_s: 275, Isp_sl_s: 235 },
      placeholder: { gamma: 1.22, molWt: 26.0, Tc_K: 2700 }
    }
  ];

  // ── Quick ID lookup map ────────────────────────────────────────────────────
  var byId = {};
  for (var i = 0; i < REGISTRY.length; i++) {
    byId[REGISTRY[i].id] = REGISTRY[i];
  }

  function getById(id) {
    return byId[id] || null;
  }

  // ── Placeholder performance model ──────────────────────────────────────────
  //
  // Until real CEA JSON grids are loaded, we use isentropic rocket theory
  // to compute c* and Cf analytically.  This gives the correct "shape" of
  // how performance varies with gamma, Pc, epsilon, and Pa —
  // then we calibrate to the anchor Isp so the numbers feel realistic.
  //
  // The anchor calibration ensures that at (anchor.MR, Pc=100 bar, eps=20,
  // Pa=0) the resulting Isp_vac matches the textbook anchor value.
  //
  // Equations (isentropic, ideal):
  //
  //   c*_ideal = sqrt( (R_u * Tc) / (M * Gamma) )
  //   where Gamma = gamma * (2/(gamma+1))^((gamma+1)/(gamma-1))
  //
  //   pe/pc from expansion ratio via area-Mach relation (Newton iteration)
  //
  //   Cf_ideal = sqrt( 2*gamma^2/(gamma-1) * (2/(gamma+1))^((gamma+1)/(gamma-1))
  //              * (1 - (pe/pc)^((gamma-1)/gamma)) )
  //              + eps * (pe - pa) / pc
  //

  var R_UNIVERSAL = 8314.46; // J/(kmol·K)

  /**
   * Compute ideal c* from gamma, molecular weight (g/mol), and Tc.
   */
  function idealCStar(gamma, molWt, Tc) {
    var g = gamma;
    var M = molWt / 1000; // kg/mol
    var R = R_UNIVERSAL / (molWt); // J/(kg·K)  — note: molWt in g/mol → R_u/molWt
    // Gamma function: gamma * (2/(gamma+1))^((gamma+1)/(gamma-1))
    var exp = (g + 1) / (g - 1);
    var GammaFn = g * Math.pow(2 / (g + 1), exp);
    return Math.sqrt(R * Tc / GammaFn);
  }

  /**
   * Solve the area–Mach relation for exit Mach number given expansion ratio.
   * We want the supersonic solution.
   *
   *   A/A* = (1/Me) * ((2/(gamma+1)) * (1 + (gamma-1)/2 * Me^2))^((gamma+1)/(2*(gamma-1)))
   *
   * Uses Newton iteration.
   */
  function exitMachFromEpsilon(gamma, epsilon) {
    var g = gamma;
    var gp1 = g + 1;
    var gm1 = g - 1;
    var exp = gp1 / (2 * gm1);

    // Area-Mach function: A/A*(M)
    function areaMach(M) {
      var t = 1 + 0.5 * gm1 * M * M;
      return (1 / M) * Math.pow((2 / gp1) * t, exp);
    }

    // Derivative d(A/A*)/dM
    function dAreaMach(M) {
      var t = 1 + 0.5 * gm1 * M * M;
      var A = areaMach(M);
      return A * (-1 / M + gm1 * M * exp / t);
    }

    // Newton iteration starting from a reasonable supersonic guess
    var Me = 1.5 + Math.log(epsilon); // initial guess
    for (var iter = 0; iter < 50; iter++) {
      var f = areaMach(Me) - epsilon;
      var df = dAreaMach(Me);
      if (Math.abs(df) < 1e-15) break;
      var dM = f / df;
      Me = Me - dM;
      if (Me < 1.001) Me = 1.001; // keep supersonic
      if (Math.abs(dM) < 1e-10) break;
    }
    return Me;
  }

  /**
   * Compute pe/pc from exit Mach and gamma.
   *   pe/pc = (1 + (gamma-1)/2 * Me^2)^(-gamma/(gamma-1))
   */
  function exitPressureRatio(gamma, Me) {
    var g = gamma;
    return Math.pow(1 + 0.5 * (g - 1) * Me * Me, -g / (g - 1));
  }

  /**
   * Compute ideal thrust coefficient Cf.
   *
   *   Cf = sqrt( 2*g^2/(g-1) * (2/(g+1))^((g+1)/(g-1))
   *            * (1 - (pe/pc)^((g-1)/g)) )
   *        + epsilon * (pe - pa) / pc
   */
  function idealCf(gamma, epsilon, pe_pc, Pa_Pa, Pc_Pa) {
    var g = gamma;
    var gm1 = g - 1;
    var gp1 = g + 1;
    var term1 = (2 * g * g) / gm1;
    var term2 = Math.pow(2 / gp1, gp1 / gm1);
    var term3 = 1 - Math.pow(pe_pc, gm1 / g);
    var momentumCf = Math.sqrt(Math.max(0, term1 * term2 * term3));
    var pressureCf = epsilon * (pe_pc * Pc_Pa - Pa_Pa) / Pc_Pa;
    return momentumCf + pressureCf;
  }

  /**
   * Build a calibration factor for a propellant so that at its anchor
   * conditions (MR=anchor, Pc=100 bar, eps=20, Pa=0) the resulting Isp
   * matches the textbook anchor Isp_vac.
   */
  function computeCalibrationFactor(prop) {
    var ph = prop.placeholder;
    var anchor = prop.anchor;
    var Pc_Pa = 100e5;  // 100 bar
    var eps = 20;
    var Pa_Pa = 0;      // vacuum

    var cStar = idealCStar(ph.gamma, ph.molWt, ph.Tc_K);
    var Me = exitMachFromEpsilon(ph.gamma, eps);
    var pe_pc = exitPressureRatio(ph.gamma, Me);
    var Cf = idealCf(ph.gamma, eps, pe_pc, Pa_Pa, Pc_Pa);
    var Isp_ideal = (cStar * Cf) / G0;

    // calibration factor: multiply into cStar so Isp matches anchor
    return anchor.Isp_vac_s / Isp_ideal;
  }

  // Pre-compute calibration factors
  var calibrationFactors = {};
  for (var j = 0; j < REGISTRY.length; j++) {
    calibrationFactors[REGISTRY[j].id] = computeCalibrationFactor(REGISTRY[j]);
  }

  /**
   * Look up c* and Cf for a propellant at given conditions.
   *
   * Uses the isentropic placeholder model calibrated to textbook anchors.
   * When real CEA grids are loaded, this will switch to interpolated data.
   *
   * @param {string} id       Propellant ID (e.g. 'LOX_RP1')
   * @param {number} MR       Mixture ratio O/F (currently unused by placeholder —
   *                           performance variation with MR will come with CEA grids)
   * @param {number} Pc_Pa    Chamber pressure in Pascals
   * @param {number} epsilon  Expansion ratio (Ae/At)
   * @param {number} Pa_Pa    Ambient pressure in Pascals (0 for vacuum)
   * @returns {{ cStar: number, Cf: number }} c* in m/s, Cf dimensionless
   */
  function lookupPerformance(id, MR, Pc_Pa, epsilon, Pa_Pa) {
    var prop = byId[id];
    if (!prop) {
      // Fallback: return conservative defaults
      return { cStar: 1500, Cf: 1.5 };
    }

    var ph = prop.placeholder;
    var cal = calibrationFactors[id];

    // c* — calibrated ideal
    var cStarRaw = idealCStar(ph.gamma, ph.molWt, ph.Tc_K);
    var cStar = cStarRaw * cal;

    // Cf — ideal isentropic with pressure thrust term
    var Me = exitMachFromEpsilon(ph.gamma, Math.max(1.01, epsilon));
    var pe_pc = exitPressureRatio(ph.gamma, Me);
    var Cf = idealCf(ph.gamma, Math.max(1.01, epsilon), pe_pc, Pa_Pa, Pc_Pa);

    // Clamp Cf to physical range [0.8, 2.2]
    Cf = Math.max(0.8, Math.min(2.2, Cf));

    return { cStar: cStar, Cf: Cf };
  }

  // ── Expose namespace ───────────────────────────────────────────────────────
  window.RocketPropellants = {
    REGISTRY: REGISTRY,
    getById: getById,
    lookupPerformance: lookupPerformance,
    // Expose internals for testing / future CEA grid loader
    _idealCStar: idealCStar,
    _exitMachFromEpsilon: exitMachFromEpsilon,
    _exitPressureRatio: exitPressureRatio,
    _idealCf: idealCf,
    _calibrationFactors: calibrationFactors
  };

})();
