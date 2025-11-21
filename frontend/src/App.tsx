import { useState, useEffect } from 'react';
import { DailyRatesWidget } from './components/DailyRatesWidget';
import { ClientSearch } from './components/ClientSearch';
import { ClientProfile } from './components/ClientProfile';
import { NewClientDialog } from './components/NewClientDialog';
import { Toaster } from './components/ui/sonner';
import { Card, CardContent } from './components/ui/card';
import { toast } from 'sonner';
import { Building2, TrendingUp } from 'lucide-react';

interface Client {
  id: string | number;
  name: string;
  phoneNumber: string;
  email: string;
  joinDate: string;
}

export default function App() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showNewClientDialog, setShowNewClientDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    setIsLoading(true);
    try {
      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
      const response = await fetch(`${API_BASE_URL}/api/clients`);

      if (!response.ok) {
        throw new Error('Failed to fetch clients');
      }

      const data = await response.json();
      // Filter out any null or invalid clients
      const validClients = (data || []).filter(
        (client: Client | null) =>
          client && client.id && client.name && client.phoneNumber
      );
      setClients(validClients);
    } catch (error) {
      console.error('Error fetching clients:', error);
      toast.error('Failed to load clients');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClientCreated = (newClient: Client) => {
    setClients((prev) => [...prev, newClient]);
    setSelectedClient(newClient);
  };

  const handleClientSelect = (client: Client) => {
    setSelectedClient(client);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster position="top-right" />

      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-600 flex items-center justify-center">
              <Building2 className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1>Transaction Ledger & Client CRM</h1>
              <p className="text-sm text-gray-500">
                Currency Exchange & Remittance Management
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
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
                  <h2 className="mb-2">Find Client</h2>
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
                    <h3>Quick Stats</h3>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <p className="text-sm text-gray-600">Total Clients</p>
                      <p className="text-2xl mt-1">{clients.length}</p>
                    </div>
                    <div className="p-4 bg-green-50 rounded-lg">
                      <p className="text-sm text-gray-600">Active Today</p>
                      <p className="text-2xl mt-1">0</p>
                    </div>
                    <div className="p-4 bg-purple-50 rounded-lg">
                      <p className="text-sm text-gray-600">This Month</p>
                      <p className="text-2xl mt-1">0</p>
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
                  <h3 className="mb-2">No Clients Yet</h3>
                  <p className="text-gray-500 mb-4">
                    Start by creating your first client profile
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        ) : (
          <ClientProfile client={selectedClient} onClose={() => setSelectedClient(null)} />
        )}
      </main>

      <NewClientDialog
        open={showNewClientDialog}
        onOpenChange={setShowNewClientDialog}
        onClientCreated={handleClientCreated}
      />
    </div>
  );
}
