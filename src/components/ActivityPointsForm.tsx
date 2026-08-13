import { useState, useEffect, useRef } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { 
  activityPointsFormConfig, 
  getVisibleSections, 
  getVisibleFields,
  ensureStudentNameSection,
  type FormField,
  type FormSection,
  type FormConfig 
} from '@/lib/activityPointsFormConfig';
import { getStoredVerifiedEmail } from '@/lib/emailVerificationService';

interface ActivityPointsFormProps {
  onSubmit?: (data: Record<string, string>) => Promise<void>;
}

const REQUIRED_ACTIVITY_SECTION_IDS = new Set([
  'activity-type-selection',
  'common-mandatory-course',
  'subscription-type',
  'internship-sd',
  'internship-ds',
  'placement-sd',
  'placement-ds',
  'cloud-devops',
  'cloud-devops-cma',
  'placement-cloud-devops',
  'associate-certifications',
  'sc',
  'mad',
  'mad-internship',
  'mad-placement',
  'se-cert',
  'se-cert-internship',
  'se-cert-placement',
  'programming-workshop-1',
  'programming-workshop-2',
  'machine-learning-basics',
  'data-science-workshop-1',
  'data-science-workshop-2',
  'placement-system-commands',
  'placement-system-commands-vm',
  'placement-system-commands-exercism',
  'mlp',
]);

/**
 * The Apps Script may contain an older, admin-managed form configuration.
 * Replace the dependent activity branches with their bundled definitions so
 * newly deployed paths do not remain hidden behind an older saved config.
 */
const withRequiredActivityPaths = (config: FormConfig): FormConfig => ({
  ...config,
  sections: (() => {
    const savedSections = ensureStudentNameSection(config.sections);
    const savedById = new Map(savedSections.map((section) => [section.id, section]));
    const localIds = new Set(activityPointsFormConfig.sections.map((section) => section.id));

    // Keep the local configuration's order. The saved configuration can still
    // supply unrelated admin-managed sections, but it cannot move a dependent
    // section (such as JAVA) above Activity Type or course selection.
    const orderedSections = activityPointsFormConfig.sections.map((localSection) =>
      REQUIRED_ACTIVITY_SECTION_IDS.has(localSection.id)
        ? localSection
        : savedById.get(localSection.id) || localSection
    );

    const extraSavedSections = savedSections.filter(
      (section) => !localIds.has(section.id) && !REQUIRED_ACTIVITY_SECTION_IDS.has(section.id)
    );
    return [...orderedSections, ...extraSavedSections];
  })(),
});

const ActivityPointsForm = ({ onSubmit }: ActivityPointsFormProps) => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [visibleSections, setVisibleSections] = useState<FormSection[]>([]);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [formConfig, setFormConfig] = useState<FormConfig>(activityPointsFormConfig);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);

  // Use ref to track formConfig to prevent infinite loops
  const formConfigRef = useRef<FormConfig>(activityPointsFormConfig);

  const formSchema = z.object({
    activityType: z.string().min(1, 'Please select activity points type'),
    mandatoryCourse: z.string().optional(),
    subscriptionType: z.string().optional(),
    sdCourse: z.string().optional(),
    dsCourse: z.string().optional(),
    placementSdCourse: z.string().optional(),
    placementDsCourse: z.string().optional(),
    scActivityTitle: z.string().optional(),
    placementScActivityTitle: z.string().optional(),
    cloudActivityTitleCMA: z.string().optional(),
    placementCloudActivityTitle: z.string().optional(),
    certificateTitle: z.string().optional(),
    certificateLink: z.string().optional(),
  }).superRefine((data, context) => {
    const sections = getVisibleSections(data, formConfigRef.current);
    const requiresUpload = sections.some(section => section.requiresCertificateUpload);
    const certificateLink = data.certificateLink?.trim();

    if (requiresUpload && !certificateLink) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Certificate link is required',
        path: ['certificateLink'],
      });
    } else if (
      requiresUpload &&
      !/^https?:\/\/(www\.)?drive\.google\.com\/.+/.test(certificateLink!)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Please provide a Google Drive link with sharing set to "Anyone with the link can view"',
        path: ['certificateLink'],
      });
    }
  });

  const {
    register,
    handleSubmit,
    control,
    getValues,
    setValue,
    formState: { errors }
  } = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      activityType: '',
      mandatoryCourse: '',
      subscriptionType: '',
      sdCourse: '',
      dsCourse: '',
      placementSdCourse: '',
      placementDsCourse: '',
      scActivityTitle: '',
      placementScActivityTitle: '',
      cloudActivityTitleCMA: '',
      placementCloudActivityTitle: '',
      certificateTitle: '',
      certificateLink: '',
    }
  });

  // Keep validation in sync with every dynamic field, including studentName.
  const watchedFormData = useWatch({ control }) as Record<string, string | undefined>;

  useEffect(() => {
    loadFormConfig();
  }, []);

  useEffect(() => {
    const currentFormData = Object.fromEntries(
      Object.entries(watchedFormData).map(([fieldId, value]) => [fieldId, value ?? ''])
    ) as Record<string, string>;

    setFormData(currentFormData);
    const sections = getVisibleSections(currentFormData, formConfigRef.current);
    setVisibleSections(sections);
  }, [watchedFormData]);

  // Update ref when formConfig changes
  useEffect(() => {
    formConfigRef.current = formConfig;
    // Recalculate visible sections when config changes
    const currentFormData = getValues() as Record<string, string>;
    const sections = getVisibleSections(currentFormData, formConfig);
    setVisibleSections(sections);
  }, [formConfig, getValues]);

  const requiresCertificateUpload = visibleSections.some(section => section.requiresCertificateUpload);

  const loadFormConfig = async () => {
    try {
      const apiUrl = import.meta.env.VITE_ACTIVITY_POINTS_API_URL;
      if (!apiUrl) {
        // Fallback to local config if no API URL
        setFormConfig(activityPointsFormConfig);
        setIsLoadingConfig(false);
        return;
      }

      const formData = new FormData();
      formData.append('action', 'getFormConfig');

      const response = await fetch(apiUrl, {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (
        result.success &&
        result.data?.config &&
        Array.isArray(result.data.config.sections) &&
        result.data.config.sections.some((section: FormSection) => section.id !== 'certificate-upload')
      ) {
        const newConfig = withRequiredActivityPaths(result.data.config);
        setFormConfig(newConfig);
      } else {
        // An empty config is the Apps Script's uninitialized default.
        setFormConfig(activityPointsFormConfig);
      }
    } catch (error) {
      console.error('Failed to load form config:', error);
      // Fallback to local config on error
      setFormConfig(activityPointsFormConfig);
    } finally {
      setIsLoadingConfig(false);
    }
  };

  const validateField = (field: FormField, value: string): string | null => {
    if (field.required && !value.trim()) {
      return 'This field is required';
    }

    if (field.validation) {
      if (field.validation.pattern && value) {
        const regex = new RegExp(field.validation.pattern);
        if (!regex.test(value)) {
          return field.validation.message || 'Invalid format';
        }
      }

      if (field.validation.customValidator && value) {
        const result = field.validation.customValidator(value);
        if (typeof result === 'string') {
          return result;
        }
        if (!result) {
          return field.validation.message || 'Invalid value';
        }
      }
    }

    return null;
  };

  const renderField = (section: FormSection, field: FormField) => {
    const fieldError = validateField(field, formData[field.id] || '');
    const showError = hasSubmitted && fieldError;
    const isVisible = !field.conditionalLogic || field.conditionalLogic.showWhen.every(condition => {
      const fieldValue = formData[condition.fieldId];
      if (condition.equals) {
        return Array.isArray(condition.equals) 
          ? condition.equals.includes(fieldValue)
          : fieldValue === condition.equals;
      }
      if (condition.notEquals) {
        return fieldValue !== condition.notEquals;
      }
      return true;
    });

    if (!isVisible) return null;

    switch (field.type) {
      case 'email':
      case 'shortAnswer':
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={field.id}>
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Input
              id={field.id}
              type={field.type === 'email' ? 'email' : 'text'}
              placeholder={field.placeholder}
              {...register(field.id as any)}
              className={showError ? 'border-red-500' : ''}
            />
            {showError && (
              <p className="text-sm text-red-500 flex items-center gap-1">
                <AlertCircle className="h-4 w-4" />
                {fieldError}
              </p>
            )}
          </div>
        );

      case 'dropdown':
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={field.id}>
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Select
              onValueChange={(value) => setValue(field.id as any, value)}
              value={formData[field.id] || ''}
            >
              <SelectTrigger className={showError ? 'border-red-500' : ''}>
                <SelectValue placeholder={field.placeholder || 'Select an option'} />
              </SelectTrigger>
              <SelectContent>
                {field.options?.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {showError && (
              <p className="text-sm text-red-500 flex items-center gap-1">
                <AlertCircle className="h-4 w-4" />
                {fieldError}
              </p>
            )}
          </div>
        );

      case 'radio':
        return (
          <div key={field.id} className="space-y-2">
            <Label>
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <RadioGroup
              onValueChange={(value) => setValue(field.id as any, value)}
              value={formData[field.id] || ''}
            >
              {field.options?.map((option) => (
                <div key={option} className="flex items-center space-x-2">
                  <RadioGroupItem value={option} id={`${field.id}-${option}`} />
                  <Label htmlFor={`${field.id}-${option}`} className="font-normal cursor-pointer">
                    {option}
                  </Label>
                </div>
              ))}
            </RadioGroup>
            {showError && (
              <p className="text-sm text-red-500 flex items-center gap-1">
                <AlertCircle className="h-4 w-4" />
                {fieldError}
              </p>
            )}
          </div>
        );

      case 'checkbox':
        return (
          <div key={field.id} className="space-y-2">
            <Label>
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <div className="space-y-2">
              {field.options?.map((option) => (
                <div key={option} className="flex items-center space-x-2">
                  <Checkbox
                    id={`${field.id}-${option}`}
                    checked={(formData[field.id] || '').split(',').includes(option)}
                    onCheckedChange={(checked) => {
                      const currentValues = (formData[field.id] || '').split(',').filter(Boolean);
                      if (checked) {
                        currentValues.push(option);
                      } else {
                        const index = currentValues.indexOf(option);
                        if (index > -1) currentValues.splice(index, 1);
                      }
                      setValue(field.id as any, currentValues.join(','));
                    }}
                  />
                  <Label htmlFor={`${field.id}-${option}`} className="font-normal cursor-pointer">
                    {option}
                  </Label>
                </div>
              ))}
            </div>
            {showError && (
              <p className="text-sm text-red-500 flex items-center gap-1">
                <AlertCircle className="h-4 w-4" />
                {fieldError}
              </p>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  const onFormSubmit = async (data: any) => {
    setHasSubmitted(true);
    setIsSubmitting(true);

    try {
      // Read directly from React Hook Form so submission cannot validate a
      // stale render state.
      const currentFormData = getValues() as Record<string, string>;
      const currentVisibleSections = getVisibleSections(currentFormData, formConfigRef.current);

      // Validate all visible fields
      let hasErrors = false;
      currentVisibleSections.forEach(section => {
        const visibleFields = getVisibleFields(section, currentFormData);
        visibleFields.forEach(field => {
          const error = validateField(field, currentFormData[field.id] || '');
          if (error) {
            hasErrors = true;
          }
        });
      });

      if (hasErrors) {
        toast({
          title: 'Validation Error',
          description: 'Please fix all errors before submitting.',
          variant: 'destructive',
        });
        setIsSubmitting(false);
        return;
      }

      // Auto-fill student info from local storage
      const studentEmail = getStoredVerifiedEmail();
      if (!studentEmail) {
        toast({
          title: 'Authentication Error',
          description: 'Please sign in with Google to submit activity points.',
          variant: 'destructive',
        });
        setIsSubmitting(false);
        return;
      }

      const submissionData = {
        ...currentFormData,
        email: studentEmail,
        studentEmailId: studentEmail,
      };

      if (onSubmit) {
        await onSubmit(submissionData);
      } else {
        // Default submission logic - you can customize this
        const apiUrl = import.meta.env.VITE_ACTIVITY_POINTS_API_URL;
        if (apiUrl) {
          const formDataToSend = new FormData();
          Object.entries(submissionData).forEach(([key, value]) => {
            formDataToSend.append(key, value);
          });
          formDataToSend.append('action', 'submitActivityPoints');

          const response = await fetch(apiUrl, {
            method: 'POST',
            body: formDataToSend
          });

          const result = await response.json();

          if (result.success) {
            toast({
              title: 'Success',
              description: 'Your activity points submission has been recorded.',
            });
          } else {
            throw new Error(result.error || 'Submission failed');
          }
        } else {
          toast({
            title: 'Configuration Error',
            description: 'API URL not configured. Please contact administrator.',
            variant: 'destructive',
          });
        }
      }
    } catch (error) {
      toast({
        title: 'Submission Failed',
        description: error instanceof Error ? error.message : 'An error occurred during submission.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6">
      {isLoadingConfig ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Header Section */}
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-3">
                <h2 className="text-lg font-semibold">
                  Submit your certification proofs for activity points. Choose your course to proceed.
                </h2>
                <p className="text-muted-foreground">
                  Kindly go through the Placement Activity Points doc - 
                  <a 
                    href="https://docs.google.com/document/d/1wzhKEFjsz4m9b7Slhgfc-vDz4GszH3RplDxJpJ37Kqg"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline inline-flex items-center gap-1 ml-1"
                  >
                    Link <ExternalLink className="h-3 w-3" />
                  </a>
                </p>
              </div>
            </CardContent>
          </Card>

          {visibleSections.map((section) => {
            const visibleFields = getVisibleFields(section, formData);
            if (visibleFields.length === 0 && !section.description) return null;

            return (
              <Card key={section.id}>
                <CardHeader>
                  <CardTitle className="text-xl">{section.title}</CardTitle>
                  {section.description && (
                    <CardDescription>{section.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  {visibleFields.map(field => renderField(section, field))}
                </CardContent>
              </Card>
            );
          })}

          {requiresCertificateUpload && (
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Certificate Upload & Submission</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="certificateLink">
                    Upload Certificate & Profile Progress Screenshot (Google Drive link)
                    <span className="text-red-500 ml-1">*</span>
                  </Label>
                  <Input
                    id="certificateLink"
                    type="text"
                    placeholder="https://drive.google.com/file/d/..."
                    {...register('certificateLink')}
                    className={errors.certificateLink ? 'border-red-500' : ''}
                  />
                  {errors.certificateLink && (
                    <p className="text-sm text-red-500 flex items-center gap-1">
                      <AlertCircle className="h-4 w-4" />
                      {errors.certificateLink.message as string}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex justify-end">
            <Button type="submit" disabled={isSubmitting} size="lg">
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Submit Activity Points
                </>
              )}
            </Button>
          </div>
        </>
      )}
    </form>
  );
};

export default ActivityPointsForm;
