'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
    useTemplates,
    useTemplate,
    useTemplatePreview,
    useAvailableVariables,
    useCreateTemplate,
    useUpdateTemplate,
    useDeleteTemplate,
    useSetDefaultTemplate,
    useDuplicateTemplate,
    useCreateDefaultTemplates,
} from '@/src/lib/queries/receipt.query';
import {
    TEMPLATE_TYPE_LABELS,
    PAGE_SIZE_OPTIONS,
    ORIENTATION_OPTIONS,
    type ReceiptTemplate,
    type ReceiptVariable,
    type CreateTemplateRequest,
} from '@/src/lib/receipt-api';

export function ReceiptTemplateDesigner() {
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [editMode, setEditMode] = useState(false);
    const [showPreview, setShowPreview] = useState(false);
    const [activeSection, setActiveSection] = useState<'header' | 'body' | 'footer'>('body');

    const { data: templates, isLoading: templatesLoading } = useTemplates();
    const { data: selectedTemplate } = useTemplate(selectedId || 0);
    const { data: previewHtml } = useTemplatePreview(selectedId || 0);
    const { data: variables } = useAvailableVariables(selectedTemplate?.templateType || 'transaction');

    const createDefaultTemplates = useCreateDefaultTemplates();

    // Group templates by type
    const groupedTemplates = useMemo(() => {
        if (!templates) return {};
        return templates.reduce((acc, t) => {
            if (!acc[t.templateType]) acc[t.templateType] = [];
            acc[t.templateType].push(t);
            return acc;
        }, {} as Record<string, ReceiptTemplate[]>);
    }, [templates]);

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b px-6 py-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">Receipt Template Designer</h1>
                        <p className="text-sm text-gray-500">Customize your receipt templates</p>
                    </div>
                    {templates?.length === 0 && (
                        <button
                            onClick={() => createDefaultTemplates.mutate()}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                        >
                            Create Default Templates
                        </button>
                    )}
                </div>
            </div>

            <div className="flex h-[calc(100vh-69px)]">
                {/* Sidebar - Template List */}
                <div className="w-64 bg-white border-r overflow-y-auto">
                    <div className="p-4">
                        <button
                            onClick={() => { setSelectedId(null); setEditMode(true); }}
                            className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 mb-4"
                        >
                            + New Template
                        </button>

                        {templatesLoading ? (
                            <div className="text-center py-8 text-gray-500">Loading...</div>
                        ) : (
                            Object.entries(groupedTemplates).map(([type, temps]) => (
                                <div key={type} className="mb-4">
                                    <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">
                                        {TEMPLATE_TYPE_LABELS[type] || type}
                                    </h3>
                                    <div className="space-y-1">
                                        {temps.map((t) => (
                                            <button
                                                key={t.id}
                                                onClick={() => { setSelectedId(t.id); setEditMode(false); }}
                                                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${selectedId === t.id
                                                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                                        : 'hover:bg-gray-50 text-gray-700'
                                                    }`}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <span className="truncate">{t.name}</span>
                                                    {t.isDefault && (
                                                        <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                                                            Default
                                                        </span>
                                                    )}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Main Content */}
                <div className="flex-1 overflow-y-auto">
                    {selectedId && selectedTemplate && !editMode ? (
                        <TemplateViewer
                            template={selectedTemplate}
                            previewHtml={previewHtml || ''}
                            onEdit={() => setEditMode(true)}
                            onShowPreview={() => setShowPreview(true)}
                        />
                    ) : editMode ? (
                        <TemplateEditor
                            template={selectedId ? selectedTemplate : undefined}
                            activeSection={activeSection}
                            onSectionChange={setActiveSection}
                            onCancel={() => { setEditMode(false); if (!selectedId) setSelectedId(null); }}
                            onSave={(id) => { setSelectedId(id); setEditMode(false); }}
                        />
                    ) : (
                        <div className="flex items-center justify-center h-full text-gray-500">
                            Select a template or create a new one
                        </div>
                    )}
                </div>

                {/* Variables Panel */}
                {editMode && (
                    <VariablesPanel variables={variables || []} />
                )}
            </div>

            {/* Preview Modal */}
            {showPreview && previewHtml && (
                <PreviewModal
                    html={previewHtml}
                    onClose={() => setShowPreview(false)}
                />
            )}
        </div>
    );
}

function TemplateViewer({
    template,
    previewHtml,
    onEdit,
    onShowPreview,
}: {
    template: ReceiptTemplate;
    previewHtml: string;
    onEdit: () => void;
    onShowPreview: () => void;
}) {
    const setDefault = useSetDefaultTemplate();
    const duplicate = useDuplicateTemplate();
    const deleteTemplate = useDeleteTemplate();

    return (
        <div className="p-6">
            {/* Header */}
            <div className="flex items-start justify-between mb-6">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <h2 className="text-xl font-semibold text-gray-800">{template.name}</h2>
                        {template.isDefault && (
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                                Default
                            </span>
                        )}
                    </div>
                    <p className="text-sm text-gray-500">{template.description || 'No description'}</p>
                    <div className="flex gap-4 mt-2 text-sm text-gray-400">
                        <span>{TEMPLATE_TYPE_LABELS[template.templateType]}</span>
                        <span>{template.pageSize} • {template.orientation}</span>
                        <span>v{template.version}</span>
                    </div>
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={onShowPreview}
                        className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                    >
                        Preview
                    </button>
                    <button
                        onClick={onEdit}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                        Edit
                    </button>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="flex gap-2 mb-6">
                {!template.isDefault && (
                    <button
                        onClick={() => setDefault.mutate(template.id)}
                        className="text-sm text-blue-600 hover:underline"
                    >
                        Set as Default
                    </button>
                )}
                <button
                    onClick={() => duplicate.mutate({ id: template.id })}
                    className="text-sm text-gray-600 hover:underline"
                >
                    Duplicate
                </button>
                <button
                    onClick={() => {
                        if (confirm('Delete this template?')) {
                            deleteTemplate.mutate(template.id);
                        }
                    }}
                    className="text-sm text-red-600 hover:underline"
                >
                    Delete
                </button>
            </div>

            {/* Preview */}
            <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
                <div className="bg-gray-100 px-4 py-2 border-b text-sm text-gray-500">
                    Preview (with sample data)
                </div>
                <div
                    className="p-4 bg-white"
                    dangerouslySetInnerHTML={{ __html: previewHtml }}
                />
            </div>
        </div>
    );
}

function TemplateEditor({
    template,
    activeSection,
    onSectionChange,
    onCancel,
    onSave,
}: {
    template?: ReceiptTemplate | null;
    activeSection: 'header' | 'body' | 'footer';
    onSectionChange: (section: 'header' | 'body' | 'footer') => void;
    onCancel: () => void;
    onSave: (id: number) => void;
}) {
    const createTemplate = useCreateTemplate();
    const updateTemplate = useUpdateTemplate();

    const [form, setForm] = useState<CreateTemplateRequest>({
        name: '',
        description: '',
        templateType: 'transaction',
        headerHtml: '',
        bodyHtml: '',
        footerHtml: '',
        styleCss: '',
        pageSize: 'A4',
        orientation: 'portrait',
        marginTop: 20,
        marginRight: 20,
        marginBottom: 20,
        marginLeft: 20,
        logoPosition: 'center',
        isDefault: false,
    });

    useEffect(() => {
        if (template) {
            setForm({
                name: template.name,
                description: template.description || '',
                templateType: template.templateType,
                headerHtml: template.headerHtml || '',
                bodyHtml: template.bodyHtml || '',
                footerHtml: template.footerHtml || '',
                styleCss: template.styleCss || '',
                pageSize: template.pageSize,
                orientation: template.orientation,
                marginTop: template.marginTop,
                marginRight: template.marginRight,
                marginBottom: template.marginBottom,
                marginLeft: template.marginLeft,
                logoPosition: template.logoPosition,
                isDefault: template.isDefault,
            });
        }
    }, [template]);

    const handleSave = async () => {
        try {
            let result;
            if (template?.id) {
                result = await updateTemplate.mutateAsync({ id: template.id, request: form });
            } else {
                result = await createTemplate.mutateAsync(form);
            }
            onSave(result.id);
        } catch (error) {
            console.error('Failed to save template:', error);
        }
    };

    return (
        <div className="p-6">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-800">
                    {template ? 'Edit Template' : 'New Template'}
                </h2>
                <div className="flex gap-2">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={createTemplate.isPending || updateTemplate.isPending}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                        {createTemplate.isPending || updateTemplate.isPending ? 'Saving...' : 'Save Template'}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
                {/* Left - Settings */}
                <div className="space-y-4">
                    <div className="bg-white rounded-lg border p-4">
                        <h3 className="font-medium mb-4">Template Settings</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                                <input
                                    type="text"
                                    value={form.name}
                                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-lg"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                <input
                                    type="text"
                                    value={form.description || ''}
                                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-lg"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                                    <select
                                        value={form.templateType}
                                        onChange={(e) => setForm({ ...form, templateType: e.target.value })}
                                        className="w-full px-3 py-2 border rounded-lg"
                                    >
                                        {Object.entries(TEMPLATE_TYPE_LABELS).map(([value, label]) => (
                                            <option key={value} value={value}>{label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Page Size</label>
                                    <select
                                        value={form.pageSize}
                                        onChange={(e) => setForm({ ...form, pageSize: e.target.value })}
                                        className="w-full px-3 py-2 border rounded-lg"
                                    >
                                        {PAGE_SIZE_OPTIONS.map((opt) => (
                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Orientation</label>
                                <div className="flex gap-4">
                                    {ORIENTATION_OPTIONS.map((opt) => (
                                        <label key={opt.value} className="flex items-center gap-2">
                                            <input
                                                type="radio"
                                                name="orientation"
                                                value={opt.value}
                                                checked={form.orientation === opt.value}
                                                onChange={(e) => setForm({ ...form, orientation: e.target.value })}
                                            />
                                            {opt.label}
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={form.isDefault}
                                        onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
                                    />
                                    <span className="text-sm">Set as default for this type</span>
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* Custom CSS */}
                    <div className="bg-white rounded-lg border p-4">
                        <h3 className="font-medium mb-2">Custom CSS</h3>
                        <textarea
                            value={form.styleCss || ''}
                            onChange={(e) => setForm({ ...form, styleCss: e.target.value })}
                            className="w-full px-3 py-2 border rounded-lg font-mono text-sm"
                            rows={6}
                            placeholder="/* Add custom styles */"
                        />
                    </div>
                </div>

                {/* Right - HTML Editor */}
                <div className="bg-white rounded-lg border overflow-hidden">
                    {/* Section Tabs */}
                    <div className="flex border-b">
                        {(['header', 'body', 'footer'] as const).map((section) => (
                            <button
                                key={section}
                                onClick={() => onSectionChange(section)}
                                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${activeSection === section
                                        ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600'
                                        : 'text-gray-600 hover:bg-gray-50'
                                    }`}
                            >
                                {section.charAt(0).toUpperCase() + section.slice(1)}
                            </button>
                        ))}
                    </div>

                    {/* Editor */}
                    <div className="p-4">
                        <textarea
                            id={`editor-${activeSection}`}
                            value={form[`${activeSection}Html` as keyof CreateTemplateRequest] as string || ''}
                            onChange={(e) => setForm({
                                ...form,
                                [`${activeSection}Html`]: e.target.value,
                            })}
                            className="w-full h-80 px-3 py-2 border rounded-lg font-mono text-sm resize-none"
                            placeholder={`Enter HTML for ${activeSection}...`}
                        />
                        <p className="text-xs text-gray-500 mt-2">
                            Click on variables in the right panel to insert them into the template.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

function VariablesPanel({
    variables,
}: {
    variables: ReceiptVariable[];
}) {
    const groupedVariables = useMemo(() => {
        return variables.reduce((acc, v) => {
            if (!acc[v.category]) acc[v.category] = [];
            acc[v.category].push(v);
            return acc;
        }, {} as Record<string, ReceiptVariable[]>);
    }, [variables]);

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
    };

    return (
        <div className="w-72 bg-white border-l overflow-y-auto">
            <div className="p-4 border-b bg-gray-50">
                <h3 className="font-medium text-gray-800">Available Variables</h3>
                <p className="text-xs text-gray-500 mt-1">Click to copy to clipboard</p>
            </div>
            <div className="p-4 space-y-4">
                {Object.entries(groupedVariables).map(([category, vars]) => (
                    <div key={category}>
                        <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">
                            {category}
                        </h4>
                        <div className="space-y-1">
                            {vars.map((v) => (
                                <button
                                    key={v.name}
                                    onClick={() => copyToClipboard(v.name)}
                                    className="w-full text-left p-2 rounded hover:bg-gray-50 group"
                                    title={`Example: ${v.example}`}
                                >
                                    <code className="text-xs text-blue-600 font-mono">{v.name}</code>
                                    <p className="text-xs text-gray-500 truncate">{v.description}</p>
                                </button>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function PreviewModal({
    html,
    onClose,
}: {
    html: string;
    onClose: () => void;
}) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b">
                    <h3 className="font-semibold text-gray-800">Receipt Preview</h3>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => window.print()}
                            className="text-sm text-blue-600 hover:underline"
                        >
                            Print
                        </button>
                        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                            ✕
                        </button>
                    </div>
                </div>
                <div
                    className="p-8 overflow-y-auto max-h-[calc(90vh-60px)]"
                    dangerouslySetInnerHTML={{ __html: html }}
                />
            </div>
        </div>
    );
}

export default ReceiptTemplateDesigner;
