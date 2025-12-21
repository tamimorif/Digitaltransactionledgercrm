'use client';

import { SupportDashboard } from '@/src/components/support';
import { tokenStorage } from '@/src/lib/api-client';
import { useState, useEffect } from 'react';

export default function SupportPage() {
    const [userId, setUserId] = useState<number | undefined>(undefined);

    useEffect(() => {
        const user = tokenStorage.getUser<{ id: number }>();
        if (user) {
            setUserId(user.id);
        }
    }, []);

    return <SupportDashboard currentUserId={userId} />;
}
