import { describe, expect, it } from 'vitest';
import {
  getFieldsToReset,
  getVisibleFields,
  getVisibleSections,
  activityPointsFormConfig,
  pruneRemovedActivityPointsItems,
  type FormConfig,
} from './activityPointsFormConfig';

describe('activity points form config', () => {
  it('keeps only the intended System Commands and profile sections in defaults', () => {
    const sectionIds = activityPointsFormConfig.sections.map(section => section.id);
    const sectionById = new Map(activityPointsFormConfig.sections.map(section => [section.id, section]));

    expect(sectionIds).not.toContain('internship-system-commands');
    expect(sectionIds).not.toContain('internship-system-commands-vm');
    expect(sectionIds).not.toContain('internship-system-commands-exercism');
    expect(sectionIds).toContain('placement-system-commands');
    expect(sectionIds).toContain('placement-system-commands-vm');
    expect(sectionIds).toContain('placement-system-commands-exercism');
    expect(sectionIds).toEqual(expect.arrayContaining(['dvd', 'aws', 'dlp-nppe']));
    expect(sectionById.get('mad-internship')?.fields.map(field => field.id)).not.toContain('seHackerrankProfile');
    expect(sectionById.get('mad-placement')?.fields.map(field => field.id)).not.toContain('seHackerrankProfile');
    expect(sectionById.get('se-cert-internship')?.fields.map(field => field.id)).toContain('seHackerrankProfile');
    expect(sectionById.get('se-cert-placement')?.fields.map(field => field.id)).toContain('seHackerrankProfile');
  });

  it('resets values from a branch being left even when the new branch reuses a field ID', () => {
    const config: FormConfig = {
      sections: [
        {
          id: 'course-selection',
          title: 'Course',
          fields: [{ id: 'course', label: 'Course', type: 'dropdown', required: true }],
        },
        {
          id: 'old-branch',
          title: 'Old branch',
          conditionalLogic: { showWhen: [{ fieldId: 'course', equals: 'Old' }] },
          fields: [
            { id: 'sharedProfile', label: 'Profile', type: 'shortAnswer', required: true },
            { id: 'oldAnswer', label: 'Old answer', type: 'shortAnswer', required: true },
          ],
        },
        {
          id: 'new-branch',
          title: 'New branch',
          conditionalLogic: { showWhen: [{ fieldId: 'course', equals: 'New' }] },
          fields: [{ id: 'sharedProfile', label: 'Profile', type: 'shortAnswer', required: true }],
        },
      ],
    };

    expect(getFieldsToReset(
      { course: 'Old', sharedProfile: 'old profile', oldAnswer: 'old answer' },
      { course: 'New', sharedProfile: 'old profile', oldAnswer: 'old answer' },
      config,
    )).toEqual(['oldAnswer', 'sharedProfile']);
  });

  it('shows Internship and Employment branches with the labels used in the form', () => {
    const config: FormConfig = {
      sections: [
        {
          id: 'internship-course',
          title: 'Internship Programming',
          conditionalLogic: { showWhen: [{ fieldId: 'subscriptionType', equals: 'Internship - Software Development' }] },
          fields: [{ id: 'sdCourse', label: 'Select the Software Development Course', type: 'dropdown', required: true }],
        },
        {
          id: 'employment-course',
          title: 'Employment Programming',
          conditionalLogic: { showWhen: [{ fieldId: 'subscriptionType', equals: 'Placement - Software Development' }] },
          fields: [{ id: 'placementSdCourse', label: 'Select the Programming Course', type: 'dropdown', required: true }],
        },
        {
          id: 'mad-internship',
          title: 'Internship Application Development',
          conditionalLogic: { showWhen: [
            { fieldId: 'subscriptionType', equals: 'Internship - Software Development' },
            { fieldId: 'Select the Software Development Course', equals: ['Modern Application Development', 'Application Development'] },
          ] },
          fields: [],
        },
        {
          id: 'se-cert-internship',
          title: 'Software Engineer Intern Certificate',
          conditionalLogic: { showWhen: [
            { fieldId: 'subscriptionType', equals: 'Internship - Software Development' },
            { fieldId: 'sdCourse', equals: 'Software Engineer Intern Certificate' },
          ] },
          fields: [],
        },
        {
          id: 'mad-placement',
          title: 'Employment Application Development',
          conditionalLogic: { showWhen: [
            { fieldId: 'subscriptionType', equals: 'Placement - Software Development' },
            { fieldId: 'Select the Programming Course', equals: ['Modern Application Development', 'Application Development'] },
          ] },
          fields: [],
        },
        {
          id: 'se-cert-placement',
          title: 'Software Engineer Certificate',
          conditionalLogic: { showWhen: [
            { fieldId: 'subscriptionType', equals: 'Placement - Software Development' },
            { fieldId: 'placementSdCourse', equals: 'Software Engineer Certificate' },
          ] },
          fields: [],
        },
        {
          id: 'employment-system-commands',
          title: 'System Commands',
          conditionalLogic: { showWhen: [
            { fieldId: 'subscriptionType', equals: 'Placement - Software Development' },
            { fieldId: 'placementSdCourse', equals: 'System Commands' },
          ] },
          fields: [{
            id: 'employmentSystemCommandsActivity',
            label: 'Select Employment Plan System Commands activity',
            type: 'radio',
            required: true,
          }, {
            id: 'vmFollowup',
            label: 'VM follow-up',
            type: 'shortAnswer',
            required: true,
            conditionalLogic: {
              showWhen: [{ fieldId: 'placementScActivityTitle', equals: 'VM Tasks (2nd series)' }],
            },
          }],
        },
        {
          id: 'placement-system-commands-vm',
          title: 'VM Tasks',
          conditionalLogic: { showWhen: [
            { fieldId: 'subscriptionType', equals: 'Placement - Software Development' },
            { fieldId: 'placementSdCourse', equals: 'System Commands' },
            { fieldId: 'placementScActivityTitle', equals: 'VM Tasks (2nd series)' },
          ] },
          fields: [],
        },
      ],
    };

    const internshipSections = getVisibleSections({
      activityType: 'Additional Mandatory Activity Points',
      subscriptionType: 'Internship - Programming',
      sdCourse: 'Application Development',
    }, config).map(section => section.id);
    const internCertificateSections = getVisibleSections({
      activityType: 'Additional Mandatory Activity Points',
      subscriptionType: 'Internship - Programming',
      sdCourse: 'Software Engineer Intern Certificate',
    }, config).map(section => section.id);
    const employmentSections = getVisibleSections({
      activityType: 'Additional Mandatory Activity Points',
      subscriptionType: 'Employment - Programming',
      placementSdCourse: 'Application Development',
    }, config).map(section => section.id);
    const employmentCertificateSections = getVisibleSections({
      activityType: 'Additional Mandatory Activity Points',
      subscriptionType: 'Employment - Programming',
      placementSdCourse: 'Software Engineer Certificate',
    }, config).map(section => section.id);
    const systemCommandSections = getVisibleSections({
      activityType: 'Additional Mandatory Activity Points',
      subscriptionType: 'Employment - Programming',
      placementSdCourse: 'System Commands',
      placementScActivityTitle: 'VMT_2nd series',
    }, config).map(section => section.id);

    expect(internshipSections).toContain('mad-internship');
    expect(internCertificateSections).toContain('se-cert-internship');
    expect(employmentSections).toContain('mad-placement');
    expect(employmentCertificateSections).toContain('se-cert-placement');
    expect(systemCommandSections).toContain('placement-system-commands-vm');

    const systemSection = config.sections.find(section => section.id === 'employment-system-commands');
    expect(systemSection).toBeDefined();
    expect(getVisibleFields(systemSection!, {
      subscriptionType: 'Employment - Programming',
      placementSdCourse: 'System Commands',
      employmentSystemCommandsActivity: 'VMT_2nd series',
    }, config).map(field => field.id)).toContain('vmFollowup');
  });

  it('does not repopulate an empty saved config with built-in sections', () => {
    const savedConfig: FormConfig = { sections: [] };

    expect(getVisibleSections({}, savedConfig)).toEqual([]);
  });

  it('removes only the specified saved items and preserves unrelated sections', () => {
    const savedConfig = pruneRemovedActivityPointsItems({ sections: activityPointsFormConfig.sections });
    const sectionIds = savedConfig.sections.map(section => section.id);
    const madPlacement = savedConfig.sections.find(section => section.id === 'mad-placement');

    expect(sectionIds).not.toContain('internship-system-commands');
    expect(sectionIds).not.toContain('internship-system-commands-vm');
    expect(sectionIds).not.toContain('internship-system-commands-exercism');
    expect(sectionIds).toEqual(expect.arrayContaining(['dvd', 'aws', 'dlp-nppe']));
    expect(madPlacement?.fields.map(field => field.id)).not.toContain('seHackerrankProfile');
  });
});