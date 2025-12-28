'use client';

import { useState } from 'react';
import { Search, Building2, Phone, Mail, User, Calendar, TrendingUp, MapPin } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Input } from '@/src/components/ui/input';
import { Button } from '@/src/components/ui/button';
import { Badge } from '@/src/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';
import { Separator } from '@/src/components/ui/separator';
import { Label } from '@/src/components/ui/label';
import { useSearchCustomersGlobal } from '@/src/lib/queries/customer.query';
import { CustomerSearchResult } from '@/src/lib/models/customer.model';
import { toast } from 'sonner';

export default function CustomerSearchPage() {
    const [searchQuery, setSearchQuery] = useState('');
    const [activeQuery, setActiveQuery] = useState('');
    const [selectedCustomer, setSelectedCustomer] = useState<CustomerSearchResult | null>(null);

    const { data: customers, isLoading, error } = useSearchCustomersGlobal(activeQuery);

    const handleSearch = () => {
        if (searchQuery.trim().length >= 3) {
            setActiveQuery(searchQuery.trim());
            setSelectedCustomer(null);
        } else {
            toast.error('Please enter at least 3 characters to search');
        }
    };

    const handleCustomerClick = (customer: CustomerSearchResult) => {
        setSelectedCustomer(customer);
    };

    return (
        <div className="container max-w-7xl mx-auto py-8 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Customer Search</h1>
                    <p className="text-muted-foreground">Search for customers across all companies</p>
                </div>
                <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-300">
                    Super Admin
                </Badge>
            </div>

            {/* Search Box */}
            <Card>
                <CardHeader>
                    <CardTitle>Global Customer Search</CardTitle>
                    <CardDescription>
                        Search by phone number or customer name to see all companies and branches they have registered with
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="text"
                                placeholder="Search by phone number or customer name (min 3 characters)"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                className="pl-10"
                            />
                        </div>
                        <Button onClick={handleSearch} disabled={isLoading}>
                            {isLoading ? 'Searching...' : 'Search'}
                        </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                        💡 Tip: Search by phone number for exact match, or by name to see all customers with that name across all companies
                    </p>
                </CardContent>
            </Card>

            {/* Search Results */}
            {activeQuery && customers && customers.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Search Results ({customers.length})</CardTitle>
                        <CardDescription>Click on a customer to see detailed company associations</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Customer Name</TableHead>
                                    <TableHead>Phone</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead className="text-right">Companies</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {customers.map((customer) => (
                                    <TableRow
                                        key={customer.id}
                                        className="cursor-pointer hover:bg-muted/50"
                                        onClick={() => handleCustomerClick(customer)}
                                    >
                                        <TableCell className="font-medium">
                                            <div className="flex items-center gap-2">
                                                <User className="h-4 w-4 text-muted-foreground" />
                                                {customer.fullName}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <Phone className="h-4 w-4 text-muted-foreground" />
                                                {customer.phone}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {customer.email ? (
                                                <div className="flex items-center gap-2">
                                                    <Mail className="h-4 w-4 text-muted-foreground" />
                                                    {customer.email}
                                                </div>
                                            ) : (
                                                <span className="text-muted-foreground text-sm">N/A</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Badge variant="secondary">
                                                {customer.tenantInfos?.length || 0} companies
                                            </Badge>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}

            {/* No Results */}
            {activeQuery && customers && customers.length === 0 && (
                <Card>
                    <CardContent className="py-12">
                        <div className="text-center text-muted-foreground">
                            <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p className="text-lg font-medium">No customers found</p>
                            <p className="text-sm">Try searching with a different phone number or name</p>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Customer Details */}
            {selectedCustomer && (
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-2xl">{selectedCustomer.fullName}</CardTitle>
                                <CardDescription className="flex items-center gap-4 mt-2">
                                    <span className="flex items-center gap-2">
                                        <Phone className="h-4 w-4" />
                                        {selectedCustomer.phone}
                                    </span>
                                    {selectedCustomer.email && (
                                        <span className="flex items-center gap-2">
                                            <Mail className="h-4 w-4" />
                                            {selectedCustomer.email}
                                        </span>
                                    )}
                                </CardDescription>
                            </div>
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300">
                                Customer ID: {selectedCustomer.id}
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div>
                            <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                                <Building2 className="h-5 w-5" />
                                Company Associations ({selectedCustomer.tenantInfos?.length || 0})
                            </h3>
                            <Separator className="mb-4" />

                            {selectedCustomer.tenantInfos && selectedCustomer.tenantInfos.length > 0 ? (
                                <div className="grid md:grid-cols-2 gap-4">
                                    {selectedCustomer.tenantInfos.map((tenantInfo) => (
                                        <Card key={tenantInfo.tenantId} className="border-2">
                                            <CardContent className="pt-6 space-y-3">
                                                <div className="flex items-start justify-between">
                                                    <div>
                                                        <h4 className="font-semibold text-lg">{tenantInfo.companyName}</h4>
                                                        <Badge variant="outline" className="mt-1">
                                                            Tenant ID: {tenantInfo.tenantId}
                                                        </Badge>
                                                    </div>
                                                </div>

                                                <Separator />

                                                <div className="space-y-2 text-sm">
                                                    <div className="flex items-center gap-2">
                                                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                                                        <Label className="text-xs font-semibold">Total Transactions:</Label>
                                                        <span className="font-medium">{tenantInfo.totalTransactions}</span>
                                                    </div>

                                                    <div className="flex items-center gap-2">
                                                        <Calendar className="h-4 w-4 text-muted-foreground" />
                                                        <Label className="text-xs font-semibold">First Transaction:</Label>
                                                        <span>{new Date(tenantInfo.firstTransactionAt).toLocaleDateString()}</span>
                                                    </div>

                                                    <div className="flex items-center gap-2">
                                                        <Calendar className="h-4 w-4 text-muted-foreground" />
                                                        <Label className="text-xs font-semibold">Last Transaction:</Label>
                                                        <span>{new Date(tenantInfo.lastTransactionAt).toLocaleDateString()}</span>
                                                    </div>
                                                </div>

                                                {/* Branches Section */}
                                                {tenantInfo.branches && tenantInfo.branches.length > 0 && (
                                                    <>
                                                        <Separator />
                                                        <div className="space-y-2">
                                                            <Label className="text-xs font-semibold flex items-center gap-2">
                                                                <MapPin className="h-4 w-4 text-muted-foreground" />
                                                                Branches ({tenantInfo.branches.length})
                                                            </Label>
                                                            <div className="flex flex-wrap gap-2">
                                                                {tenantInfo.branches.map((branch) => (
                                                                    <Badge key={branch.branchId} variant="secondary" className="text-xs">
                                                                        {branch.branchName}
                                                                    </Badge>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </>
                                                )}
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8 text-muted-foreground">
                                    <p>No company associations found</p>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Error State */}
            {error && (
                <Card className="border-red-200 bg-red-50">
                    <CardContent className="pt-6">
                        <p className="text-red-700 font-medium">Failed to search customers. Please try again.</p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
