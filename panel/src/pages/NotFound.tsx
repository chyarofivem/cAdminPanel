import InlineCode from "@/components/InlineCode";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { useSetPageTitle } from "@/hooks/pages";
import { Link } from "wouter";
import { t } from '@/lib/i18n';

type Props = {
    params: {
        '*': string;
    };
};
export default function NotFound({ params }: Props) {
    const setPageTitle = useSetPageTitle();
    setPageTitle(t('Not Found'));

    return (
        <div className="w-full">
            <PageHeader title={t('Not Found')} />
            <div className="flex flex-col items-start gap-4">
                <p className="break-words text-sm text-muted-foreground">
                    {t('The page')} <InlineCode>/{params['*']}</InlineCode> {t('does not seem to be correct.')}
                </p>
                <Button asChild>
                    <Link href="/">{t('Return to Dashboard')}</Link>
                </Button>
            </div>
        </div>
    );
}
