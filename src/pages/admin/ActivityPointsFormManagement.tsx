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
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, Settings, Loader2, Upload } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { 
  activityPointsFormConfig, 
  ensureStudentNameSection,
  type FormSection, 
  type FormField,
  type FieldType 
} from '@/lib/activityPointsFormConfig';

const ActivityPointsFormManagement = () => {
  const { toast } = useToast();
  const [sections, setSections] = useState<FormSection[]>([]);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [editingSection, setEditingSection] = useState<FormSection | null>(null);
  const [editingField, setEditingField] = useState<{ sectionId: string; field: FormField } | null>(null);
  const [isSectionDialogOpen, setIsSectionDialogOpen] = useState(false);
  const [isFieldDialogOpen, setIsFieldDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [originalConfig, setOriginalConfig] = useState<FormSection[]>([]);
  const [hasUnsavedDefaultConfig, setHasUnsavedDefaultConfig] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const apiUrl = import.meta.env.VITE_ACTIVITY_POINTS_API_URL;
      if (!apiUrl) {
        // Fallback to local config if no API URL
        setSections(activityPointsFormConfig.sections);
        setOriginalConfig(activityPointsFormConfig.sections);
        return;
      }

      const formData = new FormData();
      formData.append('action', 'getFormConfig');

      const response = await fetch(apiUrl, {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (result.success && result.data?.config && Array.isArray(result.data.config.sections)) {
        const configSections = result.data.config.sections.filter(
          (section: FormSection) => section.id !== 'certificate-upload'
        );
        const configToLoad = configSections.length > 0
          ? ensureStudentNameSection(configSections)
          : activityPointsFormConfig.sections;
        setSections(configToLoad);
        setOriginalConfig(configToLoad);
        setHasUnsavedDefaultConfig(
          configSections.length === 0 ||
          !configSections.some((section: FormSection) => section.id === 'student-name')
        );
      } else {
        // Fallback to local config
        setSections(activityPointsFormConfig.sections);
        setOriginalConfig(activityPointsFormConfig.sections);
        setHasUnsavedDefaultConfig(false);
      }
    } catch (error) {
      console.error('Failed to load config:', error);
      // Fallback to local config on error
      setSections(activityPointsFormConfig.sections);
      setOriginalConfig(activityPointsFormConfig.sections);
      setHasUnsavedDefaultConfig(false);
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
      id: sectionData.id || `section-${Date.now()}`,
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
    const newField: FormField = {
      id: fieldData.id || `field-${Date.now()}`,
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
    if (!editingField) return;
    setSections(sections.map(s => 
      s.id === editingField.sectionId 
        ? { 
            ...s, 
            fields: s.fields.map(f => 
              f.id === editingField.field.id ? { ...f, ...fieldData } : f
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
      setEditingField({ sectionId, field: { id: '', label: '', type: 'shortAnswer', required: false } });
    }
    setIsFieldDialogOpen(true);
  };

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

      const formData = new FormData();
      formData.append('action', 'saveFormConfig');
      formData.append('config', JSON.stringify({ sections }));

      const response = await fetch(apiUrl, {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (result.success) {
        setOriginalConfig(sections);
        setHasUnsavedDefaultConfig(false);
        toast({
          title: 'Configuration Saved',
          description: 'Form configuration has been saved and will reflect immediately in the general portal.',
        });
      } else {
        throw new Error(result.error || 'Save failed');
      }
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
            Manage form sections, fields, and conditional logic
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={undoConfig} variant="outline" disabled={JSON.stringify(sections) === JSON.stringify(originalConfig)}>
            <Settings className="mr-2 h-4 w-4" />
            Undo Changes
          </Button>
          <Button
            onClick={saveConfig}
            disabled={isSaving || (!hasUnsavedDefaultConfig && JSON.stringify(sections) === JSON.stringify(originalConfig))}
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
          <Button onClick={() => openSectionDialog()}>
            <Plus className="mr-2 h-4 w-4" />
            Add Section
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {sections.map((section) => (
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
                          Show when <span className="font-mono">{condition.fieldId}</span>
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
              {editingSection ? 'Update section details' : 'Create a new form section'}
            </DialogDescription>
          </DialogHeader>
          <SectionForm
            section={editingSection}
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
  onSubmit, 
  onCancel 
}: { 
  section: FormSection | null; 
  onSubmit: (data: Partial<FormSection>) => void;
  onCancel: () => void;
}) => {
  const [formData, setFormData] = useState({
    id: section?.id || '',
    title: section?.title || '',
    description: section?.description || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="sectionId">Section ID *</Label>
        <Input
          id="sectionId"
          value={formData.id}
          onChange={(e) => setFormData({ ...formData, id: e.target.value })}
          placeholder="student-info"
          required
          disabled={!!section}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="sectionTitle">Section Title *</Label>
        <Input
          id="sectionTitle"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          placeholder="Student Information"
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
          placeholder="Section description..."
        />
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
    options: field?.options?.join(', ') || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const options = formData.options
      .split(',')
      .map(o => o.trim())
      .filter(Boolean);
    
    onSubmit({
      ...formData,
      options: options.length > 0 ? options : undefined,
    });
  };

  const needsOptions = ['dropdown', 'radio', 'checkbox'].includes(formData.type);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="fieldId">Field ID *</Label>
        <Input
          id="fieldId"
          value={formData.id}
          onChange={(e) => setFormData({ ...formData, id: e.target.value })}
          placeholder="studentName"
          required
          disabled={!!field}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="fieldLabel">Field Label *</Label>
        <Input
          id="fieldLabel"
          value={formData.label}
          onChange={(e) => setFormData({ ...formData, label: e.target.value })}
          placeholder="Student Name"
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
        <Label htmlFor="fieldPlaceholder">Placeholder</Label>
        <Input
          id="fieldPlaceholder"
          value={formData.placeholder}
          onChange={(e) => setFormData({ ...formData, placeholder: e.target.value })}
          placeholder="Enter your name..."
        />
      </div>
      {needsOptions && (
        <div className="space-y-2">
          <Label htmlFor="fieldOptions">Options (comma-separated) *</Label>
          <Textarea
            id="fieldOptions"
            value={formData.options}
            onChange={(e) => setFormData({ ...formData, options: e.target.value })}
            rows={3}
            placeholder="Option 1, Option 2, Option 3"
            required
          />
        </div>
      )}
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
