import { useEffect, useState } from 'react';
import { useRequestsInFlight } from '@/lib/requestActivity';
import { cn } from '@/lib/utils';

/**
 * The 2px accent-glow bar at the very top of the viewport. It appears only when
 * a request takes longer than 200ms, so quick polls do not flicker it.
 */
export default function TopLoadingBar() {
    const isBusy = useRequestsInFlight() > 0;
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (!isBusy) {
            setVisible(false);
            return;
        }
        const timer = setTimeout(() => setVisible(true), 200);
        return () => clearTimeout(timer);
    }, [isBusy]);

    return <div
        aria-hidden="true"
        className={cn(
            'pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5 overflow-hidden transition-opacity duration-150',
            visible ? 'opacity-100' : 'opacity-0',
        )}
    >
        <div className="h-full w-2/5 animate-loading-bar bg-accent-glow motion-reduce:w-full motion-reduce:animate-none" />
    </div>;
}
