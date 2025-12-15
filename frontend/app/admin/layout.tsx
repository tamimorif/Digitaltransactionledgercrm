import { SuperAdminLayout } from '@/src/components/layouts/SuperAdminLayout';

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <SuperAdminLayout>{children}</SuperAdminLayout>;
}
