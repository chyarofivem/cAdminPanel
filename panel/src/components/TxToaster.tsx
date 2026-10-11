import MarkdownProse from "@/components/MarkdownProse";
import { cn } from "@/lib/utils";
import { t as translate } from "@/lib/i18n";
import { XIcon } from "lucide-react";
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
/**
 * Toasts are small menus: menu surface, radius-xs, menu elevation, and a 4px status
 * bar on the start edge. No icon chips, no blur, no entrance animation.
 */
const toastBarClass = 'pointer-events-none relative z-40 w-full max-w-xl overflow-hidden rounded-xs bg-menu text-body shadow-menu transition-opacity duration-150 sm:w-auto sm:min-w-[24rem]';

//Start-edge bar and countdown fill, per type. Default and loading follow the accent.
const toastAccentMap = {
    default: "bg-accent",
    loading: "bg-accent",
    info: "bg-info",
    success: "bg-success",
    warning: "bg-warning",
    error: "bg-danger",
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
            className={cn(toastBarClass, t.visible ? 'opacity-100' : 'opacity-0')}
        >
            <div aria-hidden className={cn('absolute inset-y-0 left-0 w-1', toastAccentMap[type])} />
            <div className="flex items-start gap-3 py-3 pl-5 pr-12">
                <div className="min-w-0 flex-grow text-sm">
                    {typeof data === "string" ? (
                        <span className="block whitespace-pre-line text-white">{data}</span>
                    ) : data.md ? (
                        <>
                            {data.title ? <MarkdownProse md={`**${data.title}**`} isSmall isTitle isToast /> : null}
                            <MarkdownProse md={data.msg} isSmall isToast />
                        </>
                    ) : (
                        <>
                            {data.title ? (
                                <span className="block font-semibold text-white">{data.title}</span>
                            ) : null}
                            <span className={cn(
                                'block whitespace-pre-line',
                                data.title ? 'mt-0.5 text-muted-foreground' : 'text-white',
                            )}>{data.msg}</span>
                        </>
                    )}
                </div>
                {type === "loading" && (
                    <span className="shrink-0 pt-px text-xs tabular-nums text-muted-foreground">
                        {elapsedTime > 0 ? `${elapsedTime}s` : translate('Working…')}
                    </span>
                )}
            </div>

            <button
                type="button"
                onClick={() => toast.dismiss(t.id)}
                aria-label={translate('Close')}
                title={translate('Close')}
                className="pointer-events-auto absolute right-1.5 top-1.5 grid size-9 place-items-center rounded-sm text-body
                    transition-colors duration-150 hover:bg-raise hover:text-white
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-text"
            >
                <XIcon className="size-4" aria-hidden="true" />
            </button>

            {hasProgressBar && (
                <div aria-hidden className="absolute inset-x-0 bottom-0 h-0.5 bg-raise">
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
