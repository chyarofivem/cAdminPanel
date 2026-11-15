import React from "react";

/**
 * The handful of icons the menu uses, all from one outline set (lucide) at
 * stroke 1.75 in currentColor. The quick-action icons (close, refresh, copy) are
 * always rendered through IconButton; the status icons sit in callouts and
 * toasts next to their words, and the check marks the selected select option.
 * The size comes from the surrounding component class in menu.css.
 */
const Svg: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    {children}
  </svg>
);

export const CloseIcon = () => (
  <Svg><path d="M18 6 6 18" /><path d="m6 6 12 12" /></Svg>
);

export const RefreshIcon = () => (
  <Svg>
    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
    <path d="M21 3v5h-5" />
    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
    <path d="M8 16H3v5" />
  </Svg>
);

export const CopyIcon = () => (
  <Svg>
    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
  </Svg>
);

export const CheckIcon = () => (
  <Svg><path d="M20 6 9 17l-5-5" /></Svg>
);

/** Status: warning. */
export const AlertTriangleIcon = () => (
  <Svg>
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
    <path d="M12 9v4" />
    <path d="M12 17h.01" />
  </Svg>
);

/** Status: error. */
export const CircleXIcon = () => (
  <Svg>
    <circle cx="12" cy="12" r="10" />
    <path d="m15 9-6 6" />
    <path d="m9 9 6 6" />
  </Svg>
);

/** Status: success. */
export const CircleCheckIcon = () => (
  <Svg>
    <circle cx="12" cy="12" r="10" />
    <path d="m9 12 2 2 4-4" />
  </Svg>
);

/** Status: info. */
export const InfoCircleIcon = () => (
  <Svg>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16v-4" />
    <path d="M12 8h.01" />
  </Svg>
);
