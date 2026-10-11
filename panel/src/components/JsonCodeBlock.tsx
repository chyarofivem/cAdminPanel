import { Fragment, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type JsonValue =
    | string
    | number
    | boolean
    | null
    | JsonValue[]
    | { [key: string]: JsonValue };

type JsonCodeBlockProps = {
    value: string;
    className?: string;
};

type ParseResult =
    | { ok: true; value: JsonValue }
    | { ok: false };

//Syntax colours reuse the status text tokens; they never follow the accent.
const tokenClass = {
    bracket: "text-muted-foreground",
    key: "text-info-text",
    string: "text-success-text",
    number: "text-warning-text",
    boolean: "text-warning-text",
    null: "text-danger-text",
};

const parseJson = (value: string): ParseResult => {
    try {
        return { ok: true, value: JSON.parse(value) as JsonValue };
    } catch {
        return { ok: false };
    }
};

const renderPrimitive = (value: string | number | boolean | null): ReactNode => {
    if (typeof value === "string") {
        return <span className={tokenClass.string}>{JSON.stringify(value)}</span>;
    }
    if (typeof value === "number") {
        return <span className={tokenClass.number}>{String(value)}</span>;
    }
    if (typeof value === "boolean") {
        return <span className={tokenClass.boolean}>{String(value)}</span>;
    }
    return <span className={tokenClass.null}>null</span>;
};

const renderJson = (value: JsonValue, depth = 0, path = "root"): ReactNode => {
    if (Array.isArray(value)) {
        if (value.length === 0) {
            return <span className={tokenClass.bracket}>[]</span>;
        }

        return (
            <Fragment>
                <span className={tokenClass.bracket}>[</span>
                {"\n"}
                {value.map((item, index) => (
                    <Fragment key={`${path}[${index}]`}>
                        {"  ".repeat(depth + 1)}
                        {renderJson(item, depth + 1, `${path}[${index}]`)}
                        {index < value.length - 1 ? "," : ""}
                        {"\n"}
                    </Fragment>
                ))}
                {"  ".repeat(depth)}
                <span className={tokenClass.bracket}>]</span>
            </Fragment>
        );
    }

    if (value && typeof value === "object") {
        const entries = Object.entries(value);
        if (entries.length === 0) {
            return <span className={tokenClass.bracket}>{"{}"}</span>;
        }

        return (
            <Fragment>
                <span className={tokenClass.bracket}>{"{"}</span>
                {"\n"}
                {entries.map(([key, item], index) => (
                    <Fragment key={`${path}.${key}`}>
                        {"  ".repeat(depth + 1)}
                        <span className={tokenClass.key}>{JSON.stringify(key)}</span>
                        <span className={tokenClass.bracket}>{": "}</span>
                        {renderJson(item, depth + 1, `${path}.${key}`)}
                        {index < entries.length - 1 ? "," : ""}
                        {"\n"}
                    </Fragment>
                ))}
                {"  ".repeat(depth)}
                <span className={tokenClass.bracket}>{"}"}</span>
            </Fragment>
        );
    }

    return renderPrimitive(value);
};

export default function JsonCodeBlock({ value, className }: JsonCodeBlockProps) {
    const parsed = parseJson(value);

    return (
        <pre className={cn("whitespace-pre-wrap attempt-word-wrap font-mono text-dense leading-6 text-body", className)}>
            {parsed.ok ? renderJson(parsed.value) : value}
        </pre>
    );
}
