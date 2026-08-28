import { useEffect, useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getExamSyllabi, getImportantLinks, getTrainingLectures } from '@/lib/firestoreService';
import type { ExamSyllabus, ImportantLink, TrainingLecture } from '@/types';
import { BookOpen, ExternalLink, GraduationCap, Link2, PlayCircle } from 'lucide-react';

function videoEmbedUrl(url: string): string | null {
  try {
    const parsed = new URL(url.trim());
    const host = parsed.hostname.replace(/^www\./, '');
    let videoId = '';

    if (host === 'youtu.be') videoId = parsed.pathname.slice(1).split('/')[0];
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      videoId = parsed.searchParams.get('v') || parsed.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)/)?.[1] || '';
    }

    if (/^[A-Za-z0-9_-]{11}$/.test(videoId)) return `https://www.youtube-nocookie.com/embed/${videoId}`;

    if (host === 'drive.google.com') {
      const driveId = parsed.pathname.match(/^\/file\/d\/([^/]+)/)?.[1] || parsed.searchParams.get('id');
      return driveId ? `https://drive.google.com/file/d/${driveId}/preview` : null;
    }

    return null;
  } catch {
    return null;
  }
}

export default function Resources() {
  const [lectures, setLectures] = useState<TrainingLecture[]>([]);
  const [links, setLinks] = useState<ImportantLink[]>([]);
  const [syllabi, setSyllabi] = useState<ExamSyllabus[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLecture, setSelectedLecture] = useState<TrainingLecture | null>(null);
  const selectedEmbedUrl = selectedLecture ? videoEmbedUrl(selectedLecture.videoUrl || selectedLecture.youtubeUrl || '') : null;

  useEffect(() => {
    Promise.all([getTrainingLectures(), getImportantLinks(), getExamSyllabi()])
      .then(([loadedLectures, loadedLinks, loadedSyllabi]) => {
        setLectures(loadedLectures);
        setLinks(loadedLinks);
        setSyllabi(loadedSyllabi);
      })
      .catch((error) => console.error('Unable to load resources:', error))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Layout>
      <div className="container space-y-6 py-8">
        <div className="space-y-2">
          <h1 className="flex items-center gap-3 text-3xl font-extrabold sm:text-4xl">
            <GraduationCap className="h-8 w-8 text-primary" />
            Resources
          </h1>
          <p className="max-w-3xl text-lg text-muted-foreground">
            Review these materials before starting your training.
          </p>
        </div>

        <Tabs defaultValue="lectures" className="space-y-6">
          <TabsList className="grid h-auto w-full max-w-2xl grid-cols-3">
            <TabsTrigger value="lectures">Training Lectures</TabsTrigger>
            <TabsTrigger value="links">Important Links</TabsTrigger>
            <TabsTrigger value="syllabus">Syllabus</TabsTrigger>
          </TabsList>
          <TabsContent value="lectures" className="space-y-5">
            <div><h2 className="flex items-center gap-2 text-2xl font-bold"><PlayCircle className="h-6 w-6 text-primary" />Training Lectures</h2><p className="mt-1 text-muted-foreground">Watch the required lectures before you begin.</p></div>
            {loading ? <p className="py-8 text-center text-muted-foreground">Loading resources...</p> : lectures.length === 0 ? <p className="py-8 text-center text-muted-foreground">No training lectures have been added yet.</p> : <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{lectures.map((lecture) => <Card key={lecture.id} className="flex flex-col"><CardHeader><CardTitle>{lecture.title}</CardTitle>{lecture.description && <CardDescription>{lecture.description}</CardDescription>}</CardHeader><CardContent className="mt-auto"><Button className="w-full" onClick={() => setSelectedLecture(lecture)}><PlayCircle className="mr-2 h-4 w-4" />Watch Lecture</Button></CardContent></Card>)}</div>}
          </TabsContent>
          <TabsContent value="links" className="space-y-5">
            <div><h2 className="flex items-center gap-2 text-2xl font-bold"><Link2 className="h-6 w-6 text-primary" />Important Links</h2><p className="mt-1 text-muted-foreground">Useful training links curated by the IIC team.</p></div>

          {!loading && links.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2">
              {links.map((link) => (
                <Card key={link.id}>
                  <CardHeader className="pb-3"><CardTitle className="text-lg">{link.title}</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    {link.description && <p className="text-sm text-muted-foreground">{link.description}</p>}
                    <a href={link.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline">
                      Open link <ExternalLink className="h-4 w-4" />
                    </a>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          {!loading && links.length === 0 && <p className="py-8 text-center text-muted-foreground">No important links have been added yet.</p>}
          </TabsContent>
          <TabsContent value="syllabus" className="space-y-5">
            <div><h2 className="flex items-center gap-2 text-2xl font-bold"><BookOpen className="h-6 w-6 text-primary" />Syllabus</h2><p className="mt-1 text-muted-foreground">Review the coverage before preparing for your exam.</p></div>
            {!loading && syllabi.length > 0 ? <div className="grid gap-5 lg:grid-cols-2">{syllabi.map((syllabus) => <Card key={syllabus.id} className="overflow-hidden border-primary/20"><div className="h-1.5 bg-primary" /><CardHeader className="bg-muted/30"><p className="text-xs font-semibold uppercase tracking-wider text-primary">Exam syllabus</p><CardTitle className="text-2xl">{syllabus.title}</CardTitle></CardHeader><CardContent className="pt-6"><p className="whitespace-pre-wrap text-base leading-7 text-muted-foreground">{syllabus.description}</p></CardContent></Card>)}</div> : !loading && <p className="py-8 text-center text-muted-foreground">No syllabus has been added yet.</p>}
          </TabsContent>
        </Tabs>
      </div>
      <Dialog open={Boolean(selectedLecture)} onOpenChange={(open) => !open && setSelectedLecture(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6"><DialogTitle>{selectedLecture?.title}</DialogTitle>{selectedLecture?.description && <DialogDescription>{selectedLecture.description}</DialogDescription>}</DialogHeader>
          {selectedEmbedUrl ? <div className="aspect-video bg-black"><iframe className="h-full w-full" src={selectedEmbedUrl} title={selectedLecture?.title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen /></div> : <p className="p-8 text-center text-sm text-muted-foreground">This lecture has an invalid YouTube or Google Drive video link.</p>}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
