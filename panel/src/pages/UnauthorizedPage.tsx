import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { Link } from "wouter";
import { t } from '@/lib/i18n';


function PermissionTooltip({ permission }: { permission: string }) {
    return (
        <Tooltip>
            <TooltipTrigger className="cursor-help rounded-xs underline decoration-dotted underline-offset-4">
                {t('permission')}
            </TooltipTrigger>
            <TooltipContent>
                <span className="font-mono">{permission}</span>
            </TooltipContent>
        </Tooltip>
    )
}


type UnauthorizedPageProps = {
    pageName: string;
    permission: string;
};

export default function UnauthorizedPage({ pageName, permission }: UnauthorizedPageProps) {
    let messageNode;
    if (permission === 'master') {
        messageNode = (<>
            {t('Only the Master account can view this page')}: <strong className="font-medium text-white">{pageName}</strong>.
        </>);
    } else {
        messageNode = (<>
            {t('You do not have the required')} <PermissionTooltip permission={permission} /> {t('to view this page')}: <strong className="font-medium text-white">{pageName}</strong>.{' '}
            {t('Contact the server owner if you believe this is an error.')}
        </>);
    }
    return (
        <div className="w-full">
            <PageHeader title={t('Access Denied')} />
            <div className="flex flex-col items-start gap-4">
                <p className="text-sm text-muted-foreground">
                    {messageNode}
                </p>
                <Button asChild>
                    <Link href="/">{t('Return to Dashboard')}</Link>
                </Button>
            </div>
        </div>
    );
}
