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

export const ensureStudentNameSection = (sections: FormSection[]): FormSection[] => {
  if (sections.some(section => section.id === studentNameSection.id)) {
    return sections;
  }

  return [studentNameSection, ...sections];
};

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
            "Application Development",
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
            "Data Science Workshop 2"
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
      "title": "System Commands (SC)",
      "requiresCertificateUpload": true,
      "conditionalLogic": {
        "showWhen": [
          {
            "fieldId": "mandatoryCourse",
            "equals": "SC (System Commands)"
          }
        ]
      },
      "fields": [
        {
          "id": "scActivityTitle",
          "label": "Activity Title for System Commands",
          "type": "dropdown",
          "required": true,
          "options": [
            "VM Tasks",
            "Bash Track on Exercism - Solved 30 problems",
            "Bash Track on Exercism - Reputation points is over 100"
          ]
        },
        {
          "id": "scVmTasksCount",
          "label": "How many questions have you finished in VM Tasks?",
          "type": "shortAnswer",
          "required": true,
          "placeholder": "Enter number or NA if Bash Track selected",
          "conditionalLogic": {
            "showWhen": [
              {
                "fieldId": "scActivityTitle",
                "equals": "VM Tasks"
              }
            ]
          }
        },
        {
          "id": "scHackerrankProfile",
          "label": "Link to Hackerrank Profile",
          "type": "shortAnswer",
          "required": true,
          "placeholder": "https://www.hackerrank.com/profile/username",
          "validation": {
            "pattern": "^https?://(www\\.)?hackerrank\\.com/.+",
            "message": "Please provide a valid HackerRank profile URL"
          }
        }
      ]
    },
    {
      "id": "cloud-devops",
      "title": "Cloud & DevOps",
      "requiresCertificateUpload": true,
      "conditionalLogic": {
        "showWhen": [
          {
            "fieldId": "mandatoryCourse",
            "equals": "Cloud & DevOps"
          },
          {
            "fieldId": "placementSdCourse",
            "equals": "Cloud & DevOps"
          }
        ]
      },
      "fields": [
        {
          "id": "cloudActivityTitle",
          "label": "Activity Title for Cloud & DevOps",
          "type": "dropdown",
          "required": true,
          "options": [
            "Intro to Cloud Computing by Simplilearn",
            "AWS Cloud Foundation Course",
            "Associate Certifications",
            "Any other Similar Certifications"
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
            "fieldId": "cloudActivityTitle",
            "equals": "Associate Certifications"
          }
        ]
      },
      "fields": [
        {
          "id": "certificateTitle",
          "label": "Certificate Title",
          "type": "checkbox",
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
      "id": "mad",
      "title": "Modern Application Development",
      "requiresCertificateUpload": true,
      "conditionalLogic": {
        "showWhen": [
          {
            "fieldId": "sdCourse",
            "equals": "Modern Application Development"
          },
          {
            "fieldId": "placementSdCourse",
            "equals": "Application Development"
          }
        ]
      },
      "fields": [
        {
          "id": "project1Name",
          "label": "Project 1 Name",
          "type": "shortAnswer",
          "required": false,
          "placeholder": "Enter project name"
        },
        {
          "id": "project1Link",
          "label": "Project 1 (GitHub Link)",
          "type": "shortAnswer",
          "required": true,
          "placeholder": "https://github.com/username/repo",
          "validation": {
            "pattern": "^https?://(www\\.)?github\\.com/.+",
            "message": "Please provide a valid GitHub repository URL"
          }
        },
        {
          "id": "project2Name",
          "label": "Project 2 Name",
          "type": "shortAnswer",
          "required": false,
          "placeholder": "Enter project name"
        },
        {
          "id": "project2Link",
          "label": "Project 2 (GitHub Link)",
          "type": "shortAnswer",
          "required": true,
          "placeholder": "https://github.com/username/repo",
          "validation": {
            "pattern": "^https?://(www\\.)?github\\.com/.+",
            "message": "Please provide a valid GitHub repository URL"
          }
        },
        {
          "id": "project3Name",
          "label": "Project 3 Name",
          "type": "shortAnswer",
          "required": false,
          "placeholder": "Enter project name"
        },
        {
          "id": "project3Link",
          "label": "Project 3 (GitHub Link)",
          "type": "shortAnswer",
          "required": true,
          "placeholder": "https://github.com/username/repo",
          "validation": {
            "pattern": "^https?://(www\\.)?github\\.com/.+",
            "message": "Please provide a valid GitHub repository URL"
          }
        },
        {
          "id": "project4Name",
          "label": "Project 4 Name",
          "type": "shortAnswer",
          "required": false,
          "placeholder": "Enter project name"
        },
        {
          "id": "project4Link",
          "label": "Project 4 (GitHub Link)",
          "type": "shortAnswer",
          "required": true,
          "placeholder": "https://github.com/username/repo",
          "validation": {
            "pattern": "^https?://(www\\.)?github\\.com/.+",
            "message": "Please provide a valid GitHub repository URL"
          }
        }
      ]
    },
    {
      "id": "se-cert",
      "title": "Software Engineer Certification",
      "requiresCertificateUpload": true,
      "conditionalLogic": {
        "showWhen": [
          {
            "fieldId": "sdCourse",
            "equals": "Software Engineer Intern Certificate"
          },
          {
            "fieldId": "placementSdCourse",
            "equals": "Software Engineer Certificate"
          }
        ]
      },
      "fields": [
        {
          "id": "seHackerrankProfile",
          "label": "Link to HackerRank Profile",
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
    }
  ]
};

export const getVisibleSections = (formData: Record<string, string>, config: FormConfig = activityPointsFormConfig): FormSection[] => {
  return config.sections.filter(section => {
    // Certificate upload is now rendered from the selected activity's setting,
    // rather than from the old standalone section.
    if (section.id === LEGACY_CERTIFICATE_UPLOAD_SECTION_ID) return false;

    if (!section.conditionalLogic) return true;
    
    return section.conditionalLogic.showWhen.every(condition => {
      const fieldValue = formData[condition.fieldId];
      if (condition.equals) {
        if (Array.isArray(condition.equals)) {
          return condition.equals.includes(fieldValue);
        }
        return fieldValue === condition.equals;
      }
      if (condition.notEquals) {
        return fieldValue !== condition.notEquals;
      }
      return true;
    });
  });
};

export const getVisibleFields = (section: FormSection, formData: Record<string, string>): FormField[] => {
  return section.fields.filter(field => {
    if (!field.conditionalLogic) return true;
    
    return field.conditionalLogic.showWhen.every(condition => {
      const fieldValue = formData[condition.fieldId];
      if (condition.equals) {
        if (Array.isArray(condition.equals)) {
          return condition.equals.includes(fieldValue);
        }
        return fieldValue === condition.equals;
      }
      if (condition.notEquals) {
        return fieldValue !== condition.notEquals;
      }
      return true;
    });
  });
};
