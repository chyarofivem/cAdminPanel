import { PageHeader } from '@/components/page-header';
import { UsersRound } from 'lucide-react';

export default function CAdminLayout({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="w-full mb-10">
            <PageHeader title={title} icon={<UsersRound />} />
            {children}
        </div>
    );
}
