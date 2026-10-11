/**
 * Shared chrome for every monaco editor in the panel (the CFG editor and the setup wizard).
 * Monaco cannot read CSS custom properties, so these are the design tokens resolved to hex:
 * - the editor body and the gutter are `--sunken` over the page background, so the line
 *   number strip never reads as a separate lighter surface glued to the side of the editor;
 * - line numbers use `--text-faint`, the active one `--text-body`;
 * - widgets use `--menu` with a `--hairline` edge;
 * - selection and scrollbars use the neutral `--raise-*` layers, because the accent is chosen
 *   at runtime and a hard-coded accent here would drift from it.
 */
export const editorThemeColors: Record<string, string> = {
    'editor.background': '#0d0f13',
    'editor.foreground': '#d1d5db',
    'editorGutter.background': '#0d0f13',
    'editorLineNumber.foreground': '#71717a',
    'editorLineNumber.activeForeground': '#d1d5db',
    'editorWidget.background': '#181a1e',
    'editorWidget.border': '#ffffff0d',
    'editor.selectionBackground': '#ffffff26',
    'editor.inactiveSelectionBackground': '#ffffff1a',
    'editor.lineHighlightBackground': '#ffffff0a',
    'editor.lineHighlightBorder': '#00000000',
    'scrollbarSlider.background': '#ffffff1a',
    'scrollbarSlider.hoverBackground': '#ffffff26',
    'scrollbarSlider.activeBackground': '#ffffff33',
};
