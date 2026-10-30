export type FieldType = 
  | 'email'
  | 'shortAnswer'
  | 'dropdown'
  | 'radio'
  | 'checkbox'
  | 'multiline';

export interface FormField {
  id: string;
  label: string;
  type: FieldType;
  required: boolean;
  placeholder?: string;
  options?: string[];
  validation?: {
    pattern?: string;
    message?: string;
    customValidator?: (value: string) => boolean | string;
  };
  conditionalLogic?: {
    showWhen: {
      fieldId: string;
      equals?: string | string[];
      notEquals?: string;
    }[];
  };
}

export interface FormSection {
  id: string;
  title: string;
  description?: string;
  fields: FormField[];
  requiresCertificateUpload?: boolean;
  conditionalLogic?: {
    showWhen: {
      fieldId: string;
      equals?: string | string[];
      notEquals?: string;
    }[];
  };
}

export interface FormConfig {
  sections: FormSection[];
}

const LEGACY_CERTIFICATE_UPLOAD_SECTION_ID = 'certificate-upload';

export const studentNameSection: FormSection = {
  id: 'student-name',
  title: 'Student Details',
  fields: [
    {
      id: 'studentName',
      label: 'Student Name',
      type: 'shortAnswer',
      required: true,
      placeholder: 'Enter your full name'
    }
  ]
};

const removedActivityPointsSectionIds = new Set([
  'internship-system-commands',
  'internship-system-commands-vm',
  'internship-system-commands-exercism',
]);

export const pruneRemovedActivityPointsItems = (config: FormConfig): FormConfig => ({
  ...config,
  sections: config.sections
    .filter(section => !removedActivityPointsSectionIds.has(section.id))
    .map(section => {
      if (section.id === 'mad-internship' || section.id === 'mad-placement') {
        return { ...section, fields: section.fields.filter(field => field.id !== 'seHackerrankProfile') };
      }
      if (section.id === 'internship-sd') {
        return {
          ...section,
          fields: section.fields.map(field => field.id === 'sdCourse'
            ? { ...field, options: field.options?.filter(option => option !== 'System Commands') }
            : field),
        };
      }
      return section;
    }),
});

const normalizeVmActivityTitle = (value: string) => {
  if (value === 'VM Tasks (1st series)') return 'VMT_1st series';
  if (value === 'VM Tasks (2nd series)') return 'VMT_2nd series';
  return value;
};

const conditionValueAliases: Record<string, Record<string, string[]>> = {
  subscriptionType: {
    'Internship - Software Development': ['Internship - Software Development', 'Internship - Programming'],
    'Internship - Programming': ['Internship - Software Development', 'Internship - Programming'],
    'Placement - Software Development': ['Placement - Software Development', 'Employment - Programming'],
    'Employment - Programming': ['Placement - Software Development', 'Employment - Programming'],
  },
  sdCourse: {
    'Modern Application Development': ['Modern Application Development', 'Application Development'],
    'Application Development': ['Modern Application Development', 'Application Development'],
  },
  placementSdCourse: {
    'Modern Application Development': ['Modern Application Development', 'Application Development'],
    'Application Development': ['Modern Application Development', 'Application Development'],
  },
  placementScActivityTitle: {
    'VM Tasks (2nd series)': ['VM Tasks (2nd series)', 'VMT_2nd series'],
    'VMT_2nd series': ['VM Tasks (2nd series)', 'VMT_2nd series'],
  },
};

const conditionFieldLabelAliases: Record<string, string[]> = {
  sdCourse: ['select the software development course', 'select the internship programming course'],
  placementSdCourse: ['select the programming course', 'select the employment programming course'],
  placementScActivityTitle: [
    'select employment plan system commands activity',
    'select system commands activity',
  ],
};

const normalizeConditionReference = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');

const getConfigFields = (config: FormConfig) => config.sections.flatMap(section => section.fields || []);

const resolveConditionField = (fieldId: string, config: FormConfig, formData: Record<string, string>) => {
  const fields = getConfigFields(config);
  const directMatch = fields.find(field => field.id === fieldId);
  if (directMatch && Object.prototype.hasOwnProperty.call(formData, directMatch.id)) return directMatch;

  const normalizedReference = normalizeConditionReference(fieldId);
  const labelMatch = fields.find(field =>
    normalizeConditionReference(field.label) === normalizedReference &&
    Object.prototype.hasOwnProperty.call(formData, field.id)
  );
  if (labelMatch) return labelMatch;

  const semanticFieldId = Object.entries(conditionFieldLabelAliases).find(([id, labels]) =>
    id === fieldId || labels.some(label => normalizeConditionReference(label) === normalizedReference)
  )?.[0];
  if (!semanticFieldId) return undefined;

  return fields.find(field => field.id === semanticFieldId && Object.prototype.hasOwnProperty.call(formData, field.id)) ||
    fields.find(field =>
      Object.prototype.hasOwnProperty.call(formData, field.id) &&
      (conditionFieldLabelAliases[semanticFieldId] || [])
        .some(label => normalizeConditionReference(field.label) === normalizeConditionReference(label))
    ) ||
    fields.find(field => field.id === semanticFieldId) || fields.find(field =>
    (conditionFieldLabelAliases[semanticFieldId] || [])
      .some(label => normalizeConditionReference(field.label) === normalizeConditionReference(label))
  );
};

const getConditionSemanticFieldId = (fieldId: string, field?: FormField) => {
  if (['sdCourse', 'placementSdCourse', 'placementScActivityTitle', 'subscriptionType'].includes(fieldId)) {
    return fieldId;
  }

  const label = normalizeConditionReference(field?.label || fieldId);
  const labelSemanticId = Object.entries(conditionFieldLabelAliases).find(([, labels]) =>
    labels.some(alias => normalizeConditionReference(alias) === label)
  )?.[0];
  if (labelSemanticId) return labelSemanticId;
  if (label.includes('subscriptiontype')) return 'subscriptionType';
  if (label.includes('systemcommandsactivity') && (label.includes('employment') || label.includes('placement'))) {
    return 'placementScActivityTitle';
  }
  if (label.includes('programmingcourse') || label.includes('employmentprogrammingcourse')) return 'placementSdCourse';
  if (label.includes('softwaredevelopmentcourse') || label.includes('internshipprogrammingcourse')) return 'sdCourse';

  return field?.id || fieldId;
};

const getNormalizedConditionValues = (fieldId: string, value: string) => {
  const normalizedValue = fieldId === 'placementScActivityTitle'
    ? normalizeVmActivityTitle(value)
    : value;
  const aliases = conditionValueAliases[fieldId];
  return Array.from(new Set(aliases?.[normalizedValue] || [normalizedValue]));
};

const projectFields: FormField[] = [1, 2, 3, 4].flatMap((projectNumber) => [
  {
    id: `project${projectNumber}Name`,
    label: `Project ${projectNumber} Name`,
    type: 'shortAnswer' as const,
    required: true,
    placeholder: 'Enter project name',
  },
  {
    id: `project${projectNumber}Link`,
    label: `Project ${projectNumber} (GitHub Link)`,
    type: 'shortAnswer' as const,
    required: true,
    placeholder: 'https://github.com/username/repo',
    validation: {
      pattern: '^https?://(www\\.)?github\\.com/.+',
      message: 'Please provide a valid GitHub repository URL',
    },
  },
]);

export const activityPointsFormConfig: FormConfig = 
  {
  "sections": [
    studentNameSection,
    {
      "id": "activity-type-selection",
      "title": "Activity Points Type",
      "fields": [
        {
          "id": "activityType",
          "label": "Choose Activity Points Type",
          "type": "radio",
          "required": true,
          "options": [
            "Common Mandatory Activity Points",
            "Additional Mandatory Activity Points"
          ]
        }
      ]
    },
    {
      "id": "common-mandatory-course",
      "title": "Common Mandatory Activity Points",
      "conditionalLogic": {
        "showWhen": [
          {
            "fieldId": "activityType",
            "equals": "Common Mandatory Activity Points"
          }
        ]
      },
      "fields": [
        {
          "id": "mandatoryCourse",
          "label": "Select the Mandatory Course",
          "type": "radio",
          "required": true,
          "options": [
            "DBMS",
            "PDSA",
            "SC (System Commands)",
            "Cloud & DevOps"
          ]
        }
      ]
    },
    {
      "id": "subscription-type",
      "title": "Plan-Specific Mandatory Activity Points",
      "conditionalLogic": {
        "showWhen": [
          {
            "fieldId": "activityType",
            "equals": "Additional Mandatory Activity Points"
          }
        ]
      },
      "fields": [
        {
          "id": "subscriptionType",
          "label": "Choose your Subscription Type",
          "type": "radio",
          "required": true,
          "options": [
            "Internship - Software Development",
            "Internship - Data Science",
            "Placement - Software Development",
            "Placement - Data Science"
          ]
        }
      ]
    },
    {
      "id": "internship-sd",
      "title": "Internship – Software Development",
      "conditionalLogic": {
        "showWhen": [
          {
            "fieldId": "subscriptionType",
            "equals": "Internship - Software Development"
          }
        ]
      },
      "fields": [
        {
          "id": "sdCourse",
          "label": "Select the Software Development Course",
          "type": "dropdown",
          "required": true,
          "options": [
            "Programming Concepts using Java",
            "Modern Application Development",
            "Software Engineer Intern Certificate",
            "Programming Workshop 1"
          ]
        }
      ]
    },
    {
      "id": "internship-ds",
      "title": "Internship – Data Science",
      "conditionalLogic": {
        "showWhen": [
          {
            "fieldId": "subscriptionType",
            "equals": "Internship - Data Science"
          }
        ]
      },
      "fields": [
        {
          "id": "dsCourse",
          "label": "Select the Data Science Course",
          "type": "dropdown",
          "required": true,
          "options": [
            "MLP - Kaggle Competition",
            "Machine Learning Basics Certificate",
            "Data Science Workshop 1"
          ]
        }
      ]
    },
    {
      "id": "placement-sd",
      "title": "Placement – Software Development",
      "conditionalLogic": {
        "showWhen": [
          {
            "fieldId": "subscriptionType",
            "equals": "Placement - Software Development"
          }
        ]
      },
      "fields": [
        {
          "id": "placementSdCourse",
          "label": "Select the Software Development Course",
          "type": "dropdown",
          "required": true,
          "options": [
            "Modern Application Development",
            "Software Engineer Certificate",
            "Cloud & DevOps",
            "System Commands",
            "Programming Workshop 2"
          ]
        }
      ]
    },
    {
      "id": "placement-ds",
      "title": "Placement – Data Science",
      "conditionalLogic": {
        "showWhen": [
          {
            "fieldId": "subscriptionType",
            "equals": "Placement - Data Science"
          }
        ]
      },
      "fields": [
        {
          "id": "placementDsCourse",
          "label": "Select the Data Science Course",
          "type": "dropdown",
          "required": true,
          "options": [
            "Data Visualization Design",
            "AWS",
            "Data Science Workshop 2",
            "DLP NPPE"
          ],
          "placeholder": ""
        }
      ]
    },
    {
      "id": "dbms",
      "title": "DBMS",
      "requiresCertificateUpload": true,
      "conditionalLogic": {
        "showWhen": [
          {
            "fieldId": "mandatoryCourse",
            "equals": "DBMS"
          }
        ]
      },
      "fields": [
        {
          "id": "dbmsActivityTitle",
          "label": "Activity Title for DBMS",
          "type": "dropdown",
          "required": true,
          "options": [
            "DBMS Easy",
            "DBMS Intermediate",
            "DBMS Advanced"
          ]
        },
        {
          "id": "dbmsHackerrankProfile",
          "label": "Link to Hackerrank Profile",
          "type": "shortAnswer",
          "required": true,
          "placeholder": "https://www.hackerrank.com/profile/username",
          "validation": {
            "pattern": "^https?://(www\\.)?hackerrank\\.com/.+",
            "message": "Please provide a valid HackerRank profile URL (not certificate URL)"
          }
        }
      ]
    },
    {
      "id": "pdsa",
      "title": "PDSA",
      "requiresCertificateUpload": true,
      "conditionalLogic": {
        "showWhen": [
          {
            "fieldId": "mandatoryCourse",
            "equals": "PDSA"
          }
        ]
      },
      "fields": [
        {
          "id": "pdsaActivityTitle",
          "label": "Activity Title for PDSA",
          "type": "dropdown",
          "required": true,
          "options": [
            "PDSA Easy",
            "PDSA Medium",
            "PDSA Hard"
          ]
        },
        {
          "id": "pdsaLeetcodeProfile",
          "label": "Link to Leetcode Profile",
          "type": "shortAnswer",
          "required": true,
          "placeholder": "https://leetcode.com/u/username",
          "validation": {
            "pattern": "^https?://(www\\.)?leetcode\\.com/.+",
            "message": "Please provide a valid LeetCode profile URL"
          }
        }
      ]
    },
    {
      "id": "sc",
      "title": "System Commands (CMA)",
      "requiresCertificateUpload": true,
      "conditionalLogic": {
        "showWhen": [
          {
            "fieldId": "activityType",
            "equals": "Common Mandatory Activity Points"
          },
          {
            "fieldId": "mandatoryCourse",
            "equals": "SC (System Commands)"
          }
        ]
      },
      "fields": [
        {
          "id": "scActivityTitle",
          "label": "Select CMA System Commands activity",
          "type": "radio",
          "required": true,
          "options": [
            "VMT_1st series"
          ]
        }
      ]
    },
    {
      "id": "cloud-devops-cma",
      "title": "Cloud & DevOps (CMA)",
      "requiresCertificateUpload": true,
      "conditionalLogic": {
        "showWhen": [
          {
            "fieldId": "activityType",
            "equals": "Common Mandatory Activity Points"
          },
          {
            "fieldId": "mandatoryCourse",
            "equals": "Cloud & DevOps"
          }
        ]
      },
      "fields": [
        {
          "id": "cloudActivityTitleCMA",
          "label": "Activity Title for Cloud & DevOps",
          "type": "radio",
          "required": true,
          "options": [
            "Intro to Cloud Computing by Simplilearn",
            "AWS Cloud Foundation Course",
            "Any other Similar Certifications"
          ]
        }
      ]
    },
    {
      "id": "placement-cloud-devops",
      "title": "Cloud & DevOps (AM_EP)",
      "requiresCertificateUpload": true,
      "conditionalLogic": {
        "showWhen": [
          {
            "fieldId": "activityType",
            "equals": "Additional Mandatory Activity Points"
          },
          {
            "fieldId": "subscriptionType",
            "equals": "Placement - Software Development"
          },
          {
            "fieldId": "placementSdCourse",
            "equals": "Cloud & DevOps"
          }
        ]
      },
      "fields": [
        {
          "id": "placementCloudActivityTitle",
          "label": "Activity Title for Cloud & DevOps",
          "type": "radio",
          "required": true,
          "options": [
            "Associate Certification"
          ]
        }
      ]
    },
    {
      "id": "associate-certifications",
      "title": "Associate Certifications",
      "requiresCertificateUpload": true,
      "conditionalLogic": {
        "showWhen": [
          {
            "fieldId": "activityType",
            "equals": "Additional Mandatory Activity Points"
          },
          {
            "fieldId": "subscriptionType",
            "equals": "Placement - Software Development"
          },
          {
            "fieldId": "placementSdCourse",
            "equals": "Cloud & DevOps"
          },
          {
            "fieldId": "placementCloudActivityTitle",
            "equals": "Associate Certification"
          }
        ]
      },
      "fields": [
        {
          "id": "certificateTitle",
          "label": "Certificate Title",
          "type": "radio",
          "required": true,
          "options": [
            "Microsoft Azure AZ204",
            "AWS Certified Solutions Architect – Associate",
            "AWS Certified Developer – Associate",
            "AWS Certified SysOps Administrator – Associate",
            "Google Associate Certifications"
          ]
        }
      ]
    },
    {
      "id": "java",
      "title": "JAVA",
      "requiresCertificateUpload": true,
      "conditionalLogic": {
        "showWhen": [
          {
            "fieldId": "sdCourse",
            "equals": "Programming Concepts using Java"
          }
        ]
      },
      "fields": [
        {
          "id": "javaActivityTitle",
          "label": "Activity Title for JAVA",
          "type": "dropdown",
          "required": true,
          "options": [
            "Java Tasks Easy",
            "Java Tasks Medium"
          ]
        },
        {
          "id": "javaHackerrankProfile",
          "label": "Link to Hackerrank Profile",
          "type": "shortAnswer",
          "required": true,
          "placeholder": "https://www.hackerrank.com/profile/username",
          "validation": {
            "pattern": "^https?://(www\\.)?hackerrank\\.com/.+",
            "message": "Please provide a valid HackerRank profile URL (not certificate URL)"
          }
        }
      ]
    },
    {
      "id": "mad-internship",
      "title": "Modern Application Development",
      "conditionalLogic": { "showWhen": [
        { "fieldId": "activityType", "equals": "Additional Mandatory Activity Points" },
        { "fieldId": "subscriptionType", "equals": "Internship - Software Development" },
        { "fieldId": "sdCourse", "equals": "Modern Application Development" }
      ] },
      "fields": projectFields
    },
    {
      "id": "mad-placement",
      "title": "Modern Application Development",
      "conditionalLogic": { "showWhen": [
        { "fieldId": "activityType", "equals": "Additional Mandatory Activity Points" },
        { "fieldId": "subscriptionType", "equals": "Placement - Software Development" },
        { "fieldId": "placementSdCourse", "equals": "Modern Application Development" }
      ] },
      "fields": projectFields
    },
    {
      "id": "se-cert-internship",
      "title": "Software Engineer Intern Certificate",
      "conditionalLogic": { "showWhen": [
        { "fieldId": "activityType", "equals": "Additional Mandatory Activity Points" },
        { "fieldId": "subscriptionType", "equals": "Internship - Software Development" },
        { "fieldId": "sdCourse", "equals": "Software Engineer Intern Certificate" }
      ] },
      "fields": [{
        "id": "seHackerrankProfile", "label": "Link to HackerRank Profile", "type": "shortAnswer", "required": true,
        "placeholder": "https://www.hackerrank.com/profile/username",
        "validation": { "pattern": "^https?://(www\\.)?hackerrank\\.com/.+", "message": "Please provide a valid HackerRank profile URL" }
      }]
    },
    {
      "id": "se-cert-placement",
      "title": "Software Engineer Certificate",
      "conditionalLogic": { "showWhen": [
        { "fieldId": "activityType", "equals": "Additional Mandatory Activity Points" },
        { "fieldId": "subscriptionType", "equals": "Placement - Software Development" },
        { "fieldId": "placementSdCourse", "equals": "Software Engineer Certificate" }
      ] },
      "fields": [{
        "id": "seHackerrankProfile", "label": "Link to HackerRank Profile", "type": "shortAnswer", "required": true,
        "placeholder": "https://www.hackerrank.com/profile/username",
        "validation": { "pattern": "^https?://(www\\.)?hackerrank\\.com/.+", "message": "Please provide a valid HackerRank profile URL" }
      }]
    },
    {
      "id": "programming-workshop-1",
      "title": "Programming Workshop 1",
      "requiresCertificateUpload": true,
      "conditionalLogic": { "showWhen": [
        { "fieldId": "activityType", "equals": "Additional Mandatory Activity Points" },
        { "fieldId": "subscriptionType", "equals": "Internship - Software Development" },
        { "fieldId": "sdCourse", "equals": "Programming Workshop 1" }
      ] },
      "fields": []
    },
    {
      "id": "machine-learning-basics",
      "title": "Machine Learning Basics Certificate",
      "requiresCertificateUpload": true,
      "conditionalLogic": { "showWhen": [
        { "fieldId": "activityType", "equals": "Additional Mandatory Activity Points" },
        { "fieldId": "subscriptionType", "equals": "Internship - Data Science" },
        { "fieldId": "dsCourse", "equals": "Machine Learning Basics Certificate" }
      ] },
      "fields": []
    },
    {
      "id": "data-science-workshop-1",
      "title": "Data Science Workshop 1",
      "requiresCertificateUpload": true,
      "conditionalLogic": { "showWhen": [
        { "fieldId": "activityType", "equals": "Additional Mandatory Activity Points" },
        { "fieldId": "subscriptionType", "equals": "Internship - Data Science" },
        { "fieldId": "dsCourse", "equals": "Data Science Workshop 1" }
      ] },
      "fields": []
    },
    {
      "id": "programming-workshop-2",
      "title": "Programming Workshop 2",
      "requiresCertificateUpload": true,
      "conditionalLogic": { "showWhen": [
        { "fieldId": "activityType", "equals": "Additional Mandatory Activity Points" },
        { "fieldId": "subscriptionType", "equals": "Placement - Software Development" },
        { "fieldId": "placementSdCourse", "equals": "Programming Workshop 2" }
      ] },
      "fields": []
    },
    {
      "id": "data-science-workshop-2",
      "title": "Data Science Workshop 2",
      "requiresCertificateUpload": true,
      "conditionalLogic": { "showWhen": [
        { "fieldId": "activityType", "equals": "Additional Mandatory Activity Points" },
        { "fieldId": "subscriptionType", "equals": "Placement - Data Science" },
        { "fieldId": "placementDsCourse", "equals": "Data Science Workshop 2" }
      ] },
      "fields": []
    },
    {
      "id": "placement-system-commands",
      "title": "System Commands (Placement)",
      "conditionalLogic": { "showWhen": [
        { "fieldId": "activityType", "equals": "Additional Mandatory Activity Points" },
        { "fieldId": "subscriptionType", "equals": "Placement - Software Development" },
        { "fieldId": "placementSdCourse", "equals": "System Commands" }
      ] },
      "fields": [{
        "id": "placementScActivityTitle",
        "label": "Select Employment Plan System Commands activity",
        "type": "radio",
        "required": true,
        "options": [
          "VMT_2nd series",
          "Bash Track on Exercism - Solved 30 problems",
          "Bash Track on Exercism - Reputation points is over 100"
        ]
      }]
    },
    {
      "id": "placement-system-commands-vm",
      "title": "System Commands – VM Tasks (2nd series)",
      "requiresCertificateUpload": true,
      "conditionalLogic": { "showWhen": [
        { "fieldId": "activityType", "equals": "Additional Mandatory Activity Points" },
        { "fieldId": "subscriptionType", "equals": "Placement - Software Development" },
        { "fieldId": "placementSdCourse", "equals": "System Commands" },
        { "fieldId": "placementScActivityTitle", "equals": "VM Tasks (2nd series)" }
      ] },
      "fields": []
    },
    {
      "id": "placement-system-commands-exercism",
      "title": "System Commands – Exercism",
      "conditionalLogic": { "showWhen": [
        { "fieldId": "activityType", "equals": "Additional Mandatory Activity Points" },
        { "fieldId": "subscriptionType", "equals": "Placement - Software Development" },
        { "fieldId": "placementSdCourse", "equals": "System Commands" },
        { "fieldId": "placementScActivityTitle", "equals": ["Bash Track on Exercism - Solved 30 problems", "Bash Track on Exercism - Reputation points is over 100"] }
      ] },
      "fields": [{
        "id": "scHackerrankProfile", "label": "Link to Exercism Profile", "type": "shortAnswer", "required": true,
        "placeholder": "https://exercism.org/profiles/username",
        "validation": { "pattern": "^https?://(www\\.)?exercism\\.org/profiles/[^/?#]+/?(?:[?#].*)?$", "message": "Please provide a valid Exercism profile URL" }
      }]
    },
    {
      "id": "mlp",
      "title": "Machine Learning Practice (Kaggle Competition)",
      "requiresCertificateUpload": true,
      "conditionalLogic": {
        "showWhen": [
          {
            "fieldId": "dsCourse",
            "equals": "MLP - Kaggle Competition"
          }
        ]
      },
      "fields": [
        {
          "id": "mlpActivityTitle",
          "label": "Activity Title for MLP",
          "type": "dropdown",
          "required": true,
          "options": [
            "Regression",
            "Classification"
          ]
        }
      ]
    },
    {
      "id": "dvd",
      "title": "Data Visualization Design",
      "requiresCertificateUpload": true,
      "conditionalLogic": {
        "showWhen": [
          {
            "fieldId": "placementDsCourse",
            "equals": "Data Visualization Design"
          }
        ]
      },
      "fields": [
        {
          "id": "dvdActivityTitle",
          "label": "Activity Title for Data Visualization Design",
          "type": "dropdown",
          "required": true,
          "options": [
            "Microsoft Power BI Data Analyst Certification",
            "Simplilearn Power BI Basics",
            "Tableau Certification",
            "Simplilearn Tableau Data Visualization",
            "Simplilearn Data Analysis with Python"
          ]
        }
      ]
    },
    {
      "id": "aws",
      "title": "Amazon Web Services",
      "requiresCertificateUpload": true,
      "conditionalLogic": {
        "showWhen": [
          {
            "fieldId": "placementDsCourse",
            "equals": "AWS"
          }
        ]
      },
      "fields": [
        {
          "id": "awsActivityTitle",
          "label": "Activity Title for AWS",
          "type": "dropdown",
          "required": true,
          "options": [
            "AWS Academy Course - Data Engineering",
            "Machine Learning Foundations",
            "Machine Learning for Natural Language Processing"
          ]
        }
      ]
    },
    {
      "id": "dlp-nppe",
      "title": "DLP NPPE",
      "requiresCertificateUpload": true,
      "conditionalLogic": {
        "showWhen": [
          {
            "fieldId": "activityType",
            "equals": "Additional Mandatory Activity Points"
          },
          {
            "fieldId": "subscriptionType",
            "equals": "Placement - Data Science"
          },
          {
            "fieldId": "placementDsCourse",
            "equals": "DLP NPPE"
          }
        ]
      },
      "fields": [
        {
          "id": "dlpNppeActivityTitle",
          "label": "Select NPPE",
          "type": "dropdown",
          "required": true,
          "options": [
            "NPPE 1",
            "NPPE 2",
            "NPPE 3"
          ]
        }
      ]
    }
  ]
};

export const getVisibleSections = (formData: Record<string, string>, config: FormConfig = activityPointsFormConfig): FormSection[] => {
  return config.sections.filter(section => {
    // Certificate upload is now rendered from the selected activity's setting,
    // rather than from the old standalone section.
    if (section.id === LEGACY_CERTIFICATE_UPLOAD_SECTION_ID) return false;

    if (!section.conditionalLogic) return true;
    
    return section.conditionalLogic.showWhen.every(condition => conditionMatches(condition, formData, config));
  });
};

const conditionMatches = (
  condition: NonNullable<FormSection['conditionalLogic']>['showWhen'][number],
  formData: Record<string, string>,
  config: FormConfig,
) => {
  const field = resolveConditionField(condition.fieldId, config, formData);
  const valueKey = Object.prototype.hasOwnProperty.call(formData, condition.fieldId)
    ? condition.fieldId
    : field?.id || condition.fieldId;
  const semanticFieldId = getConditionSemanticFieldId(condition.fieldId, field);
  const actualValues = getNormalizedConditionValues(semanticFieldId, formData[valueKey] || '');
  if (condition.equals) {
    const expectedValues = (Array.isArray(condition.equals) ? condition.equals : [condition.equals])
      .flatMap(value => getNormalizedConditionValues(semanticFieldId, value));
    if (!expectedValues.some(value => actualValues.includes(value))) return false;
  }
  if (condition.notEquals) {
    const excludedValues = getNormalizedConditionValues(semanticFieldId, condition.notEquals);
    if (excludedValues.some(value => actualValues.includes(value))) return false;
  }
  return true;
};

export const isFormFieldVisible = (
  field: FormField,
  formData: Record<string, string>,
  config: FormConfig = activityPointsFormConfig,
) => !field.conditionalLogic ||
  field.conditionalLogic.showWhen.every(condition => conditionMatches(condition, formData, config));

export const getVisibleFields = (
  section: FormSection,
  formData: Record<string, string>,
  config: FormConfig = activityPointsFormConfig,
): FormField[] => {
  return section.fields.filter(field => isFormFieldVisible(field, formData, config));
};

export const getFieldsToReset = (
  currentFormData: Record<string, string>,
  nextFormData: Record<string, string>,
  config: FormConfig = activityPointsFormConfig,
): string[] => {
  const currentSections = getVisibleSections(currentFormData, config);
  const nextSections = getVisibleSections(nextFormData, config);
  const nextSectionIds = new Set(nextSections.map(section => section.id));
  const nextVisibleFieldIds = new Set(
    nextSections.flatMap(section => getVisibleFields(section, nextFormData, config).map(field => field.id))
  );
  const fieldsInLeavingSections = currentSections
    .filter(section => !nextSectionIds.has(section.id))
    .flatMap(section => section.fields.map(field => field.id));
  const allFieldIds = config.sections.flatMap(section => section.fields.map(field => field.id));

  return Array.from(new Set([
    ...allFieldIds.filter(fieldId => !nextVisibleFieldIds.has(fieldId)),
    ...fieldsInLeavingSections,
  ]));
};
