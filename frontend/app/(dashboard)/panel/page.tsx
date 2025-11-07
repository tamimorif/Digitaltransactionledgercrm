'use client';

import { useState } from 'react';
import { useGetClients } from '@/src/lib/queries/client.query';
import { DailyRatesWidget } from '@/src/components/DailyRatesWidget';
import { ClientSearch } from '@/src/components/ClientSearch';
import { ClientProfile } from '@/src/components/ClientProfile';
import { NewClientDialog } from '@/src/components/NewClientDialog';
import { Card, CardContent } from '@/src/components/ui/card';
import { Building2, TrendingUp, Loader2 } from 'lucide-react';

export default function PanelPage() {
  const { data: clients = [], isLoading } = useGetClients();
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [showNewClientDialog, setShowNewClientDialog] = useState(false);

  const handleClientSelect = (client: any) => {
    setSelectedClient(client);
  };

  return (
    <div className="container mx-auto px-6 py-8">
      {/* Daily Rates Widget */}
      <div className="mb-8">
        <DailyRatesWidget />
      </div>

      {/* Main Content */}
      {!selectedClient ? (
        <div className="space-y-8">
          {/* Search Section */}
          <Card>
            <CardContent className="pt-6">
              <div className="mb-4">
                <h2 className="text-2xl font-bold mb-2">Find Client</h2>
                <p className="text-sm text-gray-500">
                  Search by phone number or name to view transaction history
                </p>
              </div>
              <ClientSearch
                clients={clients}
                onClientSelect={handleClientSelect}
                onNewClient={() => setShowNewClientDialog(true)}
              />
            </CardContent>
          </Card>

          {/* Recent Activity / Stats */}
          {!isLoading && clients.length > 0 && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="h-5 w-5 text-blue-600" />
                  <h3 className="text-xl font-semibold">Quick Stats</h3>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <p className="text-sm text-gray-600">Total Clients</p>
                    <p className="text-2xl font-bold mt-1">{clients.length}</p>
                  </div>
                  <div className="p-4 bg-green-50 rounded-lg">
                    <p className="text-sm text-gray-600">Active Today</p>
                    <p className="text-2xl font-bold mt-1">0</p>
                  </div>
                  <div className="p-4 bg-purple-50 rounded-lg">
                    <p className="text-sm text-gray-600">This Month</p>
                    <p className="text-2xl font-bold mt-1">0</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Empty State */}
          {!isLoading && clients.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">No Clients Yet</h3>
                <p className="text-gray-500 mb-4">
                  Start by creating your first client profile
                </p>
              </CardContent>
            </Card>
          )}

          {/* Loading State */}
          {isLoading && (
            <Card>
              <CardContent className="py-12 flex justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        <ClientProfile
          client={selectedClient}
          onClose={() => setSelectedClient(null)}
        />
      )}

      <NewClientDialog
        open={showNewClientDialog}
        onOpenChange={setShowNewClientDialog}
        onClientCreated={(newClient) => {
          setShowNewClientDialog(false);
          setSelectedClient(newClient);
        }}
      />
    </div>
  );
}
