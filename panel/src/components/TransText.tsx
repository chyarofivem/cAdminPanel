import { Fragment, type ReactNode } from 'react';
import InlineCode from './InlineCode';
import TxAnchor from './TxAnchor';
import { t } from '@/lib/i18n';


//Inline markup, so a whole user-visible sentence stays a single dictionary key instead of
//being split across JSX children (which would leave translators with unorderable fragments).
//  `code`        -> <InlineCode>
//  **bold**      -> <strong>
//  *italic*      -> <i>
//  [label](href) -> <TxAnchor>
//  \n            -> <br />
const markupRe = /`([^`]+)`|\*\*([^*]+)\*\*|\*([^*]+)\*|\[([^\]]+)\]\(([^)\s]+)\)/g;

export function renderInlineMarkup(text: string): ReactNode {
    const parts: ReactNode[] = [];
    let lastIndex = 0;
    let key = 0;

    const pushText = (raw: string) => {
        if (!raw) return;
        const lines = raw.split('\n');
        lines.forEach((line, index) => {
            if (index) parts.push(<br key={`br-${key++}`} />);
            if (line) parts.push(line);
        });
    };

    let match: RegExpExecArray | null;
    markupRe.lastIndex = 0;
    while ((match = markupRe.exec(text))) {
        pushText(text.slice(lastIndex, match.index));
        lastIndex = match.index + match[0].length;
        const [, code, bold, italic, linkLabel, linkHref] = match;
        if (code !== undefined) {
            parts.push(<InlineCode key={key++}>{code}</InlineCode>);
        } else if (bold !== undefined) {
            parts.push(<strong key={key++}>{bold}</strong>);
        } else if (italic !== undefined) {
            parts.push(<i key={key++}>{italic}</i>);
        } else {
            parts.push(<TxAnchor key={key++} href={linkHref}>{linkLabel}</TxAnchor>);
        }
    }
    pushText(text.slice(lastIndex));

    return parts.map((part, index) => <Fragment key={index}>{part}</Fragment>);
}


type TransTextProps = {
    /** The english source string, which doubles as the dictionary key. */
    k: string;
    values?: Record<string, string | number>;
};

/**
 * Renders a translated string that contains inline markup.
 * For plain strings, just call `t()` directly.
 */
export default function TransText({ k, values }: TransTextProps) {
    return <>{renderInlineMarkup(t(k, values))}</>;
}
