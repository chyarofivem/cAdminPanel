import InlineCode from "@/components/InlineCode";
import { useSetPageTitle } from "@/hooks/pages";
import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { t } from '@/lib/i18n';

type Props = {
    params: {
        '*': string;
    };
};
export default function NotFound({ params }: Props) {
    const setPageTitle = useSetPageTitle();
    const setLocation = useLocation()[1];
    setPageTitle(t('Not Found'));

    // FIXME:NEXT:UPDATE - remove
    useEffect(() => {
        if (params['*'] === 'whitelist') {
            setLocation('/allowlist');
        }
    }, []);

    return (
        <div className="w-full flex items-center justify-center">
            <div className="text-center">
                <h1 className="bg-fuchsia-600 text-4xl w-fit mx-auto">{t('404 | Not Found')}</h1>
                <p className="mt-2">
                    {t('The page')} <InlineCode>/{params['*']}</InlineCode> {t('does not seem to be correct.')}
                </p>
                <Link href="/" className="text-accent hover:underline">{t('Return to Dashboard?')}</Link>
            </div>
        </div>
    );
}
