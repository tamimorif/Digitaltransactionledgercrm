'use client';

import React, { useState, useEffect } from 'react';
import {
    useTickets,
    useTicketStats,
    useMyTickets,
    useCreateTicket,
    useUpdateTicketStatus,
    useAssignTicket,
    useResolveTicket,
} from '@/src/lib/queries/ticket.query';
import {
    PRIORITY_COLORS,
    STATUS_COLORS,
    STATUS_LABELS,
    PRIORITY_LABELS,
    CATEGORY_LABELS,
    type Ticket,
    type TicketStatus,
    type TicketPriority,
    type TicketCategory,
} from '@/src/lib/ticket-api';
import { getWebSocketService } from '@/src/lib/websocket.service';

interface SupportDashboardProps {
    currentUserId?: number;
}

export function SupportDashboard({ currentUserId }: SupportDashboardProps) {
    const [activeTab, setActiveTab] = useState<'all' | 'my' | 'create'>('all');
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
    const [filter, setFilter] = useState<{ status?: TicketStatus; priority?: TicketPriority }>({});

    const { data: stats } = useTicketStats();
    const { data: ticketData, isLoading: ticketsLoading, refetch: refetchTickets } = useTickets({
        ...filter,
        limit: 20,
    });
    const { data: myTickets, refetch: refetchMyTickets } = useMyTickets();

    // WebSocket subscription for real-time updates
    useEffect(() => {
        const ws = getWebSocketService();
        const unsubscribe = ws.subscribe('ticket', () => {
            refetchTickets();
            refetchMyTickets();
        });

        return () => unsubscribe();
    }, [refetchTickets, refetchMyTickets]);

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b px-6 py-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">Support Center</h1>
                        <p className="text-sm text-gray-500">Manage customer support tickets</p>
                    </div>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="p-6">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                    <StatCard
                        label="Open"
                        value={stats?.openCount || 0}
                        color="bg-yellow-500"
                    />
                    <StatCard
                        label="In Progress"
                        value={stats?.inProgressCount || 0}
                        color="bg-blue-500"
                    />
                    <StatCard
                        label="Critical"
                        value={stats?.criticalCount || 0}
                        color="bg-red-500"
                    />
                    <StatCard
                        label="Unassigned"
                        value={stats?.unassignedCount || 0}
                        color="bg-orange-500"
                    />
                    <StatCard
                        label="Resolved"
                        value={stats?.resolvedCount || 0}
                        color="bg-green-500"
                    />
                </div>

                {/* Tabs */}
                <div className="flex gap-4 mb-6">
                    <button
                        onClick={() => setActiveTab('all')}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'all'
                                ? 'bg-blue-600 text-white'
                                : 'bg-white text-gray-600 hover:bg-gray-50'
                            }`}
                    >
                        All Tickets
                    </button>
                    <button
                        onClick={() => setActiveTab('my')}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'my'
                                ? 'bg-blue-600 text-white'
                                : 'bg-white text-gray-600 hover:bg-gray-50'
                            }`}
                    >
                        My Tickets {myTickets && `(${myTickets.length})`}
                    </button>
                    <button
                        onClick={() => setActiveTab('create')}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'create'
                                ? 'bg-blue-600 text-white'
                                : 'bg-white text-gray-600 hover:bg-gray-50'
                            }`}
                    >
                        + New Ticket
                    </button>
                </div>

                {/* Filters */}
                {activeTab !== 'create' && (
                    <div className="flex gap-4 mb-6">
                        <select
                            value={filter.status || ''}
                            onChange={(e) => setFilter({ ...filter, status: e.target.value as TicketStatus || undefined })}
                            className="px-4 py-2 bg-white border rounded-lg text-gray-700"
                        >
                            <option value="">All Statuses</option>
                            {Object.entries(STATUS_LABELS).map(([value, label]) => (
                                <option key={value} value={value}>{label}</option>
                            ))}
                        </select>
                        <select
                            value={filter.priority || ''}
                            onChange={(e) => setFilter({ ...filter, priority: e.target.value as TicketPriority || undefined })}
                            className="px-4 py-2 bg-white border rounded-lg text-gray-700"
                        >
                            <option value="">All Priorities</option>
                            {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                                <option key={value} value={value}>{label}</option>
                            ))}
                        </select>
                    </div>
                )}

                {/* Content */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Ticket List */}
                    <div className="lg:col-span-2">
                        {activeTab === 'create' ? (
                            <CreateTicketForm onSuccess={() => { setActiveTab('all'); refetchTickets(); }} />
                        ) : (
                            <TicketList
                                tickets={activeTab === 'my' ? myTickets || [] : ticketData?.tickets || []}
                                loading={ticketsLoading}
                                onSelect={setSelectedTicket}
                                selectedId={selectedTicket?.id}
                            />
                        )}
                    </div>

                    {/* Ticket Detail */}
                    <div className="lg:col-span-1">
                        {selectedTicket ? (
                            <TicketDetail
                                ticket={selectedTicket}
                                currentUserId={currentUserId}
                                onClose={() => setSelectedTicket(null)}
                                onUpdate={() => { refetchTickets(); refetchMyTickets(); }}
                            />
                        ) : (
                            <div className="bg-white rounded-lg p-8 text-center text-gray-500">
                                Select a ticket to view details
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
    return (
        <div className="bg-white rounded-lg p-4 shadow-sm border">
            <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${color}`} />
                <div>
                    <p className="text-2xl font-bold text-gray-800">{value}</p>
                    <p className="text-sm text-gray-500">{label}</p>
                </div>
            </div>
        </div>
    );
}

function TicketList({
    tickets,
    loading,
    onSelect,
    selectedId,
}: {
    tickets: Ticket[];
    loading: boolean;
    onSelect: (ticket: Ticket) => void;
    selectedId?: number;
}) {
    if (loading) {
        return (
            <div className="bg-white rounded-lg p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
            </div>
        );
    }

    if (tickets.length === 0) {
        return (
            <div className="bg-white rounded-lg p-8 text-center text-gray-500">
                No tickets found
            </div>
        );
    }

    return (
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
            {tickets.map((ticket) => (
                <div
                    key={ticket.id}
                    onClick={() => onSelect(ticket)}
                    className={`p-4 border-b cursor-pointer hover:bg-gray-50 transition-colors ${selectedId === ticket.id ? 'bg-blue-50 border-l-4 border-l-blue-600' : ''
                        }`}
                >
                    <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${PRIORITY_COLORS[ticket.priority]}`}>
                                {PRIORITY_LABELS[ticket.priority]}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[ticket.status]}`}>
                                {STATUS_LABELS[ticket.status]}
                            </span>
                        </div>
                        <span className="text-xs text-gray-400">{ticket.ticketCode}</span>
                    </div>
                    <h3 className="font-medium text-gray-800 mb-1">{ticket.subject}</h3>
                    <p className="text-sm text-gray-500 line-clamp-2">{ticket.description}</p>
                    <div className="flex items-center justify-between mt-2 text-xs text-gray-400">
                        <span>{CATEGORY_LABELS[ticket.category]}</span>
                        <span>{new Date(ticket.createdAt).toLocaleDateString()}</span>
                    </div>
                </div>
            ))}
        </div>
    );
}

function TicketDetail({
    ticket,
    currentUserId,
    onClose,
    onUpdate,
}: {
    ticket: Ticket;
    currentUserId?: number;
    onClose: () => void;
    onUpdate: () => void;
}) {
    const updateStatus = useUpdateTicketStatus();
    const assignTicket = useAssignTicket();
    const resolveTicket = useResolveTicket();
    const [resolution, setResolution] = useState('');

    const handleStatusChange = async (status: TicketStatus) => {
        await updateStatus.mutateAsync({ id: ticket.id, status });
        onUpdate();
    };

    const handleAssignToMe = async () => {
        if (!currentUserId) return;
        await assignTicket.mutateAsync({ id: ticket.id, assignToUserId: currentUserId });
        onUpdate();
    };

    const handleResolve = async () => {
        if (!resolution.trim()) return;
        await resolveTicket.mutateAsync({ id: ticket.id, resolution });
        setResolution('');
        onUpdate();
    };

    return (
        <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-4 border-b flex items-start justify-between">
                <div>
                    <span className="text-xs text-gray-400">{ticket.ticketCode}</span>
                    <h3 className="font-semibold text-gray-800">{ticket.subject}</h3>
                </div>
                <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>

            <div className="p-4 space-y-4">
                {/* Status & Priority */}
                <div className="flex gap-2">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${PRIORITY_COLORS[ticket.priority]}`}>
                        {PRIORITY_LABELS[ticket.priority]}
                    </span>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${STATUS_COLORS[ticket.status]}`}>
                        {STATUS_LABELS[ticket.status]}
                    </span>
                </div>

                {/* Description */}
                <div>
                    <label className="block text-xs text-gray-500 mb-1">Description</label>
                    <p className="text-sm text-gray-700">{ticket.description}</p>
                </div>

                {/* Meta */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                        <label className="block text-xs text-gray-500">Category</label>
                        <span>{CATEGORY_LABELS[ticket.category]}</span>
                    </div>
                    <div>
                        <label className="block text-xs text-gray-500">Created</label>
                        <span>{new Date(ticket.createdAt).toLocaleString()}</span>
                    </div>
                    <div>
                        <label className="block text-xs text-gray-500">Assigned</label>
                        <span>{ticket.assignedToUser?.email || 'Unassigned'}</span>
                    </div>
                    {ticket.dueAt && (
                        <div>
                            <label className="block text-xs text-gray-500">Due By</label>
                            <span className={ticket.breachedSla ? 'text-red-600' : ''}>
                                {new Date(ticket.dueAt).toLocaleString()}
                            </span>
                        </div>
                    )}
                </div>

                {/* Actions */}
                {ticket.status !== 'CLOSED' && ticket.status !== 'RESOLVED' && (
                    <div className="space-y-2 pt-4 border-t">
                        {!ticket.assignedToUserId && currentUserId && (
                            <button
                                onClick={handleAssignToMe}
                                className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                            >
                                Assign to Me
                            </button>
                        )}

                        <div className="flex gap-2">
                            {ticket.status === 'OPEN' && (
                                <button
                                    onClick={() => handleStatusChange('IN_PROGRESS')}
                                    className="flex-1 py-2 px-4 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                                >
                                    Start Progress
                                </button>
                            )}
                            {ticket.status === 'IN_PROGRESS' && (
                                <button
                                    onClick={() => handleStatusChange('WAITING_CUSTOMER')}
                                    className="flex-1 py-2 px-4 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200"
                                >
                                    Mark Waiting
                                </button>
                            )}
                        </div>

                        <div className="pt-2">
                            <textarea
                                value={resolution}
                                onChange={(e) => setResolution(e.target.value)}
                                placeholder="Resolution notes..."
                                className="w-full p-2 border rounded-lg text-sm"
                                rows={3}
                            />
                            <button
                                onClick={handleResolve}
                                disabled={!resolution.trim()}
                                className="w-full mt-2 py-2 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                            >
                                Resolve Ticket
                            </button>
                        </div>
                    </div>
                )}

                {/* Resolution */}
                {ticket.resolution && (
                    <div className="pt-4 border-t">
                        <label className="block text-xs text-gray-500 mb-1">Resolution</label>
                        <p className="text-sm text-green-700 bg-green-50 p-3 rounded-lg">{ticket.resolution}</p>
                    </div>
                )}
            </div>
        </div>
    );
}

function CreateTicketForm({ onSuccess }: { onSuccess: () => void }) {
    const createTicket = useCreateTicket();
    const [form, setForm] = useState({
        subject: '',
        description: '',
        priority: 'MEDIUM' as TicketPriority,
        category: 'GENERAL' as TicketCategory,
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.subject.trim() || !form.description.trim()) return;

        await createTicket.mutateAsync(form);
        onSuccess();
    };

    return (
        <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-lg font-semibold mb-4">Create New Ticket</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                    <input
                        type="text"
                        value={form.subject}
                        onChange={(e) => setForm({ ...form, subject: e.target.value })}
                        className="w-full px-4 py-2 border rounded-lg"
                        required
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea
                        value={form.description}
                        onChange={(e) => setForm({ ...form, description: e.target.value })}
                        className="w-full px-4 py-2 border rounded-lg"
                        rows={5}
                        required
                    />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                        <select
                            value={form.priority}
                            onChange={(e) => setForm({ ...form, priority: e.target.value as TicketPriority })}
                            className="w-full px-4 py-2 border rounded-lg"
                        >
                            {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                                <option key={value} value={value}>{label}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                        <select
                            value={form.category}
                            onChange={(e) => setForm({ ...form, category: e.target.value as TicketCategory })}
                            className="w-full px-4 py-2 border rounded-lg"
                        >
                            {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                                <option key={value} value={value}>{label}</option>
                            ))}
                        </select>
                    </div>
                </div>
                <button
                    type="submit"
                    disabled={createTicket.isPending}
                    className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                    {createTicket.isPending ? 'Creating...' : 'Create Ticket'}
                </button>
            </form>
        </div>
    );
}

export default SupportDashboard;
