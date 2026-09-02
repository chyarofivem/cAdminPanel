import MarkdownProse from "@/components/MarkdownProse";
import { cn } from "@/lib/utils";
import { t as translate } from "@/lib/i18n";
import { cva } from "class-variance-authority";
import { AlertCircleIcon, AlertOctagonIcon, CheckCircleIcon, ChevronRightCircle, InfoIcon, Loader2Icon, XIcon } from "lucide-react";
import toast, { Toast, Toaster } from "react-hot-toast";
import { useEffect, useState } from "react";
import { ApiToastResp } from "@shared/genericApiTypes";


//MARK: Types
export const validToastTypes = ['default', 'loading', 'info', 'success', 'warning', 'error'] as const;
type TxToastType = typeof validToastTypes[number];

type TxToastData = string | {
    title?: string;
    md?: boolean
    msg: string;
}

type TxToastOptions = {
    id?: string;
    duration?: number;
}


//MARK: Components
const toastBarVariants = cva(
    `pointer-events-none relative z-40 w-full max-w-xl overflow-hidden sm:w-auto sm:min-w-[26rem]
    rounded-xl border bg-card text-card-foreground shadow-xl shadow-black/10 dark:shadow-black/40
    supports-[backdrop-filter]:bg-card/85 supports-[backdrop-filter]:backdrop-blur-md`,
    {
        variants: {
            type: {
                default: "border-border",
                loading: "border-border",
                info: "border-info/40",
                success: "border-success/40",
                warning: "border-warning/40",
                error: "border-destructive/40",
            },
        },
        defaultVariants: {
            type: "default",
        },
    }
);

//Left accent bar + icon chip, per type
const toastAccentMap = {
    default: "bg-brand-500/60",
    loading: "bg-brand-500/60",
    info: "bg-info",
    success: "bg-success",
    warning: "bg-warning",
    error: "bg-destructive",
} as const;

const toastChipMap = {
    default: "bg-muted text-muted-foreground",
    loading: "bg-muted text-muted-foreground",
    info: "bg-info-hint text-info-inline",
    success: "bg-success-hint text-success-inline",
    warning: "bg-warning-hint text-warning-inline",
    error: "bg-destructive-hint text-destructive-inline",
} as const;

const toastIconMap = {
    default: <ChevronRightCircle className="size-4 animate-toastbar-icon" />,
    loading: <Loader2Icon className="size-4 animate-spin" />,
    info: <InfoIcon className="size-4 animate-toastbar-icon" />,
    success: <CheckCircleIcon className="size-4 animate-toastbar-icon" />,
    warning: <AlertCircleIcon className="size-4 animate-toastbar-icon" />,
    error: <AlertOctagonIcon className="size-4 animate-toastbar-icon" />,
} as const;

const toastAriaMap = {
    default: 'status',
    loading: 'status',
    info: 'status',
    success: 'status',
    warning: 'alert',
    error: 'alert',
} as const;

type CustomToastProps = {
    t: Toast,
    type: TxToastType,
    data: TxToastData,
}

export const CustomToast = ({ t, type, data }: CustomToastProps) => {
    const [elapsedTime, setElapsedTime] = useState(0);

    useEffect(() => {
        let timer: NodeJS.Timeout | null = null;
        const cleanup = () => { timer && clearInterval(timer) };

        if (type === "loading" && t.visible) {
            timer = setInterval(() => {
                setElapsedTime((prevElapsedTime) => prevElapsedTime + 1);
            }, 1000);
        } else if (timer) {
            cleanup();
        }

        return cleanup;
    }, [type, t.visible]);

    //Only toasts that auto-dismiss get the countdown bar
    const hasProgressBar = type !== 'loading'
        && typeof t.duration === 'number'
        && Number.isFinite(t.duration);

    return (
        <div
            role={toastAriaMap[type]}
            aria-live={toastAriaMap[type] === 'alert' ? 'assertive' : 'polite'}
            className={cn(
                toastBarVariants({ type }),
                t.visible ? "animate-toastbar-enter" : "animate-toastbar-leave"
            )}
        >
            <div aria-hidden className={cn('absolute inset-y-0 left-0 w-1', toastAccentMap[type])} />
            <div className="flex items-start gap-3 py-3 pl-4 pr-10">
                <div className={cn(
                    'mt-px flex size-7 shrink-0 items-center justify-center rounded-lg',
                    toastChipMap[type],
                )}>
                    {type === "loading" && elapsedTime > 4 ? (
                        <span className="text-2xs font-semibold tabular-nums">{elapsedTime}s</span>
                    ) : toastIconMap[type]}
                </div>
                <div className="min-w-0 flex-grow pt-0.5 text-sm leading-snug">
                    {typeof data === "string" ? (
                        <span className="block whitespace-pre-line">{data}</span>
                    ) : data.md ? (
                        <>
                            {data.title ? <MarkdownProse md={`**${data.title}**`} isSmall isTitle isToast /> : null}
                            <MarkdownProse md={data.msg} isSmall isToast />
                        </>
                    ) : (
                        <>
                            {data.title ? (
                                <span className="block font-semibold tracking-tight">{data.title}</span>
                            ) : null}
                            <span className={cn(
                                'block whitespace-pre-line',
                                data.title && 'mt-0.5 text-muted-foreground',
                            )}>{data.msg}</span>
                        </>
                    )}
                </div>
            </div>

            <button
                type="button"
                onClick={() => toast.dismiss(t.id)}
                className="pointer-events-auto absolute right-2 top-2 rounded-md p-1.5 text-muted-foreground
                    transition-colors hover:bg-muted hover:text-foreground
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
                <XIcon className="size-4" />
                <span className="sr-only">{translate('Close')}</span>
            </button>

            {hasProgressBar && (
                <div aria-hidden className="absolute inset-x-0 bottom-0 h-0.5 bg-foreground/5">
                    <div
                        className={cn(
                            'h-full origin-left animate-toastbar-progress motion-reduce:hidden',
                            toastAccentMap[type],
                        )}
                        style={{ animationDuration: `${t.duration}ms` }}
                    />
                </div>
            )}
        </div>
    );
};


//Element to be added to MainShell
export default function TxToaster() {
    return <Toaster
        reverseOrder={true}
        containerStyle={{
            top: 'var(--content-offset)',
            zIndex: 60,
        }}
    />
}


//MARK: Utilities
/**
 * Returns a toast with the given type
 */
const callToast = (type: TxToastType, data: TxToastData, options: TxToastOptions = {}) => {
    const msg = typeof data === 'string' ? data : data.msg;
    const msgWords = msg.split(/\s+/).length;
    let defaultDuration: number;
    if (msgWords < 15) {
        defaultDuration = 5_000;
    } else if (msgWords < 25) {
        defaultDuration = 7_500;
    } else if (msgWords < 50) {
        defaultDuration = 10_000;
    } else {
        defaultDuration = 15_000;
    }
    options.duration ??= type === 'loading' ? Infinity : defaultDuration;
    return toast.custom((t: Toast) => {
        return <CustomToast t={t} type={type} data={data} />;
    }, options);
}


/**
 * Calls a toast with the given type
 */
const genericToast = (data: ApiToastResp & { title?: string }, options?: TxToastOptions) => {
    return callToast(data.type, data, options);
}


/**
 * Global Toast Caller, as function or as object with specific types.
 */
export const txToast = Object.assign(genericToast, {
    default: (data: TxToastData, options?: TxToastOptions) => callToast('default', data, options),
    loading: (data: TxToastData, options?: TxToastOptions) => callToast('loading', data, options),
    info: (data: TxToastData, options?: TxToastOptions) => callToast('info', data, options),
    success: (data: TxToastData, options?: TxToastOptions) => callToast('success', data, options),
    warning: (data: TxToastData, options?: TxToastOptions) => callToast('warning', data, options),
    error: (data: TxToastData, options?: TxToastOptions) => callToast('error', data, options),
    dismiss: toast.dismiss,
    remove: toast.remove,
});
