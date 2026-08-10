import InlineCode from '@/components/InlineCode';
import { t } from '@/lib/i18n';

export function restartSchedulePromptProps() {
    const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return {
        suggestions: ['+5', '+10', '+15', '+30'],
        title: t('When should the server restart?'),
        message: <div className='space-y-3'>
            <div>
                <p>{t('Possible formats')}:</p>
                <ul className='ml-4 list-disc'>
                    <li>
                        <InlineCode>+MM</InlineCode> {t('relative time in minutes')}
                        {' '}({t('example')}: <InlineCode>+15</InlineCode> {t('for 15 minutes from now')}).
                    </li>
                    <li>
                        <InlineCode>HH:MM</InlineCode> {t('absolute 24-hour time')}
                        {' '}({t('example')}: <InlineCode>23:30</InlineCode> {t('for 11:30 PM')}).
                    </li>
                </ul>
            </div>
            {browserTimezone !== window.txConsts.serverTimezone && (
                <p className='text-destructive'>
                    {t("Server's timezone:")} <b>{window.txConsts.serverTimezone}</b> <br />
                    {t('Your timezone:')} <b>{browserTimezone}</b> <br />
                    {t('Use relative time or schedule against the server timezone.')}
                </p>
            )}
        </div>,
        placeholder: '+15',
        required: true,
        isWide: true,
    };
}
