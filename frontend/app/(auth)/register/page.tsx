import Image from 'next/image';
import { RegisterForm } from '@/src/components/auth/RegisterForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex justify-center mb-4">
            <div className="relative h-16 w-16 rounded-full bg-white shadow-lg border overflow-hidden">
              <Image src="/logo.png" alt="VeloPay" fill className="object-contain p-1" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-center">
            Create Account
          </CardTitle>
          <CardDescription className="text-center">
            Sign up for your VeloPay account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RegisterForm />
        </CardContent>
      </Card>
    </div>
  );
}
