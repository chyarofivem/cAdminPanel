/**
 * Native `<select>` styled like the Input primitive: sunken fill, hairline ring,
 * 14px white text and the accent text focus ring. Options sit on the menu surface
 * so the open list stays opaque in every browser, including the in-game one.
 */
export const nativeSelectClass = 'h-11 w-full rounded-sm bg-sunken px-3 text-sm text-white ring-1 ring-inset ring-hairline transition-shadow duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-text disabled:cursor-not-allowed disabled:opacity-50 [&>option]:bg-menu';
