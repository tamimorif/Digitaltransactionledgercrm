'use client';

import React, { useState, useCallback } from 'react';
import {
    useCustomerCompliance,
    useComplianceDocuments,
    useUploadComplianceDocument,
    useInitiateVerification,
    useVerificationStatus,
} from '@/src/lib/queries/compliance.query';
import type { DocumentType, ComplianceDocument } from '@/src/lib/compliance-api';

interface IDUploadComponentProps {
    customerId: number;
    onComplete?: () => void;
}

const DOCUMENT_TYPES: { value: DocumentType; label: string; description: string }[] = [
    { value: 'ID_FRONT', label: 'ID Front', description: 'Front of government-issued ID' },
    { value: 'ID_BACK', label: 'ID Back', description: 'Back of government-issued ID' },
    { value: 'PASSPORT', label: 'Passport', description: 'Photo page of passport' },
    { value: 'DRIVING_LICENSE', label: 'Driver\'s License', description: 'Valid driver\'s license' },
    { value: 'SELFIE', label: 'Selfie', description: 'Clear photo of your face' },
    { value: 'ADDRESS_PROOF', label: 'Proof of Address', description: 'Utility bill or bank statement' },
];

const STATUS_COLORS = {
    PENDING: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    APPROVED: 'bg-green-100 text-green-800 border-green-300',
    REJECTED: 'bg-red-100 text-red-800 border-red-300',
    UNDER_REVIEW: 'bg-blue-100 text-blue-800 border-blue-300',
    EXPIRED: 'bg-gray-100 text-gray-800 border-gray-300',
    SUSPENDED: 'bg-orange-100 text-orange-800 border-orange-300',
};

export function IDUploadComponent({ customerId, onComplete }: IDUploadComponentProps) {
    const [selectedDocType, setSelectedDocType] = useState<DocumentType>('ID_FRONT');
    const [dragActive, setDragActive] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [showExternalVerification, setShowExternalVerification] = useState(false);

    // Queries
    const { data: compliance, isLoading: complianceLoading } = useCustomerCompliance(customerId);
    const { data: documents, isLoading: docsLoading } = useComplianceDocuments(compliance?.id || 0);
    const { data: verificationStatus, refetch: refetchStatus } = useVerificationStatus(
        compliance?.id || 0,
        showExternalVerification && !!compliance?.externalProviderId
    );

    // Mutations
    const uploadMutation = useUploadComplianceDocument();
    const initiateMutation = useInitiateVerification();

    const handleFileDrop = useCallback(
        async (e: React.DragEvent<HTMLDivElement>) => {
            e.preventDefault();
            setDragActive(false);
            setUploadError(null);

            const files = e.dataTransfer.files;
            if (files.length > 0 && compliance) {
                await handleFileUpload(files[0]);
            }
        },
        [compliance]
    );

    const handleFileSelect = useCallback(
        async (e: React.ChangeEvent<HTMLInputElement>) => {
            setUploadError(null);
            const files = e.target.files;
            if (files && files.length > 0 && compliance) {
                await handleFileUpload(files[0]);
            }
        },
        [compliance]
    );

    const handleFileUpload = async (file: File) => {
        if (!compliance) return;

        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
        if (!allowedTypes.includes(file.type)) {
            setUploadError('Invalid file type. Please upload JPEG, PNG, GIF, or PDF.');
            return;
        }

        // Validate file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
            setUploadError('File is too large. Maximum size is 10MB.');
            return;
        }

        try {
            await uploadMutation.mutateAsync({
                complianceId: compliance.id,
                documentType: selectedDocType,
                file,
            });
        } catch (error: any) {
            setUploadError(error.message || 'Failed to upload file');
        }
    };

    const handleInitiateVerification = async () => {
        if (!compliance) return;

        try {
            await initiateMutation.mutateAsync(compliance.id);
            setShowExternalVerification(true);
        } catch (error: any) {
            setUploadError(error.message || 'Failed to initiate verification');
        }
    };

    const getDocumentsByType = (type: DocumentType): ComplianceDocument[] => {
        return documents?.filter((d) => d.documentType === type) || [];
    };

    if (complianceLoading) {
        return (
            <div className="flex items-center justify-center p-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-2 text-gray-600">Loading compliance data...</span>
            </div>
        );
    }

    if (!compliance) {
        return (
            <div className="text-center p-8 text-red-600">
                Failed to load compliance information
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
            {/* Header */}
            <div className="mb-6 border-b pb-4">
                <h2 className="text-2xl font-bold text-gray-800">KYC Verification</h2>
                <p className="text-gray-600 mt-1">
                    Upload your identification documents to complete verification
                </p>
            </div>

            {/* Compliance Status Banner */}
            <div
                className={`mb-6 p-4 rounded-lg border ${STATUS_COLORS[compliance.status] || 'bg-gray-100'
                    }`}
            >
                <div className="flex items-center justify-between">
                    <div>
                        <span className="font-semibold">Verification Status: </span>
                        <span className="font-bold">{compliance.status}</span>
                    </div>
                    {compliance.riskLevel && (
                        <span className="text-sm">
                            Risk Level: <span className="font-medium">{compliance.riskLevel}</span>
                        </span>
                    )}
                </div>
                {compliance.lastVerificationDate && (
                    <div className="text-sm mt-2">
                        Last verified: {new Date(compliance.lastVerificationDate).toLocaleDateString()}
                    </div>
                )}
            </div>

            {/* Document Type Selector */}
            <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Document Type
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {DOCUMENT_TYPES.map((docType) => {
                        const uploaded = getDocumentsByType(docType.value);
                        const hasApproved = uploaded.some((d) => d.status === 'APPROVED');

                        return (
                            <button
                                key={docType.value}
                                onClick={() => setSelectedDocType(docType.value)}
                                className={`p-3 rounded-lg border-2 text-left transition-all ${selectedDocType === docType.value
                                    ? 'border-blue-500 bg-blue-50'
                                    : 'border-gray-200 hover:border-gray-300'
                                    } ${hasApproved ? 'ring-2 ring-green-400' : ''}`}
                            >
                                <div className="font-medium text-gray-800">{docType.label}</div>
                                <div className="text-xs text-gray-500 mt-1">{docType.description}</div>
                                {uploaded.length > 0 && (
                                    <div className="mt-2 flex gap-1">
                                        {uploaded.map((doc) => (
                                            <span
                                                key={doc.id}
                                                className={`text-xs px-2 py-0.5 rounded ${doc.status === 'APPROVED'
                                                    ? 'bg-green-100 text-green-700'
                                                    : doc.status === 'REJECTED'
                                                        ? 'bg-red-100 text-red-700'
                                                        : 'bg-yellow-100 text-yellow-700'
                                                    }`}
                                            >
                                                {doc.status}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Upload Area */}
            <div className="mb-6">
                <div
                    onDragEnter={() => setDragActive(true)}
                    onDragLeave={() => setDragActive(false)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleFileDrop}
                    className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${dragActive
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-300 hover:border-gray-400'
                        }`}
                >
                    <div className="mb-4">
                        <svg
                            className="mx-auto h-12 w-12 text-gray-400"
                            stroke="currentColor"
                            fill="none"
                            viewBox="0 0 48 48"
                        >
                            <path
                                d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                                strokeWidth={2}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                    </div>
                    <div className="text-gray-600 mb-2">
                        <span className="font-medium">Drop your file here</span> or{' '}
                        <label className="text-blue-600 hover:text-blue-700 cursor-pointer">
                            browse
                            <input
                                type="file"
                                className="hidden"
                                accept="image/jpeg,image/png,image/gif,application/pdf"
                                onChange={handleFileSelect}
                            />
                        </label>
                    </div>
                    <div className="text-xs text-gray-500">
                        Supports: JPEG, PNG, GIF, PDF (max 10MB)
                    </div>
                </div>

                {uploadMutation.isPending && (
                    <div className="mt-4 flex items-center justify-center">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mr-2"></div>
                        <span className="text-gray-600">Uploading...</span>
                    </div>
                )}

                {uploadError && (
                    <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
                        {uploadError}
                    </div>
                )}

                {uploadMutation.isSuccess && (
                    <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700">
                        ✅ Document uploaded successfully!
                    </div>
                )}
            </div>

            {/* Uploaded Documents List */}
            {documents && documents.length > 0 && (
                <div className="mb-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-3">Uploaded Documents</h3>
                    <div className="space-y-2">
                        {documents.map((doc) => (
                            <div
                                key={doc.id}
                                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                            >
                                <div className="flex items-center">
                                    <svg
                                        className="h-8 w-8 text-gray-400 mr-3"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                                        />
                                    </svg>
                                    <div>
                                        <div className="font-medium text-gray-800">
                                            {doc.documentType.replace('_', ' ')}
                                        </div>
                                        <div className="text-sm text-gray-500">
                                            {doc.originalFilename} • {(doc.fileSize / 1024).toFixed(1)} KB
                                        </div>
                                    </div>
                                </div>
                                <span
                                    className={`px-3 py-1 rounded-full text-sm font-medium ${doc.status === 'APPROVED'
                                        ? 'bg-green-100 text-green-700'
                                        : doc.status === 'REJECTED'
                                            ? 'bg-red-100 text-red-700'
                                            : 'bg-yellow-100 text-yellow-700'
                                        }`}
                                >
                                    {doc.status}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* External Verification Button */}
            <div className="border-t pt-6">
                <div className="flex flex-col sm:flex-row gap-4">
                    {!compliance.externalProviderId && (
                        <button
                            onClick={handleInitiateVerification}
                            disabled={initiateMutation.isPending}
                            className="flex-1 py-3 px-6 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-medium hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 transition-all"
                        >
                            {initiateMutation.isPending ? (
                                <>
                                    <span className="animate-spin inline-block mr-2">⟳</span>
                                    Starting Verification...
                                </>
                            ) : (
                                '🔐 Start Automated Verification'
                            )}
                        </button>
                    )}

                    {compliance.externalProviderId && (
                        <button
                            onClick={() => {
                                setShowExternalVerification(true);
                                refetchStatus();
                            }}
                            className="flex-1 py-3 px-6 bg-gray-600 text-white rounded-lg font-medium hover:bg-gray-700 transition-all"
                        >
                            📋 Check Verification Status
                        </button>
                    )}

                    {onComplete && compliance.status === 'APPROVED' && (
                        <button
                            onClick={onComplete}
                            className="flex-1 py-3 px-6 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-all"
                        >
                            ✅ Continue
                        </button>
                    )}
                </div>
            </div>

            {/* Verification Status Modal */}
            {showExternalVerification && verificationStatus && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                        <h3 className="text-xl font-bold mb-4">Verification Status</h3>
                        <div className="space-y-3">
                            <div className="flex justify-between">
                                <span className="text-gray-600">Status:</span>
                                <span className="font-medium">{verificationStatus.reviewStatus}</span>
                            </div>
                            {verificationStatus.reviewResult && (
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Result:</span>
                                    <span
                                        className={`font-medium ${verificationStatus.reviewResult === 'GREEN'
                                            ? 'text-green-600'
                                            : 'text-red-600'
                                            }`}
                                    >
                                        {verificationStatus.reviewResult}
                                    </span>
                                </div>
                            )}
                            {verificationStatus.idDocStatus && (
                                <div className="flex justify-between">
                                    <span className="text-gray-600">ID Document:</span>
                                    <span className="font-medium">{verificationStatus.idDocStatus}</span>
                                </div>
                            )}
                            {verificationStatus.selfieStatus && (
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Selfie:</span>
                                    <span className="font-medium">{verificationStatus.selfieStatus}</span>
                                </div>
                            )}
                            {verificationStatus.riskScore !== undefined && (
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Risk Score:</span>
                                    <span className="font-medium">{verificationStatus.riskScore}/100</span>
                                </div>
                            )}
                        </div>
                        <button
                            onClick={() => setShowExternalVerification(false)}
                            className="mt-6 w-full py-2 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default IDUploadComponent;
