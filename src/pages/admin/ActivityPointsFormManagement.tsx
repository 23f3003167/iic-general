import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, Settings, Loader2, Upload, RefreshCw } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { 
  activityPointsFormConfig, 
  pruneRemovedActivityPointsItems,
  type FormSection, 
  type FormField,
  type FieldType 
} from '@/lib/activityPointsFormConfig';

const CMA_SECTION_IDS = new Set([
  'student-name',
  'activity-type-selection',
  'common-mandatory-course',
  'dbms',
  'pdsa',
  'sc',
  'cloud-devops-cma',
  'cloud-devops',
]);

const isCmaSection = (section: FormSection) =>
  CMA_SECTION_IDS.has(section.id) || section.id.startsWith('cma-section-');

const getFieldLabel = (fieldId: string, sections: FormSection[]) =>
  sections.flatMap(section => section.fields).find(field => field.id === fieldId)?.label || fieldId;

type ActivityPointsConfigResponse = {
  success: boolean;
  error?: string;
  message?: string;
  data?: {
    config?: { sections?: FormSection[] };
    lastUpdated?: string | null;
  };
};

const requestActivityPointsConfig = async (
  apiUrl: string,
  action: 'getFormConfig' | 'saveFormConfig',
  sections?: FormSection[],
) => {
  const formData = new FormData();
  formData.append('action', action);
  if (sections) formData.append('config', JSON.stringify({ sections }));

  const response = await fetch(apiUrl, { method: 'POST', body: formData });
  if (!response.ok) throw new Error(`Request failed (${response.status}).`);

  const result = await response.json() as ActivityPointsConfigResponse;
  if (!result.success) throw new Error(result.error || result.message || 'The server rejected the request.');
  return result.data;
};

const serializeConfigForComparison = (sections: FormSection[]) => {
  const sortObjectKeys = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(sortObjectKeys);
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value).sort(([first], [second]) => first.localeCompare(second))
          .map(([key, item]) => [key, sortObjectKeys(item)])
      );
    }
    return value;
  };
  return JSON.stringify(sortObjectKeys({ sections }));
};

const parseAnswerList = (value: string) => value.split(/[\n,]/).map(answer => answer.trim()).filter(Boolean);

const findFieldById = (fieldId: string, sections: FormSection[]) =>
  sections.flatMap(section => section.fields).find(field => field.id === fieldId);

const selectAnswer = (currentValue: string, answer: string, selected: boolean) => {
  const answers = parseAnswerList(currentValue).filter(value => value !== answer);
  if (selected) answers.push(answer);
  return answers.join(', ');
};

const ConditionalAnswerEditor = ({
  field,
  value,
  onChange,
  id,
}: {
  field?: FormField;
  value: string;
  onChange: (value: string) => void;
  id: string;
}) => {
  if (field?.options?.length) {
    const selectedAnswers = parseAnswerList(value);
    const availableAnswers = [...new Set([...field.options, ...selectedAnswers])];
    return (
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">Choose the answer or answers that reveal this section.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {availableAnswers.map((answer, index) => (
            <label key={`${answer}-${index}`} className="flex items-start gap-2 text-sm">
              <Checkbox
                checked={selectedAnswers.includes(answer)}
                onCheckedChange={checked => onChange(selectAnswer(value, answer, checked === true))}
              />
              <span>{answer}</span>
            </label>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <Textarea
        id={id}
        value={value}
        onChange={event => onChange(event.target.value)}
        rows={2}
        placeholder="Enter the exact answer shown to students"
      />
      <p className="text-xs text-muted-foreground">Enter one exact answer per line. You can paste multiple answers.</p>
    </div>
  );
};

const createUniqueId = (label: string, existingIds: string[], prefix = '') => {
  const slug = label.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'item';
  const baseId = prefix ? `${prefix}-${slug}` : slug;
  let id = baseId;
  let suffix = 2;
  while (existingIds.includes(id)) {
    id = `${baseId}-${suffix}`;
    suffix += 1;
  }
  return id;
};

const ActivityPointsFormManagement = () => {
  const { toast } = useToast();
  const [sections, setSections] = useState<FormSection[]>([]);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [editingSection, setEditingSection] = useState<FormSection | null>(null);
  const [editingField, setEditingField] = useState<{ sectionId: string; field: FormField | null } | null>(null);
  const [activeScope, setActiveScope] = useState<'cma' | 'additional'>('cma');
  const [isSectionDialogOpen, setIsSectionDialogOpen] = useState(false);
  const [isFieldDialogOpen, setIsFieldDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [originalConfig, setOriginalConfig] = useState<FormSection[]>([]);
  const [hasUnsavedDefaultConfig, setHasUnsavedDefaultConfig] = useState(false);
  const [configLoadMessage, setConfigLoadMessage] = useState('');
  const [configLastUpdated, setConfigLastUpdated] = useState<string | null>(null);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setIsLoadingConfig(true);
    try {
      const apiUrl = import.meta.env.VITE_ACTIVITY_POINTS_API_URL;
      if (!apiUrl) {
        // Fallback to local config if no API URL
        setSections(activityPointsFormConfig.sections);
        setOriginalConfig(activityPointsFormConfig.sections);
        setHasUnsavedDefaultConfig(true);
        setConfigLoadMessage('Showing built-in defaults. Configure the Activity Points API URL to load or save shared settings.');
        return;
      }

      const savedConfig = await requestActivityPointsConfig(apiUrl, 'getFormConfig');
      setConfigLastUpdated(savedConfig?.lastUpdated || null);

      if (savedConfig?.config && Array.isArray(savedConfig.config.sections)) {
        const savedSections = savedConfig.config.sections;
        const cleanedSections = pruneRemovedActivityPointsItems({ sections: savedSections }).sections;
        const hasRemovedItems = JSON.stringify(savedSections) !== JSON.stringify(cleanedSections);
        setSections(cleanedSections);
        setOriginalConfig(cleanedSections);
        setConfigLoadMessage(hasRemovedItems
          ? 'Obsolete Internship System Commands items and Application Development profile fields were removed from this view. Save to persist the cleanup.'
          : '');
        setHasUnsavedDefaultConfig(hasRemovedItems || cleanedSections.length === 0);
      } else {
        // Fallback to local config
        setSections(activityPointsFormConfig.sections);
        setOriginalConfig(activityPointsFormConfig.sections);
        setHasUnsavedDefaultConfig(true);
        setConfigLoadMessage('The server returned no saved sections. Showing built-in defaults; save to create the shared config.');
      }
    } catch (error) {
      console.error('Failed to load config:', error);
      // Fallback to local config on error
      setSections(activityPointsFormConfig.sections);
      setOriginalConfig(activityPointsFormConfig.sections);
      setHasUnsavedDefaultConfig(true);
      setConfigLoadMessage(`Could not load the saved config. Showing built-in defaults. ${error instanceof Error ? error.message : 'Check the API connection.'}`);
    } finally {
      setIsLoadingConfig(false);
    }
  };

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  };

  const handleAddSection = (sectionData: Partial<FormSection>) => {
    const newSection: FormSection = {
      id: sectionData.id || createUniqueId(
        sectionData.title || 'section',
        sections.map(section => section.id),
        activeScope === 'cma' ? 'cma-section' : 'section'
      ),
      title: sectionData.title || 'New Section',
      description: sectionData.description,
      fields: [],
      conditionalLogic: sectionData.conditionalLogic,
    };
    setSections([...sections, newSection]);
    setIsSectionDialogOpen(false);
    toast({
      title: 'Section Added',
      description: 'New section has been added successfully.',
    });
  };

  const handleEditSection = (sectionData: Partial<FormSection>) => {
    if (!editingSection) return;
    setSections(sections.map(s => 
      s.id === editingSection.id ? { ...s, ...sectionData } : s
    ));
    setEditingSection(null);
    setIsSectionDialogOpen(false);
    toast({
      title: 'Section Updated',
      description: 'Section has been updated successfully.',
    });
  };

  const toggleCertificateUpload = (sectionId: string) => {
    setSections(sections.map(s => 
      s.id === sectionId ? { ...s, requiresCertificateUpload: !s.requiresCertificateUpload } : s
    ));
  };

  const handleDeleteSection = (sectionId: string) => {
    if (confirm('Are you sure you want to delete this section?')) {
      setSections(sections.filter(s => s.id !== sectionId));
      toast({
        title: 'Section Deleted',
        description: 'Section has been deleted.',
      });
    }
  };

  const handleAddField = (sectionId: string, fieldData: Partial<FormField>) => {
    const existingFieldIds = sections.flatMap(section => section.fields.map(field => field.id));
    const newField: FormField = {
      id: fieldData.id || createUniqueId(fieldData.label || 'field', existingFieldIds),
      label: fieldData.label || 'New Field',
      type: fieldData.type || 'shortAnswer',
      required: fieldData.required || false,
      placeholder: fieldData.placeholder,
      options: fieldData.options,
      validation: fieldData.validation,
      conditionalLogic: fieldData.conditionalLogic,
    };
    setSections(sections.map(s => 
      s.id === sectionId ? { ...s, fields: [...s.fields, newField] } : s
    ));
    setIsFieldDialogOpen(false);
    setEditingField(null);
    toast({
      title: 'Field Added',
      description: 'New field has been added successfully.',
    });
  };

  const handleEditField = (fieldData: Partial<FormField>) => {
    if (!editingField?.field) return;
    setSections(sections.map(s => 
      s.id === editingField.sectionId 
        ? { 
            ...s, 
            fields: s.fields.map(f => 
              f.id === editingField.field?.id ? { ...f, ...fieldData } : f
            ) 
          } 
        : s
    ));
    setEditingField(null);
    setIsFieldDialogOpen(false);
    toast({
      title: 'Field Updated',
      description: 'Field has been updated successfully.',
    });
  };

  const handleDeleteField = (sectionId: string, fieldId: string) => {
    if (confirm('Are you sure you want to delete this field?')) {
      setSections(sections.map(s => 
        s.id === sectionId 
          ? { ...s, fields: s.fields.filter(f => f.id !== fieldId) } 
          : s
      ));
      toast({
        title: 'Field Deleted',
        description: 'Field has been deleted.',
      });
    }
  };

  const openSectionDialog = (section?: FormSection) => {
    if (section) {
      setEditingSection(section);
    } else {
      setEditingSection(null);
    }
    setIsSectionDialogOpen(true);
  };

  const openFieldDialog = (sectionId: string, field?: FormField) => {
    if (field) {
      setEditingField({ sectionId, field });
    } else {
      setEditingField({ sectionId, field: null });
    }
    setIsFieldDialogOpen(true);
  };

  const visibleSections = sections.filter(section =>
    activeScope === 'cma' ? isCmaSection(section) : !isCmaSection(section)
  );

  const saveConfig = async () => {
    setIsSaving(true);
    try {
      const apiUrl = import.meta.env.VITE_ACTIVITY_POINTS_API_URL;
      if (!apiUrl) {
        toast({
          title: 'Configuration Error',
          description: 'API URL not configured. Please contact administrator.',
          variant: 'destructive',
        });
        setIsSaving(false);
        return;
      }

      await requestActivityPointsConfig(apiUrl, 'saveFormConfig', sections);
      const verifiedConfig = await requestActivityPointsConfig(apiUrl, 'getFormConfig');
      const savedSections = verifiedConfig?.config?.sections;
      if (!Array.isArray(savedSections) ||
          serializeConfigForComparison(savedSections) !== serializeConfigForComparison(sections)) {
        throw new Error('The server accepted the save, but the reloaded config does not match. Your edits are still on this page. Check the Apps Script deployment and spreadsheet, then retry.');
      }

      setSections(savedSections);
      setOriginalConfig(savedSections);
      setHasUnsavedDefaultConfig(false);
      setConfigLastUpdated(verifiedConfig?.lastUpdated || null);
      setConfigLoadMessage('');
      toast({
        title: 'Configuration saved and verified',
        description: 'The saved config was reloaded from the server and matches your changes.',
      });
    } catch (error) {
      toast({
        title: 'Save Failed',
        description: error instanceof Error ? error.message : 'An error occurred while saving.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const undoConfig = () => {
    setSections(originalConfig);
    toast({
      title: 'Changes Undone',
      description: 'Configuration has been reverted to the last saved state.',
    });
  };

  const fieldTypes: FieldType[] = ['email', 'shortAnswer', 'dropdown', 'radio', 'checkbox', 'multiline'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Activity Points Form Management</h1>
          <p className="text-muted-foreground">
            Choose an activity group, then edit its student-facing questions and requirements.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={undoConfig} variant="outline" disabled={JSON.stringify(sections) === JSON.stringify(originalConfig)}>
            <Settings className="mr-2 h-4 w-4" />
            Undo Changes
          </Button>
          <Button
            onClick={saveConfig}
            disabled={isSaving || isLoadingConfig || (!hasUnsavedDefaultConfig && JSON.stringify(sections) === JSON.stringify(originalConfig))}
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Settings className="mr-2 h-4 w-4" />
                Save Config
              </>
            )}
          </Button>
          <Button type="button" variant="outline" onClick={loadConfig} disabled={isSaving || isLoadingConfig}>
            {isLoadingConfig ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Reload Saved Config
          </Button>
          <Button onClick={() => openSectionDialog()}>
            <Plus className="mr-2 h-4 w-4" />
            Add Section
          </Button>
        </div>
      </div>

      <div className="space-y-1" role="status" aria-live="polite">
        {configLoadMessage && <p className="text-sm text-destructive">{configLoadMessage}</p>}
        {configLastUpdated && !configLoadMessage && (
          <p className="text-sm text-muted-foreground">
            Last saved: {new Date(configLastUpdated).toLocaleString()}
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Activity group">
        <Button
          type="button"
          role="tab"
          aria-selected={activeScope === 'cma'}
          variant={activeScope === 'cma' ? 'default' : 'outline'}
          onClick={() => setActiveScope('cma')}
        >
          Common Mandatory Activities (CMA)
        </Button>
        <Button
          type="button"
          role="tab"
          aria-selected={activeScope === 'additional'}
          variant={activeScope === 'additional' ? 'default' : 'outline'}
          onClick={() => setActiveScope('additional')}
        >
          Internship and Placement
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        {activeScope === 'cma'
          ? 'CMA contains DBMS, PDSA, System Commands, and Cloud & DevOps. The first section controls the student’s activity-type choice.'
          : 'This group contains the internship- and placement-specific activity paths.'}
      </p>

      <div className="space-y-4">
        {visibleSections.map((section) => (
          <Card key={section.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div 
                  className="flex items-center gap-2 cursor-pointer flex-1"
                  onClick={() => toggleSection(section.id)}
                >
                  {expandedSections.has(section.id) ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  <CardTitle className="text-lg">{section.title}</CardTitle>
                  {section.conditionalLogic && (
                    <Badge variant="secondary">Conditional</Badge>
                  )}
                  {section.requiresCertificateUpload && (
                    <Badge variant="outline" className="flex items-center gap-1">
                      <Upload className="h-3 w-3" />
                      Requires Upload
                    </Badge>
                  )}
                </div>
                <div className="flex gap-2 items-center">
                  <div className="flex items-center gap-2 mr-2">
                    <Switch
                      checked={section.requiresCertificateUpload || false}
                      onCheckedChange={() => toggleCertificateUpload(section.id)}
                    />
                    <span className="text-sm text-muted-foreground">Certificate Upload</span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => openSectionDialog(section)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDeleteSection(section.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {section.description && (
                <CardDescription>{section.description}</CardDescription>
              )}
            </CardHeader>
            {expandedSections.has(section.id) && (
              <CardContent className="space-y-4">
                {section.conditionalLogic && (
                  <div className="bg-muted/50 p-3 rounded-md">
                    <p className="text-sm font-medium mb-2">Conditional Logic:</p>
                    <div className="space-y-1">
                      {section.conditionalLogic.showWhen.map((condition, idx) => (
                        <div key={idx} className="text-sm text-muted-foreground">
                          Show when <span className="font-medium">{getFieldLabel(condition.fieldId, sections)}</span>
                          {condition.equals && (
                            <> equals <span className="font-mono">{Array.isArray(condition.equals) ? condition.equals.join(', ') : condition.equals}</span></>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Fields ({section.fields.length})</p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openFieldDialog(section.id)}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Field
                    </Button>
                  </div>
                  
                  {section.fields.map((field) => (
                    <div key={field.id} className="border rounded-md p-3 space-y-2">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{field.label}</span>
                            <Badge variant="outline" className="text-xs">{field.type}</Badge>
                            {field.required && (
                              <Badge variant="destructive" className="text-xs">Required</Badge>
                            )}
                            {field.conditionalLogic && (
                              <Badge variant="secondary" className="text-xs">Conditional</Badge>
                            )}
                          </div>
                          {field.placeholder && (
                            <p className="text-xs text-muted-foreground mt-1">Placeholder: {field.placeholder}</p>
                          )}
                          {field.options && field.options.length > 0 && (
                            <p className="text-xs text-muted-foreground">
                              Options: {field.options.join(', ')}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openFieldDialog(section.id, field)}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteField(section.id, field.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            )}
          </Card>
        ))}
      </div>

      {/* Section Dialog */}
      <Dialog open={isSectionDialogOpen} onOpenChange={setIsSectionDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingSection ? 'Edit Section' : 'Add New Section'}
            </DialogTitle>
            <DialogDescription>
              {editingSection
                ? 'Change the title, instructions, or when students see this section.'
                : 'Create a group of questions. Add rules only when students should see it for specific answers.'}
            </DialogDescription>
          </DialogHeader>
          <SectionForm
            section={editingSection}
            sections={sections}
            onSubmit={editingSection ? handleEditSection : handleAddSection}
            onCancel={() => setIsSectionDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Field Dialog */}
      <Dialog open={isFieldDialogOpen} onOpenChange={setIsFieldDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingField?.field ? 'Edit Field' : 'Add New Field'}
            </DialogTitle>
            <DialogDescription>
              {editingField?.field ? 'Update field details' : 'Create a new form field'}
            </DialogDescription>
          </DialogHeader>
          <FieldForm
            field={editingField?.field}
            sections={sections}
            onSubmit={editingField?.field ? handleEditField : (data) => editingField && handleAddField(editingField.sectionId, data)}
            onCancel={() => {
              setIsFieldDialogOpen(false);
              setEditingField(null);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

const SectionForm = ({ 
  section, 
  sections,
  onSubmit, 
  onCancel 
}: { 
  section: FormSection | null; 
  sections: FormSection[];
  onSubmit: (data: Partial<FormSection>) => void;
  onCancel: () => void;
}) => {
  const [formData, setFormData] = useState({
    id: section?.id || '',
    title: section?.title || '',
    description: section?.description || '',
    conditionalLogic: section?.conditionalLogic || null,
  });

  const [conditions, setConditions] = useState(
    section?.conditionalLogic?.showWhen?.map(c => ({
      fieldId: c.fieldId,
      equals: Array.isArray(c.equals) ? c.equals.join(', ') : (c.equals || ''),
      notEquals: c.notEquals || '',
    })) || []
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const conditionalLogic = conditions.length > 0 ? {
      showWhen: conditions.map(c => ({
        fieldId: c.fieldId,
        equals: c.equals ? parseAnswerList(c.equals) : undefined,
        notEquals: c.notEquals || undefined,
    }))
    } : undefined;
    onSubmit({ ...formData, conditionalLogic });
  };

  const addCondition = () => {
    setConditions([...conditions, { fieldId: '', equals: '', notEquals: '' }]);
  };

  const removeCondition = (index: number) => {
    setConditions(conditions.filter((_, i) => i !== index));
  };

  const updateCondition = (index: number, field: string, value: string) => {
    setConditions(conditions.map((c, i) => 
      i === index ? { ...c, [field]: value } : c
    ));
  };

  const allFieldIds = [...new Set(sections.flatMap(currentSection => currentSection.fields.map(field => field.id)))];

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="sectionTitle">Section Title *</Label>
        <Input
          id="sectionTitle"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          placeholder="For example: DBMS activities"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="sectionDescription">Description</Label>
        <Textarea
          id="sectionDescription"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          rows={3}
          placeholder="Briefly describe what students should submit in this section."
        />
      </div>
      
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <Label>When should students see this section?</Label>
            <p className="text-xs text-muted-foreground">When you add multiple rules, every answer must match.</p>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={addCondition}>
            <Plus className="mr-2 h-3 w-3" />
            Add Condition
          </Button>
        </div>
        {conditions.map((condition, index) => (
          <div key={index} className="border rounded-md p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Condition {index + 1}</span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => removeCondition(index)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
            <div className="space-y-2">
              <div className="space-y-1">
                <Label htmlFor={`condition-field-${index}`} className="text-xs">Show this section based on</Label>
                <Select
                  value={condition.fieldId || undefined}
                  onValueChange={(value) => updateCondition(index, 'fieldId', value)}
                >
                  <SelectTrigger id={`condition-field-${index}`} className="text-sm">
                    <SelectValue placeholder="Choose a question" />
                  </SelectTrigger>
                  <SelectContent>
                    {allFieldIds.map(fieldId => (
                      <SelectItem key={fieldId} value={fieldId}>{getFieldLabel(fieldId, sections)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Answer that shows this section</Label>
                <ConditionalAnswerEditor
                  id={`condition-equals-${index}`}
                  field={findFieldById(condition.fieldId, sections)}
                  value={condition.equals}
                  onChange={value => updateCondition(index, 'equals', value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`condition-not-equals-${index}`} className="text-xs">Hide for this answer (optional)</Label>
                <Input
                  id={`condition-not-equals-${index}`}
                  value={condition.notEquals}
                  onChange={(e) => updateCondition(index, 'notEquals', e.target.value)}
                  placeholder="Optional answer to exclude"
                  className="text-sm"
                />
              </div>
            </div>
          </div>
        ))}
      </div>
      
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">
          {section ? 'Update Section' : 'Add Section'}
        </Button>
      </DialogFooter>
    </form>
  );
};

const FieldForm = ({ 
  field, 
  sections,
  onSubmit, 
  onCancel 
}: { 
  field: FormField | null; 
  sections: FormSection[];
  onSubmit: (data: Partial<FormField>) => void;
  onCancel: () => void;
}) => {
  const [formData, setFormData] = useState({
    id: field?.id || '',
    label: field?.label || '',
    type: field?.type || 'shortAnswer' as FieldType,
    required: field?.required || false,
    placeholder: field?.placeholder || '',
    options: field?.options?.join('\n') || '',
  });

  const [conditions, setConditions] = useState(
    field?.conditionalLogic?.showWhen?.map(c => ({
      fieldId: c.fieldId,
      equals: Array.isArray(c.equals) ? c.equals.join(', ') : (c.equals || ''),
      notEquals: c.notEquals || '',
    })) || []
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const options = formData.options
      .split(/[\n,]/)
      .map(option => option.trim())
      .filter(Boolean);
    
    const conditionalLogic = conditions.length > 0 ? {
      showWhen: conditions.map(c => ({
        fieldId: c.fieldId,
        equals: c.equals ? parseAnswerList(c.equals) : undefined,
        notEquals: c.notEquals || undefined,
    }))
    } : undefined;
    
    onSubmit({
      ...formData,
      options: options.length > 0 ? options : undefined,
      conditionalLogic,
    });
  };

  const addCondition = () => {
    setConditions([...conditions, { fieldId: '', equals: '', notEquals: '' }]);
  };

  const removeCondition = (index: number) => {
    setConditions(conditions.filter((_, i) => i !== index));
  };

  const updateCondition = (index: number, field: string, value: string) => {
    setConditions(conditions.map((c, i) => 
      i === index ? { ...c, [field]: value } : c
    ));
  };

  // Get all available field IDs for conditional logic
  const allFieldIds = [...new Set(sections.flatMap(s => s.fields.map(f => f.id)))];

  const needsOptions = ['dropdown', 'radio', 'checkbox'].includes(formData.type);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
      </div>
      <div className="space-y-2">
        <Label htmlFor="fieldLabel">Field Label *</Label>
        <Input
          id="fieldLabel"
          value={formData.label}
          onChange={(e) => setFormData({ ...formData, label: e.target.value })}
          placeholder="For example: Certificate URL"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="fieldType">Field Type *</Label>
        <Select
          value={formData.type}
          onValueChange={(value: FieldType) => setFormData({ ...formData, type: value })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="email">Email</SelectItem>
            <SelectItem value="shortAnswer">Short Answer</SelectItem>
            <SelectItem value="multiline">Multiline Text</SelectItem>
            <SelectItem value="dropdown">Dropdown</SelectItem>
            <SelectItem value="radio">Radio Button</SelectItem>
            <SelectItem value="checkbox">Checkbox</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-2">
        <input
          id="fieldRequired"
          type="checkbox"
          checked={formData.required}
          onChange={(e) => setFormData({ ...formData, required: e.target.checked })}
          className="rounded"
        />
        <Label htmlFor="fieldRequired" className="cursor-pointer">
          Required Field
        </Label>
      </div>
      <div className="space-y-2">
          <Label htmlFor="fieldPlaceholder">Hint shown inside the input</Label>
        <Input
          id="fieldPlaceholder"
          value={formData.placeholder}
          onChange={(e) => setFormData({ ...formData, placeholder: e.target.value })}
          placeholder="Enter your name..."
        />
      </div>
      {needsOptions && (
        <div className="space-y-2">
          <Label htmlFor="fieldOptions">Answer choices (one per line) *</Label>
          <Textarea
            id="fieldOptions"
            value={formData.options}
            onChange={(e) => setFormData({ ...formData, options: e.target.value })}
            rows={3}
            placeholder={'Option 1\nOption 2\nOption 3'}
            required
          />
          <p className="text-xs text-muted-foreground">Each line becomes one choice students can select.</p>
        </div>
      )}
      
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <Label>When should students see this question?</Label>
            <p className="text-xs text-muted-foreground">Every added rule must match for this question to appear.</p>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={addCondition}>
            <Plus className="mr-2 h-3 w-3" />
            Add Condition
          </Button>
        </div>
        {conditions.map((condition, index) => (
          <div key={index} className="border rounded-md p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Condition {index + 1}</span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => removeCondition(index)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
            <div className="space-y-2">
              <div className="space-y-1">
                <Label htmlFor={`field-condition-field-${index}`} className="text-xs">Show this question based on</Label>
                <Select
                  value={condition.fieldId}
                  onValueChange={(value) => updateCondition(index, 'fieldId', value)}
                >
                  <SelectTrigger id={`field-condition-field-${index}`} className="text-sm">
                    <SelectValue placeholder="Select field" />
                  </SelectTrigger>
                  <SelectContent>
                    {allFieldIds.map(fieldId => (
                      <SelectItem key={fieldId} value={fieldId}>{getFieldLabel(fieldId, sections)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Answer that shows this question</Label>
                <ConditionalAnswerEditor
                  id={`field-condition-equals-${index}`}
                  field={findFieldById(condition.fieldId, sections)}
                  value={condition.equals}
                  onChange={value => updateCondition(index, 'equals', value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`field-condition-not-equals-${index}`} className="text-xs">Not Equals</Label>
                <Input
                  id={`field-condition-not-equals-${index}`}
                  value={condition.notEquals}
                  onChange={(e) => updateCondition(index, 'notEquals', e.target.value)}
                  placeholder="Value to exclude"
                  className="text-sm"
                />
              </div>
            </div>
          </div>
        ))}
      </div>
      
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">
          {field ? 'Update Field' : 'Add Field'}
        </Button>
      </DialogFooter>
    </form>
  );
};

export default ActivityPointsFormManagement;
