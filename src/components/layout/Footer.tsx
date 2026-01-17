export function Footer() {
  return (
    <footer className="border-t bg-muted/30">
      <div className="container py-6">
        <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
          <div className="text-center md:text-left">
            <p className="text-sm font-medium">Industry Interaction Cell</p>
            <p className="text-xs text-muted-foreground">
              IIT Madras BS Degree Programme
            </p>
          </div>
          <div className="text-center text-xs text-muted-foreground md:text-right">
            <p>For queries: iic@study.iitm.ac.in</p>
            <p className="mt-1">© {new Date().getFullYear()} IIC. All rights reserved.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
