import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import Section from '@/components/Section';
import { useAuthedFetcher } from '@/hooks/fetch';
import { useAdminPerms } from '@/hooks/auth';
import { txToast } from '@/components/TxToaster';
import { cadminApiPath, cadminCharacterIdentifier, cadminData, type CadminPlayer, type CadminResponse } from './api';
import { nativeSelectClass } from './nativeSelect';
import { t } from '@/lib/i18n';

type JobGrade = { grade: number; label?: string };
type Job = { name: string; label: string; grades: JobGrade[] };

export default function JobTab({ player, refresh }: { player: CadminPlayer; refresh: () => void }) {
    const fetcher = useAuthedFetcher();
    const { hasPerm } = useAdminPerms();
    const canEdit = hasPerm('cadmin.job.set');
    const jobsUrl = cadminApiPath('jobs');
    const jobs = useSWR(jobsUrl, async () => cadminData(await fetcher<CadminResponse<Job[]>>(jobsUrl)));
    const [job, setJob] = useState(player.job?.name ?? '');
    const [grade, setGrade] = useState(String(player.job?.grade ?? 0));
    const [saving, setSaving] = useState(false);
    const selected = jobs.data?.find(entry => entry.name === job);
    const selectedGradeExists = selected?.grades.some(entry => String(entry.grade) === grade) ?? false;

    useEffect(() => {
        setJob(player.job?.name ?? '');
        setGrade(String(player.job?.grade ?? 0));
    }, [player.identifier, player.job?.name, player.job?.grade]);

    const chooseJob = (nextJob: string) => {
        setJob(nextJob);
        const next = jobs.data?.find(entry => entry.name === nextJob);
        setGrade(next?.grades.length ? String(next.grades[0].grade) : '');
    };

    const submit = async () => {
        if (!job || !selectedGradeExists || !canEdit || saving) return;
        setSaving(true);
        try {
            cadminData(await fetcher<CadminResponse>(cadminApiPath('job'), {
                method: 'POST',
                body: { identifier: cadminCharacterIdentifier(player), job, grade: Number(grade) },
            }));
            txToast.success(t('Job updated.'));
            refresh();
        } catch (error) {
            txToast.error(t((error as Error).message));
        } finally {
            setSaving(false);
        }
    };

    const currentName = player.job?.label || player.job?.name || t('No job');

    return <Section
        title={t('Job assignment')}
        description={t('Choose a server job and one of its configured grades.')}
        actions={<p className="text-dense">
            <span className="text-muted-foreground">{t('Current job')}</span>{' '}
            <span className="text-white">{currentName} · {t('Grade {grade}', { grade: player.job?.grade ?? 0 })}</span>
        </p>}
    >
        <div className="flex flex-col gap-4">
            {jobs.error && <Alert variant="destructive" className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <span>{jobs.error.message || t('The server job list could not be loaded.')}</span>
                <Button size="sm" variant="secondary" className="self-start sm:self-auto" onClick={() => void jobs.mutate()}>{t('Try again')}</Button>
            </Alert>}

            <div className="grid max-w-3xl gap-4 sm:grid-cols-2">
                <div className="flex min-w-0 flex-col gap-2">
                    <Label htmlFor="character-job">{t('Job')}</Label>
                    <select id="character-job" className={nativeSelectClass} value={job} disabled={jobs.isLoading || !jobs.data?.length || saving || !canEdit} onChange={event => chooseJob(event.target.value)}>
                        <option value="">{jobs.isLoading ? t('Loading jobs...') : t('Select job')}</option>
                        {job && !jobs.data?.some(entry => entry.name === job) && <option value={job}>{currentName}</option>}
                        {jobs.data?.map(entry => <option key={entry.name} value={entry.name}>{entry.label} ({entry.name})</option>)}
                    </select>
                </div>
                <div className="flex min-w-0 flex-col gap-2">
                    <Label htmlFor="character-job-grade">{t('Grade')}</Label>
                    <select id="character-job-grade" className={nativeSelectClass} value={grade} disabled={!selected?.grades.length || saving || !canEdit} onChange={event => setGrade(event.target.value)}>
                        {!selected?.grades.length && <option value="">{job ? t('No grades configured') : t('Select a job first')}</option>}
                        {selected?.grades.map(entry => <option key={entry.grade} value={entry.grade}>{entry.grade} · {entry.label || t('Unnamed grade')}</option>)}
                    </select>
                </div>
            </div>

            {!jobs.isLoading && !jobs.error && jobs.data?.length === 0 && <Alert variant="warning">{t('The framework returned no jobs. Check the job definitions on the game server.')}</Alert>}

            <Button
                className="self-start"
                disabled={!job || !selectedGradeExists || saving || !canEdit}
                onClick={() => void submit()}
                title={!canEdit ? t('You need the Character Management: Set Job permission.') : undefined}
            >
                {saving ? t('Saving...') : t('Save job')}
            </Button>
            {!canEdit && <p className="text-dense text-warning-text">{t('Read-only: you need the Character Management: Set Job permission to edit this value.')}</p>}
        </div>
    </Section>;
}
