import { Card } from '@/components/ui/card';

export const QueryDifferentiator = () => {
  return (
    <aside className="space-y-4 text-sm">
      <Card className="border bg-slate-100 dark:bg-slate-800">
        <div className="p-3">
          <h3 className="font-semibold mb-2 text-slate-900 dark:text-slate-100">GSpace — General Clarifications</h3>
          <ul className="list-disc pl-5 space-y-1 text-slate-700 dark:text-slate-400">
            <li>Community-wide answers</li>
            <li>No verification or personal data</li>
            <li>Quick clarifications</li>
          </ul>
          <div className="mt-2 text-xs text-slate-600 dark:text-slate-500">
            Ask once, everyone benefits
          </div>
        </div>
      </Card>

      <Card className="border bg-slate-100 dark:bg-slate-800">
        <div className="p-3">
          <h3 className="font-semibold mb-2 text-slate-900 dark:text-slate-100">Google Forms — Case-specific</h3>
          <ul className="list-disc pl-5 space-y-1 text-slate-700 dark:text-slate-400">
            <li>Individual issue resolution</li>
            <li>Roll number / proof required</li>
            <li>Backend verification</li>
          </ul>
          <div className="mt-2 text-xs text-slate-600 dark:text-slate-500">
            My case needs checking
          </div>
        </div>
      </Card>
    </aside>
  );
};
