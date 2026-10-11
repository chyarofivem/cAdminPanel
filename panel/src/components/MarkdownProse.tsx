import { isValidElement, type ReactNode } from 'react';
import { cn, stripIndent } from '@/lib/utils';
import Markdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import InlineCode from './InlineCode';
import JsonCodeBlock from './JsonCodeBlock';
import TxAnchor from './TxAnchor';


const remarkPlugins = [remarkGfm];


/**
 * Turns single newlines into hard line breaks (by appending two trailing spaces)
 * everywhere *except* inside fenced code blocks, so rendered `<pre>` content
 * doesn't pick up stray trailing whitespace.
 */
const softBreaksOutsideCode = (src: string) => {
    const lines = src.split('\n');
    let insideFence = false;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (/^\s*(```|~~~)/.test(line)) {
            insideFence = !insideFence;
            continue;
        }
        if (insideFence) continue;
        if (line.length === 0) continue; //blank lines already separate blocks
        if (/[ \t]{2,}$/.test(line)) continue; //already ends with hard break
        lines[i] = line + '  ';
    }
    return lines.join('\n');
};


//MARK: Custom components
//Code blocks sit on the sunken surface, or on raise-2 inside a toast (which is already on --menu).
const preBaseClass = 'not-prose whitespace-pre-wrap break-all rounded-sm bg-sunken p-3 font-mono text-dense text-body [overflow-wrap:_anywhere] [.prose-toast_&]:bg-raise-2 [.prose-toast_&>code]:bg-transparent';
const jsonBlockClass = 'not-prose rounded-sm bg-sunken p-3 [.prose-toast_&]:bg-raise-2';

//Maps the typography plugin's dark palette onto the text and surface tokens.
const proseTokenClass = [
    '[--tw-prose-invert-body:var(--text-body)]',
    '[--tw-prose-invert-headings:var(--text)]',
    '[--tw-prose-invert-lead:var(--text-muted)]',
    '[--tw-prose-invert-bold:var(--text)]',
    '[--tw-prose-invert-counters:var(--text-muted)]',
    '[--tw-prose-invert-bullets:var(--text-faint)]',
    '[--tw-prose-invert-hr:var(--hairline)]',
    '[--tw-prose-invert-quotes:var(--text-body)]',
    '[--tw-prose-invert-quote-borders:var(--hairline)]',
    '[--tw-prose-invert-captions:var(--text-muted)]',
    '[--tw-prose-invert-code:var(--text)]',
    '[--tw-prose-invert-th-borders:var(--hairline)]',
    '[--tw-prose-invert-td-borders:var(--hairline)]',
].join(' ');

const customComponents: Components = {
    code: ({ className, children }) => {
        //Fenced code blocks (with or without a language) must NOT use InlineCode,
        //because its horizontal padding ends up as left padding on the first line
        //inside a <pre> and visually misaligns it from subsequent lines.
        const isBlock = /(^|\s)language-/.test(className ?? '') || String(children ?? '').includes('\n');
        if (isBlock) {
            return <code className={className}>{children}</code>;
        }
        return <InlineCode className="not-prose">{children}</InlineCode>;
    },
    pre: ({ children }) => {
        //For fenced blocks react-markdown passes a single <code> child.
        //If it's ```json, render it with the dedicated JsonCodeBlock component.
        if (isValidElement(children)) {
            const codeProps = children.props as { className?: string; children?: ReactNode };
            const match = /language-(\w+)/.exec(codeProps.className ?? '');
            if (match?.[1] === 'json' && typeof codeProps.children === 'string') {
                return (
                    <JsonCodeBlock
                        value={codeProps.children.replace(/\n$/, '')}
                        className={jsonBlockClass}
                    />
                );
            }
        }
        return <pre className={preBaseClass}>{children}</pre>;
    },
    a: ({ children, href }) => <TxAnchor href={href!}>{children}</TxAnchor>,
}


type MarkdownProseProps = {
    md: string;
    isSmall?: boolean;
    /** Kept for callers; titles no longer get extra letter-spacing. */
    isTitle?: boolean;
    isToast?: boolean;
    className?: string;
};
export default function MarkdownProse({ md, isSmall, isToast, className }: MarkdownProseProps) {
    // md = '```\naaa\nbbb\nccc\n```';
    // md = '```json\n{"aaa": "bbb", "ccc": true}\n```';
    // md = '```json\n{\n\t"aaa": "bbb",\n\t"ccc": true\n}\n```';
    // md = '```\n{\n\t"aaa": "bbb",\n\t"ccc": true\n}\n```';
    const processed = softBreaksOutsideCode(stripIndent(md));
    return (
        <Markdown
            remarkPlugins={remarkPlugins}
            components={customComponents}
            className={cn(
                'prose dark:prose-invert',
                proseTokenClass,
                isSmall && 'prose-sm',
                isToast && 'prose-toast',
                className,
            )}
        >
            {processed}
        </Markdown>
    );
}
