import { useState } from 'react';
import useSWR from 'swr';
import { Button } from '@/components/ui/button';
import { useAuthedFetcher } from '@/hooks/fetch';
import { useAdminPerms } from '@/hooks/auth';
import { txToast } from '@/components/TxToaster';
import { cadminApiPath, cadminCharacterIdentifier, cadminData, type CadminPlayer, type CadminResponse } from './api';
import { t } from '@/lib/i18n';

type Job = { name: string; label: string; grades: { grade: number; label?: string }[] };
export default function JobTab({ player, refresh }: { player: CadminPlayer; refresh: () => void }) {
    const fetcher = useAuthedFetcher(); const { hasPerm } = useAdminPerms();
    const jobsUrl = cadminApiPath('jobs');
    const jobs = useSWR(jobsUrl, async () => cadminData(await fetcher<CadminResponse<Job[]>>(jobsUrl)));
    const [job, setJob] = useState(player.job?.name ?? ''); const [grade, setGrade] = useState(String(player.job?.grade ?? 0));
    const selected = jobs.data?.find(entry => entry.name === job);
    const submit = async () => { try { cadminData(await fetcher<CadminResponse>(cadminApiPath('job'), { method: 'POST', body: { identifier: cadminCharacterIdentifier(player), job, grade: Number(grade) } })); txToast.success(t('Job updated.')); refresh(); } catch (error) { txToast.error(t((error as Error).message)); } };
    return <div className="space-y-4"><p>{t('Current')}: <strong>{player.job?.label || player.job?.name || t('none')}</strong> ({t('Grade {grade}', { grade: player.job?.grade ?? 0 })})</p><div className="flex flex-wrap gap-2"><select className="h-10 rounded-lg border border-white/10 bg-[#0f1116] px-3 text-sm text-white outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20" value={job} onChange={e => { setJob(e.target.value); setGrade('0'); }}><option value="">{t('Select job')}</option>{jobs.data?.map(entry => <option key={entry.name} value={entry.name}>{entry.label}</option>)}</select><select className="h-10 rounded-lg border border-white/10 bg-[#0f1116] px-3 text-sm text-white outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20" value={grade} onChange={e => setGrade(e.target.value)}>{selected?.grades.map(entry => <option key={entry.grade} value={entry.grade}>{entry.grade} — {entry.label}</option>)}</select><Button disabled={!job || !hasPerm('cadmin.job.set')} onClick={submit}>{t('Set job')}</Button></div></div>;
}
