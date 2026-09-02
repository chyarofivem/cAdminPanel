/**
 * Shared chrome for every monaco editor in the panel (the CFG editor and the setup wizard).
 * The gutter deliberately uses the same color as the editor body, otherwise the line number
 * strip reads as a separate lighter surface glued to the side of the card.
 */
export const editorThemeColors: Record<string, string> = {
    'editor.background': '#0b0d11',
    'editorGutter.background': '#0b0d11',
    'editorLineNumber.foreground': '#5b5f6b',
    'editorLineNumber.activeForeground': '#d4d4d8',
    'editorWidget.background': '#111318',
    'editorWidget.border': '#ffffff14',
    'editor.selectionBackground': '#3b82f633',
    'editor.lineHighlightBackground': '#ffffff08',
    'editor.lineHighlightBorder': '#00000000',
    'scrollbarSlider.background': '#ffffff12',
    'scrollbarSlider.hoverBackground': '#ffffff20',
    'scrollbarSlider.activeBackground': '#ffffff2e',
};
