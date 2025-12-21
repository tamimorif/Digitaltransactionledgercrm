'use client';

import React, { useState } from 'react';
import { useCreateQuickTicket } from '@/src/lib/queries/ticket.query';

interface ReportProblemButtonProps {
    entityType: 'transaction' | 'remittance' | 'pickup';
    entityId: number;
    entityLabel?: string;
    className?: string;
    variant?: 'button' | 'icon' | 'link';
}

export function ReportProblemButton({
    entityType,
    entityId,
    entityLabel,
    className = '',
    variant = 'button',
}: ReportProblemButtonProps) {
    const [showModal, setShowModal] = useState(false);
    const [issue, setIssue] = useState('');
    const createQuickTicket = useCreateQuickTicket();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!issue.trim()) return;

        try {
            await createQuickTicket.mutateAsync({
                entityType,
                entityId,
                issue,
            });
            setShowModal(false);
            setIssue('');
            // Show success toast or notification
        } catch (error) {
            console.error('Failed to create ticket:', error);
        }
    };

    const buttonContent = () => {
        switch (variant) {
            case 'icon':
                return (
                    <button
                        onClick={() => setShowModal(true)}
                        className={`p-2 text-gray-400 hover:text-red-500 transition-colors ${className}`}
                        title="Report a problem"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </button>
                );
            case 'link':
                return (
                    <button
                        onClick={() => setShowModal(true)}
                        className={`text-sm text-red-600 hover:text-red-700 hover:underline ${className}`}
                    >
                        Report Problem
                    </button>
                );
            default:
                return (
                    <button
                        onClick={() => setShowModal(true)}
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors ${className}`}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        Report Problem
                    </button>
                );
        }
    };

    return (
        <>
            {buttonContent()}

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
                        {/* Header */}
                        <div className="px-6 py-4 border-b bg-red-50">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                                        <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-gray-800">Report a Problem</h3>
                                        <p className="text-sm text-gray-500">
                                            {entityLabel || `${entityType.charAt(0).toUpperCase() + entityType.slice(1)} #${entityId}`}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowModal(false)}
                                    className="text-gray-400 hover:text-gray-600"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        {/* Body */}
                        <form onSubmit={handleSubmit} className="p-6">
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Describe the issue
                                </label>
                                <textarea
                                    value={issue}
                                    onChange={(e) => setIssue(e.target.value)}
                                    placeholder="Please describe the problem you're experiencing..."
                                    className="w-full px-4 py-3 border rounded-lg resize-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                                    rows={5}
                                    required
                                />
                            </div>

                            <div className="text-xs text-gray-500 mb-4">
                                <p>A support ticket will be created for our team to investigate.</p>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 py-2.5 px-4 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={!issue.trim() || createQuickTicket.isPending}
                                    className="flex-1 py-2.5 px-4 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                                >
                                    {createQuickTicket.isPending ? 'Submitting...' : 'Submit Report'}
                                </button>
                            </div>
                        </form>

                        {/* Success state */}
                        {createQuickTicket.isSuccess && (
                            <div className="absolute inset-0 bg-white flex items-center justify-center">
                                <div className="text-center">
                                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                    </div>
                                    <h4 className="font-semibold text-gray-800 mb-2">Report Submitted</h4>
                                    <p className="text-sm text-gray-500">Our team will investigate this issue.</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}

export default ReportProblemButton;
