import { cn } from '@/lib/utils';

type SectionProps = Omit<React.HTMLAttributes<HTMLElement>, 'title'> & {
    title?: React.ReactNode;
    description?: React.ReactNode;
    /** Actions for this section, right of the title on desktop. */
    actions?: React.ReactNode;
};

/**
 * A card-style section: raise background, radius-lg, 24px padding (16px on phones),
 * 16px/600 white title and a muted description. Never nest a section in a section.
 */
export default function Section({ title, description, actions, className, children, ...props }: SectionProps) {
    return <section className={cn('rounded-lg bg-raise p-4 sm:p-6', className)} {...props}>
        {(title || description || actions) && <div className="mb-4 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
            <div className="min-w-0">
                {title && <h2 className="text-base font-semibold leading-tight text-white">{title}</h2>}
                {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
            </div>
            {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>}
        {children}
    </section>;
}
