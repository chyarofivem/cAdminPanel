import { Check, Loader2, Wrench } from 'lucide-react';
import { cn } from '@/lib/utils';
import { t } from '@/lib/i18n';

export const SETUP_STEP_LABELS = ['Server name', 'Starting point', 'Template', 'Data location', 'Launch'];

/**
 * The chrome shared by every wizard step: brand header, intro copy and the
 * step rail. Replaces the CoreUI/materialize-stepper markup of setup.ejs.
 */
export default function SetupShell({ stepIndex, children }: { stepIndex: number, children: React.ReactNode }) {
    return <div className="min-h-full w-full px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
            <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white/5 p-6">
                <div className="flex items-center gap-4">
                    <span className="flex size-11 items-center justify-center rounded-2xl bg-brand-500/15 text-brand-400 ring-1 ring-brand-500/25">
                        <Wrench className="size-5" />
                    </span>
                    <div>
                        <h1 className="text-lg font-semibold leading-tight">{t('Setup Wizard')}</h1>
                        <p className="text-xs uppercase tracking-widest text-neutral-500">{window.txConsts.panelName}</p>
                    </div>
                </div>
                <span className="rounded-full bg-white/5 px-3 py-1 text-xs uppercase tracking-widest text-neutral-400">
                    {t('New server')}
                </span>
            </header>

            <section className="rounded-2xl bg-white/5 p-6">
                <p className="text-xs uppercase tracking-widest text-neutral-500">{t('Welcome')}</p>
                <h2 className="mt-2 text-2xl font-semibold sm:text-3xl">{t('Build your server, your way.')}</h2>
                <p className="mt-2 max-w-2xl text-sm text-neutral-400">
                    {t('Choose a starting point, confirm where your files belong, then let the wizard handle the rest.')}
                </p>
                <ol className="mt-6 flex flex-col gap-3 border-t border-dashed border-white/5 pt-5 sm:flex-row sm:items-center sm:gap-2">
                    {SETUP_STEP_LABELS.map((label, index) => <li key={label} className="flex flex-1 items-center gap-2">
                        <span className={cn(
                            'flex size-6 shrink-0 items-center justify-center rounded-full text-[0.7rem] font-semibold ring-1 transition-colors',
                            index < stepIndex && 'bg-brand-500/20 text-brand-300 ring-brand-500/40',
                            index === stepIndex && 'bg-brand-500 text-white ring-brand-400',
                            index > stepIndex && 'bg-white/5 text-neutral-500 ring-white/10',
                        )}>
                            {index < stepIndex ? <Check className="size-3.5" /> : index + 1}
                        </span>
                        <span className={cn(
                            'text-xs uppercase tracking-widest',
                            index === stepIndex ? 'text-neutral-200' : 'text-neutral-500',
                        )}>{t(label)}</span>
                        {index < SETUP_STEP_LABELS.length - 1 && <span className={cn(
                            'hidden h-px flex-1 sm:block',
                            index < stepIndex ? 'bg-brand-500/40' : 'bg-white/10',
                        )} />}
                    </li>)}
                </ol>
            </section>

            <section className="rounded-2xl bg-white/5 p-6">{children}</section>
        </div>
    </div>;
}


/**
 * Consistent heading for the inner step body.
 */
export function StepHeading({ title, description }: { title: string, description: string }) {
    return <div className="mb-6">
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="mt-1 text-sm text-neutral-400">{description}</p>
    </div>;
}


/**
 * Footer row holding the back/forward controls of each step.
 */
export function StepActions({ children }: { children: React.ReactNode }) {
    return <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-dashed border-white/5 pt-5">
        {children}
    </div>;
}


export function SetupSpinner({ label }: { label: string }) {
    return <div className="flex min-h-40 flex-col items-center justify-center gap-3 text-neutral-400">
        <Loader2 className="size-6 animate-spin text-brand-500" />
        <span className="text-sm">{label}</span>
    </div>;
}
