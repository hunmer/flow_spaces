// Motion tokens — verbatim from uiarc.dev module 7770 (chunk 95714-07d7cb0e45d9a488.js)
export type CubicBezier = [number, number, number, number];

export const easeEnter: CubicBezier = [0.16, 1, 0.3, 1];
export const easeExit: CubicBezier = [0.7, 0, 0.84, 0];
export const easeStandard: CubicBezier = [0.22, 1, 0.36, 1];
export const easeInOut: CubicBezier = [0.65, 0, 0.35, 1];

export const tokens = {
  duration: { instant: 0.12, fast: 0.16, exit: 0.18, standard: 0.24, considered: 0.48 },
  ease: { enter: easeEnter, exit: easeExit, standard: easeStandard, inOut: easeInOut },
  spring: {
    responsive: { type: "spring", stiffness: 520, damping: 44 },
    gentle: { type: "spring", stiffness: 340, damping: 34 },
    snappy: { type: "spring", visualDuration: 0.26, bounce: 0 },
    smooth: { type: "spring", visualDuration: 0.4, bounce: 0 },
    morph: { type: "spring", visualDuration: 0.42, bounce: 0 },
  },
  stagger: { char: 0.016, word: 0.04, line: 0.08, item: 0.035 },
  blur: { subtle: 2, soft: 4, text: 8 },
} as const;

export const T = tokens;
