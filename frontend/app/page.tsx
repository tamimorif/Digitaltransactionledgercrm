import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/src/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Shield, FileText, History, Clock, LayoutDashboard, Phone, BadgeCheck, Calculator, Globe } from 'lucide-react';
import { ThemeToggle } from '@/src/components/ThemeToggle';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'VeloPay | Digital Transaction Ledger for Exchange Businesses',
  description: 'VeloPay is a powerful digital transaction ledger for money exchange businesses. Track transactions, manage client accounts, real-time reporting, and more.',
};

export default function Home() {
  const services = [
    {
      icon: FileText,
      title: 'Transaction Ledger',
      description: 'Complete digital record of all transactions. Search, filter, and export your transaction history instantly.',
      color: 'text-orange-500',
    },
    {
      icon: Calculator,
      title: 'Real-Time Calculations',
      description: 'Automatic currency conversions, fee calculations, and profit tracking with live exchange rates.',
      color: 'text-blue-600',
    },
    {
      icon: History,
      title: 'Audit Trail',
      description: 'Every transaction is timestamped and tracked. Complete history for compliance and reconciliation.',
      color: 'text-green-600',
    },
    {
      icon: LayoutDashboard,
      title: 'Powerful Dashboard',
      description: 'Visual reports, daily summaries, and analytics. Better than Excel, designed for exchange businesses.',
      color: 'text-purple-600',
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Unified Sticky Header Section */}
      <div className="sticky top-0 z-50 w-full">
        <header className="bg-background/80 backdrop-blur-md border-b shadow-sm relative z-40">
          <div className="container mx-auto px-4 h-20 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* VeloPay Logo */}
              <div className="relative h-12 w-12 flex items-center justify-center rounded-full bg-white shadow-lg border overflow-hidden">
                <Image src="/logo.png" alt="VeloPay Logo" fill className="object-contain p-1" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-xl leading-none">VeloPay</span>
                <span className="text-xs text-muted-foreground tracking-wider uppercase">by Yas Exchange</span>
              </div>
            </div>

            <nav className="hidden md:flex items-center gap-8">
              <Link href="#services" className="text-sm font-medium hover:text-primary transition-colors">Services</Link>
              <Link href="/rates" className="text-sm font-medium hover:text-primary transition-colors">Live Rates</Link>
              <Link href="#contact" className="text-sm font-medium hover:text-primary transition-colors">Contact</Link>
            </nav>

            <div className="flex items-center gap-4">
              <ThemeToggle />
              <Link href="/login">
                <Button variant="ghost" className="font-semibold">Login</Button>
              </Link>
              <Link href="/register">
                <Button className="font-bold shadow-lg shadow-primary/20">Open Account</Button>
              </Link>
            </div>
          </div>
        </header>
      </div>

      {/* Hero Section */}
      <section className="relative bg-background text-foreground py-24 overflow-hidden border-b">
        {/* Background decorative elements */}
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-primary/10 to-transparent pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-primary/20 rounded-full blur-3xl pointer-events-none" />

        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-3xl">
            <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight mb-6 leading-tight">
              Values in Motion <br /> <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-500">Digital Transaction Ledger</span>
            </h1>
            <p className="text-xl text-muted-foreground mb-10 max-w-xl leading-relaxed">
              VeloPay is a digital transaction page, offering a comprehensive ledger for your financial operations with the precision of a spreadsheet.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 mb-12">
              <Link href="/rates">
                <Button size="lg" className="text-lg px-8 h-14 bg-blue-600 hover:bg-blue-500 border-0 shadow-xl shadow-blue-900/20">
                  Check Live Rates
                </Button>
              </Link>
              <Link href="/register">
                <Button size="lg" variant="outline" className="text-lg px-8 h-14 border-2 hover:bg-accent hover:text-accent-foreground">
                  Create Free Account
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="py-24 w-full bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Why Choose VeloPay?</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Built specifically for money exchange businesses. Track every transaction, manage multiple currencies, and generate reports instantly.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {services.map((service, index) => (
              <Card key={index} className="border bg-card shadow-lg hover:-translate-y-1 transition-transform duration-300">
                <CardHeader>
                  <div className={`h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 ${service.color}`}>
                    <service.icon className="h-6 w-6" />
                  </div>
                  <CardTitle className="text-xl font-bold">{service.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base leading-relaxed">
                    {service.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-24 text-center">
        <div className="max-w-4xl mx-auto bg-card border rounded-3xl p-12 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none"></div>

          <BadgeCheck className="h-16 w-16 text-primary mx-auto mb-6" />
          <h2 className="text-3xl md:text-4xl font-bold mb-6">Take Control of Your Transactions</h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            Real-time tracking, instant reports, and complete visibility into your exchange business.
          </p>
          <Link href="/register">
            <Button size="lg" className="font-bold h-12 px-8 text-lg">
              Start Free Trial
            </Button>
          </Link>
          <p className="mt-6 text-sm text-muted-foreground flex items-center justify-center gap-2">
            <Clock className="h-4 w-4" /> No credit card required
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer id="contact" className="bg-muted/50 border-t py-12">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div className="col-span-1 md:col-span-2">
              <div className="flex items-center gap-3 mb-4">
                {/* Light mode icon */}
                <div className="relative h-14 w-14 rounded-full overflow-hidden border dark:hidden" style={{ boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)' }}>
                  <Image src="/yas-icon-light.png" alt="Yas Exchange" fill className="object-cover" />
                </div>
                {/* Dark mode icon */}
                <div className="relative h-14 w-14 rounded-full overflow-hidden hidden dark:block" style={{ boxShadow: '0 0 15px rgba(255, 255, 255, 0.3)' }}>
                  <Image src="/yas-icon-dark.png" alt="Yas Exchange" fill className="object-cover scale-125" />
                </div>
                <span className="font-bold text-xl">Yas Exchange</span>
              </div>
              <p className="text-muted-foreground max-w-xs">
                Yas Exchange is a leading provider of digital transaction services. Licensed and regulated for your peace of mind.
              </p>
            </div>
            <div>
              <h4 className="font-bold mb-4">Quick Links</h4>
              <ul className="space-y-2 text-muted-foreground">
                <li><Link href="/rates" className="hover:text-primary">Live Rates</Link></li>
                <li><Link href="/register" className="hover:text-primary">Open Account</Link></li>
                <li><Link href="/login" className="hover:text-primary">Client Login</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4">Contact Us</h4>
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  <span>+1 (819) 432-7005</span>
                </li>
                <li className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span>Mon-Fri: 9am - 6pm</span>
                </li>
                <li className="flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  <a href="mailto:support@velopay.com" className="hover:text-primary">support@velopay.com</a>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t pt-8 text-center text-muted-foreground text-sm">
            <p>© 2024 Yas Exchange (VeloPay). All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
