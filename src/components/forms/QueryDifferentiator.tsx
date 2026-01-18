import { Card } from '@/components/ui/card';

export const QueryDifferentiator = () => {
  return (
    <aside className="space-y-4 text-sm">
      <Card className="border">
        <div className="p-3">
          <h3 className="font-semibold mb-2">GSpace — General Clarifications</h3>
          <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
            <li>Community-wide answers</li>
            <li>No verification or personal data</li>
            <li>Quick clarifications</li>
          </ul>
          <div className="mt-2 text-xs text-muted-foreground">
            Ask once, everyone benefits
          </div>
        </div>
      </Card>

      <Card className="border">
        <div className="p-3">
          <h3 className="font-semibold mb-2">Google Forms — Case-specific</h3>
          <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
            <li>Individual issue resolution</li>
            <li>Roll number / proof required</li>
            <li>Backend verification</li>
          </ul>
          <div className="mt-2 text-xs text-muted-foreground">
            My case needs checking
          </div>
        </div>
      </Card>
    </aside>
  );
};
