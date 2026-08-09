/**
 * Shared style primitives for the in-game panel, mirroring the web panel's
 * "at a glance" surfaces: translucent cards, hairline rings, dashed dividers
 * and small uppercase micro-labels. Accent colors are pulled from the active
 * theme palette instead of being hardcoded here, so redm stays on brand.
 */
export const nuiTokens = {
    surface: 'rgba(255,255,255,0.065)',
    surfaceRaised: 'rgba(255,255,255,0.085)',
    surfaceHover: 'rgba(255,255,255,0.11)',
    ring: 'rgba(255,255,255,0.12)',
    ringStrong: 'rgba(255,255,255,0.18)',
    dashedBorder: '1px dashed rgba(255,255,255,0.13)',
    radius: 16,
    radiusSm: 12,
    radiusXs: 10,
    panelWidth: 372,
} as const;

export const microLabel = {
    fontSize: 11,
    fontWeight: 550,
    lineHeight: 1.35,
    letterSpacing: '0.025em',
} as const;
