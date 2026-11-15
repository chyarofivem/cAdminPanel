import MarkdownProse from "@/components/MarkdownProse";
import { cn } from "@/lib/utils";
import { t as translate } from "@/lib/i18n";
import { CircleCheckIcon, CircleXIcon, InfoIcon, Loader2Icon, TriangleAlertIcon, XIcon } from "lucide-react";
import { useMediaQuery } from "usehooks-ts";
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
 * Toast: modal surface, radius-md, modal shadow, 16px padding, at most 384px wide.
 * A 16px status icon in the status colour, then a 14px/500 white title and an
 * optional 13px muted line, with a close icon button. No start bar, no countdown bar,
 * no entrance slide: toasts fade.
 */
const toastClass = 'pointer-events-auto relative flex w-full items-start gap-3 rounded-md bg-modal p-4 pr-12 text-body shadow-modal transition-opacity duration-150 sm:w-96';

//check = success, triangle = warning, circle-x = error, circle-i = info; default follows the accent.
const toastIconMap = {
    default: <InfoIcon className="text-accent-text" />,
    loading: <Loader2Icon className="animate-spin text-accent-text" />,
    info: <InfoIcon className="text-info-text" />,
    success: <CircleCheckIcon className="text-success-text" />,
    warning: <TriangleAlertIcon className="text-warning-text" />,
    error: <CircleXIcon className="text-danger-text" />,
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

    return (
        <div
            role={toastAriaMap[type]}
            aria-live={toastAriaMap[type] === 'alert' ? 'assertive' : 'polite'}
            className={cn(toastClass, t.visible ? 'opacity-100' : 'opacity-0')}
        >
            <span aria-hidden="true" className="flex shrink-0 pt-0.5 [&_svg]:size-4">{toastIconMap[type]}</span>
            <div className="min-w-0 flex-grow">
                {typeof data === "string" ? (
                    <span className="block whitespace-pre-line text-sm font-medium text-white">{data}</span>
                ) : data.md ? (
                    <>
                        {data.title ? <MarkdownProse md={`**${data.title}**`} isSmall isTitle isToast /> : null}
                        <MarkdownProse md={data.msg} isSmall isToast />
                    </>
                ) : (
                    <>
                        {data.title ? (
                            <span className="block text-sm font-medium text-white">{data.title}</span>
                        ) : null}
                        <span className={cn(
                            'block whitespace-pre-line',
                            data.title ? 'mt-0.5 text-dense text-muted-foreground' : 'text-sm font-medium text-white',
                        )}>{data.msg}</span>
                    </>
                )}
                {type === "loading" && (
                    <span className="mt-0.5 block text-dense tabular-nums text-muted-foreground">
                        {elapsedTime > 0 ? `${elapsedTime}s` : translate('Working…')}
                    </span>
                )}
            </div>

            <button
                type="button"
                onClick={() => toast.dismiss(t.id)}
                aria-label={translate('Close')}
                title={translate('Close')}
                className="absolute right-2 top-2 grid size-9 place-items-center rounded-sm text-body
                    transition-colors duration-150 hover:bg-raise hover:text-white
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-text"
            >
                <XIcon className="size-5" aria-hidden="true" />
            </button>
        </div>
    );
};


//Element to be added to MainShell: bottom-right on desktop, top and full width minus 16px on phones.
export default function TxToaster() {
    const isDesktop = useMediaQuery('(min-width: 640px)');
    return <Toaster
        reverseOrder={true}
        position={isDesktop ? 'bottom-right' : 'top-center'}
        containerStyle={isDesktop
            ? { inset: 24, zIndex: 60 }
            : { inset: 8, zIndex: 60 }}
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
    //Loading toasts and errors stay until closed; the rest auto-dismiss.
    options.duration ??= type === 'loading' || type === 'error' ? Infinity : defaultDuration;
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
