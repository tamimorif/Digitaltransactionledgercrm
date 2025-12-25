import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/src/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Building2, Shield, Users, Zap, Check } from 'lucide-react';

export default function Home() {
  const features = [
    {
      icon: Building2,
      title: 'Multi-Tenant Management',
      description: 'Each company with separate database and complete features',
    },
    {
      icon: Shield,
      title: 'High Security',
      description: 'Two-factor authentication and email verification',
    },
    {
      icon: Users,
      title: 'User Management',
      description: 'Different roles and access levels',
    },
    {
      icon: Zap,
      title: 'Free Trial',
      description: '7 days free access to all features',
    },
  ];

  const plans = [
    {
      name: 'Starter',
      users: '5 Users',
      price: 'Contact Us',
    },
    {
      name: 'Professional',
      users: '20 Users',
      price: 'Contact Us',
      popular: true,
    },
    {
      name: 'Business',
      users: '50 Users',
      price: 'Contact Us',
    },
    {
      name: 'Enterprise',
      users: 'Unlimited',
      price: 'Contact Us',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Header */}
      <header className="border-b bg-white/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="relative h-10 w-10">
              <Image
                src="/logo.png"
                alt="Logo"
                fill
                className="object-contain"
              />
            </div>
            <span className="font-bold text-xl">Accounting System</span>
          </div>
          <div className="flex gap-4">
            <Link href="/login">
              <Button variant="ghost">Login</Button>
            </Link>
            <Link href="/register">
              <Button>Sign Up Free</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <h1 className="text-5xl font-bold mb-6">
          Accounting & Transaction Management System
        </h1>
        <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
          A powerful platform for managing currency exchange, remittance, and money transfer
          with multi-tenancy capabilities and advanced licensing system
        </p>
        <div className="flex gap-4 justify-center">
          <Link href="/register">
            <Button size="lg" className="text-lg px-8">
              Start Free 7-Day Trial
            </Button>
          </Link>
          <Link href="/login">
            <Button size="lg" variant="outline" className="text-lg px-8">
              Login to Account
            </Button>
          </Link>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-20">
        <h2 className="text-3xl font-bold text-center mb-12">Key Features</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <Card key={index}>
              <CardHeader>
                <feature.icon className="h-10 w-10 text-primary mb-2" />
                <CardTitle>{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>{feature.description}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Pricing Section */}
      <section className="container mx-auto px-4 py-20 bg-gray-50">
        <h2 className="text-3xl font-bold text-center mb-12">Pricing Plans</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
          {plans.map((plan, index) => (
            <Card
              key={index}
              className={plan.popular ? 'border-primary shadow-lg' : ''}
            >
              <CardHeader>
                {plan.popular && (
                  <span className="bg-primary text-primary-foreground text-xs px-3 py-1 rounded-full w-fit mb-2">
                    Most Popular
                  </span>
                )}
                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                <CardDescription className="text-lg font-semibold mt-2">
                  {plan.users}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-3xl font-bold">{plan.price}</div>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-600" />
                    <span className="text-sm">7-Day Free Trial</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-600" />
                    <span className="text-sm">Email Support</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-600" />
                    <span className="text-sm">Free Updates</span>
                  </li>
                </ul>
                <Link href="/register" className="block">
                  <Button className="w-full" variant={plan.popular ? 'default' : 'outline'}>
                    Get Started
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <Card className="max-w-3xl mx-auto bg-primary text-primary-foreground">
          <CardHeader>
            <CardTitle className="text-3xl mb-4">
              Get Started Now
            </CardTitle>
            <CardDescription className="text-primary-foreground/90 text-lg">
              Free sign-up with no credit card required. Try it for 7 days.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/register">
              <Button size="lg" variant="secondary" className="text-lg px-8">
                Sign Up Free
              </Button>
            </Link>
          </CardContent>
        </Card>
      </section>

      {/* Footer */}
      <footer className="border-t bg-gray-50 py-8">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>© 2024 Digital Transaction Ledger CRM. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
