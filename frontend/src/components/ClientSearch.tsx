'use client';

import { useState, useEffect } from 'react';
import { Search, UserPlus } from 'lucide-react';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Card } from './ui/card';

interface Client {
  id: number | string;
  name: string;
  phoneNumber: string;
  email: string;
  joinDate: string;
}

interface ClientSearchProps {
  onClientSelect: (client: Client) => void;
  onNewClient: () => void;
  clients: Client[];
}

export function ClientSearch({ onClientSelect, onNewClient, clients }: ClientSearchProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredClients, setFilteredClients] = useState<Client[]>([]);
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredClients([]);
      setShowResults(false);
      return;
    }

    const term = searchTerm.toLowerCase();
    const filtered = clients.filter(
      (client) =>
        client &&
        ((client.phoneNumber && client.phoneNumber.toLowerCase().includes(term)) ||
          (client.name && client.name.toLowerCase().includes(term)))
    );

    setFilteredClients(filtered);
    setShowResults(true);
  }, [searchTerm, clients]);

  const handleClientClick = (client: Client) => {
    onClientSelect(client);
    setSearchTerm('');
    setShowResults(false);
  };

  return (
    <div className="relative w-full">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <Input
            type="text"
            placeholder="Search by phone number or name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-6 text-lg"
          />
        </div>
        <Button onClick={onNewClient} size="lg" className="flex items-center gap-2">
          <UserPlus className="h-5 w-5" />
          New Client
        </Button>
      </div>

      {showResults && (
        <Card className="absolute top-full mt-2 w-full max-h-96 overflow-y-auto z-50 shadow-lg">
          {filteredClients.length > 0 ? (
            <div className="divide-y">
              {filteredClients.map((client) => (
                client && (
                  <button
                    key={client.id}
                    onClick={() => handleClientClick(client)}
                    className="w-full text-left p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p>{client.name || 'N/A'}</p>
                        <p className="text-sm text-gray-600">{client.phoneNumber || 'N/A'}</p>
                      </div>
                      <p className="text-xs text-gray-400">
                        {client.joinDate ? new Date(client.joinDate).toLocaleDateString() : 'N/A'}
                      </p>
                    </div>
                  </button>
                )
              ))}
            </div>
          ) : (
            <div className="p-4 text-center text-gray-500">
              <p>No clients found</p>
              <Button
                variant="link"
                onClick={() => {
                  onNewClient();
                  setSearchTerm('');
                  setShowResults(false);
                }}
                className="mt-2"
              >
                Create new client
              </Button>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
