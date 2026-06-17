import { z } from 'zod';

export const recruiterSchema = z.object({
  name: z.string().min(2, 'Enter recruiter name'),
  email: z.string().email('Enter a valid email'),
  phone: z.string().min(10, 'Enter phone number'),
  designation: z.string().min(2, 'Enter designation'),
  companyName: z.string().min(2, 'Enter company name'),
  companyWebsite: z.string().url('Enter a valid URL').optional().or(z.literal('')),
  linkedInUrl: z.string().url('Enter a valid URL').optional().or(z.literal('')),
  industry: z.string().min(2, 'Enter industry'),
  companySize: z.string().min(1, 'Enter company size'),
  companyDescription: z.string().max(1000).optional().or(z.literal('')),
});

export const opportunityQuestionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(2, 'Enter question label'),
  type: z.enum(['text', 'textarea', 'number', 'dropdown', 'file']),
  required: z.boolean(),
  options: z.array(z.string()).optional(),
});

export const opportunitySchema = z.object({
  title: z.string().min(4, 'Enter opportunity title'),
  companyName: z.string().min(2, 'Enter company'),
  type: z.enum(['Internship', 'Full Time', 'Apprenticeship', 'Contract', 'Draft']),
  domain: z.enum(['Programming', 'Data Science', 'Both']),
  location: z.string().min(2, 'Enter location'),
  workMode: z.enum(['Remote', 'Hybrid', 'Onsite']),
  description: z.string().min(10, 'Enter description'),
  stipendCtc: z.string().optional().or(z.literal('')),
  deadline: z.string().min(10, 'Enter deadline'),
  diploma: z.boolean(),
  bsc: z.boolean(),
  bs: z.boolean(),
  trainingCompleted: z.boolean(),
  internshipPlan: z.boolean(),
  employmentPlan: z.boolean(),
  domainTargeting: z.enum(['Programming', 'Data Science', 'Both']),
  minActivityPoints: z.number().min(0),
  skillsRequired: z.string().optional().or(z.literal('')),
  experienceRequired: z.string().optional().or(z.literal('')),
  applicationQuestions: z.array(opportunityQuestionSchema).min(1, 'Add at least one question'),
});

export type RecruiterFormValues = z.infer<typeof recruiterSchema>;
export type OpportunityFormValues = z.infer<typeof opportunitySchema>;
