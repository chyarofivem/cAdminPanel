import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { t } from '@/lib/i18n';

export const SETUP_STEP_LABELS = ['Server name', 'Starting point', 'Template', 'Data location', 'Launch'];


/**
 * Text stepper shared by the setup wizard and the recipe deployer: the current step in
 * white, upcoming steps muted, finished steps muted with a success badge.
 * `labels` are untranslated keys.
 */
export function WizardSteps({ labels, current }: { labels: readonly string[], current: number }) {
    return <ol className="flex flex-wrap items-center gap-x-6 gap-y-2">
        {labels.map((label, index) => {
            const isDone = index < current;
            const isCurrent = index === current;
            return <li
                key={label}
                className="flex min-h-6 items-center gap-2 text-sm"
                aria-current={isCurrent ? 'step' : undefined}
            >
                <span className={cn(
                    'tabular-nums',
                    isCurrent ? 'font-medium text-white' : 'text-muted-foreground',
                )}>
                    {index + 1}. {t(label)}
                </span>
                {isDone && <Badge variant="success">{t('Done')}</Badge>}
            </li>;
        })}
    </ol>;
}


/**
 * The chrome shared by every wizard step: page header, step list and the step body.
 * The body is not wrapped in a card because some steps list choices as rows.
 */
export default function SetupShell({ stepIndex, children }: { stepIndex: number, children: React.ReactNode }) {
    return <div className="w-full max-w-4xl pb-8">
        <PageHeader
            title={t('Setup Wizard')}
            subtitle={t('Choose a starting point, confirm where your files belong, then let the wizard handle the rest.')}
        />
        <div className="flex flex-col gap-6">
            <WizardSteps labels={SETUP_STEP_LABELS} current={stepIndex} />
            <div>{children}</div>
        </div>
    </div>;
}


/**
 * Consistent heading for the inner step body.
 */
export function StepHeading({ title, description }: { title: string, description: string }) {
    return <div className="mb-6">
        <h2 className="text-base font-semibold leading-tight text-white">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>;
}


/**
 * Footer row holding the back/forward controls of each step, left-aligned below the step.
 */
export function StepActions({ children }: { children: React.ReactNode }) {
    return <div className="mt-6 flex flex-wrap items-center gap-3">
        {children}
    </div>;
}


/**
 * Loading state: one line of muted text.
 */
export function SetupSpinner({ label }: { label: string }) {
    return <p role="status" className="text-sm text-muted-foreground">{label}</p>;
}
