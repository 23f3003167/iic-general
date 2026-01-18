import { useState, useEffect } from 'react';
import { Layout } from '@/components/layout/Layout';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { getFAQs } from '@/lib/firestoreService';
import { HelpCircle } from 'lucide-react';

const FAQs = () => {
  const [faqs, setFAQs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFAQs();
  }, []);

  const loadFAQs = async () => {
    try {
      const data = await getFAQs();
      setFAQs(data);
    } catch (error) {
      console.error('Error loading FAQs:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="container py-8 space-y-6 max-w-3xl">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold sm:text-3xl flex items-center gap-2">
            <HelpCircle className="h-7 w-7 text-primary" />
            Frequently Asked Questions
          </h1>
          <p className="text-muted-foreground">
            Common questions about placement training processes.
          </p>
        </div>

        {loading ? (
          <p className="text-center text-muted-foreground py-8">Loading FAQs...</p>
        ) : faqs.length > 0 ? (
          <Accordion type="single" collapsible className="space-y-2">
            {faqs.map((faq) => (
              <AccordionItem
                key={faq.id}
                value={faq.id}
                className="border rounded-lg px-4"
              >
                <AccordionTrigger className="text-left hover:no-underline">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        ) : (
          <p className="text-center text-muted-foreground py-8">No FAQs available yet.</p>
        )}
      </div>
    </Layout>
  );
};

export default FAQs;
