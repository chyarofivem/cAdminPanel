import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { AlertCircle, BriefcaseBusiness, Loader2, LockKeyhole, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useAuthedFetcher } from '@/hooks/fetch';
import { useAdminPerms } from '@/hooks/auth';
import { txToast } from '@/components/TxToaster';
import { cadminApiPath, cadminCharacterIdentifier, cadminData, type CadminPlayer, type CadminResponse } from './api';
import { t } from '@/lib/i18n';

type JobGrade = { grade: number; label?: string };
type Job = { name: string; label: string; grades: JobGrade[] };

const selectClass = 'h-10 w-full rounded-lg border border-white/10 bg-[#0f1116] px-3 text-sm text-white outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20 disabled:cursor-not-allowed disabled:opacity-50';

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

    return <section className="overflow-hidden rounded-2xl border border-white/5 bg-white/[0.025]">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 px-5 py-4">
            <div>
                <h3 className="flex items-center font-medium text-white"><BriefcaseBusiness className="mr-2 size-4 text-brand-400" />{t('Job assignment')}</h3>
                <p className="mt-1 text-xs text-zinc-500">{t('Choose a server job and one of its configured grades.')}</p>
            </div>
            <div className="rounded-lg bg-white/5 px-3 py-2 text-right">
                <p className="text-[10px] uppercase tracking-widest text-zinc-600">{t('Current job')}</p>
                <p className="text-sm text-zinc-200">{currentName} · {t('Grade {grade}', { grade: player.job?.grade ?? 0 })}</p>
            </div>
        </header>

        <div className="p-5">
            {jobs.error && <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">
                <span className="flex items-center"><AlertCircle className="mr-2 size-4" />{jobs.error.message || t('The server job list could not be loaded.')}</span>
                <Button size="sm" variant="outline" onClick={() => void jobs.mutate()}>{t('Try again')}</Button>
            </div>}

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
                <div>
                    <Label htmlFor="character-job">{t('Job')}</Label>
                    <select id="character-job" className={`${selectClass} mt-2`} value={job} disabled={jobs.isLoading || !jobs.data?.length || saving || !canEdit} onChange={event => chooseJob(event.target.value)}>
                        <option value="">{jobs.isLoading ? t('Loading jobs...') : t('Select job')}</option>
                        {job && !jobs.data?.some(entry => entry.name === job) && <option value={job}>{currentName}</option>}
                        {jobs.data?.map(entry => <option key={entry.name} value={entry.name}>{entry.label} ({entry.name})</option>)}
                    </select>
                </div>
                <div>
                    <Label htmlFor="character-job-grade">{t('Grade')}</Label>
                    <select id="character-job-grade" className={`${selectClass} mt-2`} value={grade} disabled={!selected?.grades.length || saving || !canEdit} onChange={event => setGrade(event.target.value)}>
                        {!selected?.grades.length && <option value="">{job ? t('No grades configured') : t('Select a job first')}</option>}
                        {selected?.grades.map(entry => <option key={entry.grade} value={entry.grade}>{entry.grade} — {entry.label || t('Unnamed grade')}</option>)}
                    </select>
                </div>
                <Button className="w-full lg:w-auto" disabled={!job || !selectedGradeExists || saving || !canEdit} onClick={() => void submit()} title={!canEdit ? t('You need the Character Management: Set Job permission.') : undefined}>
                    {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}{saving ? t('Saving...') : t('Save job')}
                </Button>
            </div>

            {!jobs.isLoading && !jobs.error && jobs.data?.length === 0 && <p className="mt-4 rounded-xl bg-amber-500/10 p-3 text-sm text-amber-200">{t('The framework returned no jobs. Check the job definitions on the game server.')}</p>}
            {!canEdit && <p className="mt-4 flex items-center text-xs text-amber-300"><LockKeyhole className="mr-2 size-3.5" />{t('Read-only: you need the Character Management: Set Job permission to edit this value.')}</p>}
        </div>
    </section>;
}
