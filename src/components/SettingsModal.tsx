import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings2, Key, Info, CheckCircle2 } from "lucide-react";
import { useGeminiKey } from "@/hooks/use-gemini-key";
import { toast } from "sonner";

export function SettingsModal() {
  const { apiKey, saveKey } = useGeminiKey();
  const [tempKey, setTempKey] = useState(apiKey || "");
  const [open, setOpen] = useState(false);

  const handleSave = () => {
    saveKey(tempKey.trim() || null);
    toast.success("API Key saved successfully!");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 rounded-full border-border hover:border-foreground/40 transition-colors">
          <Settings2 className="h-4 w-4" />
          <span>API Settings</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] bg-card border-border">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Key className="h-5 w-5 text-primary" />
            </div>
            <DialogTitle className="text-xl">Gemini API Settings</DialogTitle>
          </div>
          <DialogDescription className="text-muted-foreground text-sm leading-relaxed">
            Use your own Gemini Pro account to bypass shared rate limits and get faster analysis.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-6 space-y-6">
          <div className="space-y-3">
            <Label htmlFor="api-key" className="text-sm font-semibold tracking-tight">
              Google Gemini API Key
            </Label>
            <div className="relative">
              <Input
                id="api-key"
                type="password"
                value={tempKey}
                onChange={(e) => setTempKey(e.target.value)}
                placeholder="AIzaSy..."
                className="pr-10 bg-background border-border focus-visible:ring-primary"
              />
              {apiKey && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                </div>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
              <Info className="h-3 w-3" />
              Stored locally in your browser. Never sent to our servers except for AI calls.
            </p>
          </div>

          <div className="p-4 bg-muted/40 rounded-xl border border-border/50 space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Why use your own key?</h4>
            <ul className="text-xs text-muted-foreground space-y-1.5 list-disc pl-4">
              <li>Avoid "429 Rate Limit" errors during peak NSE hours.</li>
              <li>Get access to Gemini 1.5 Pro higher reasoning.</li>
              <li>Faster response times and higher token limits.</li>
              <li>100% free via Google AI Studio.</li>
            </ul>
          </div>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          <Button variant="ghost" className="w-full sm:w-auto text-xs" onClick={() => { setTempKey(""); saveKey(null); toast.info("API Key cleared."); }}>
            Clear Key
          </Button>
          <Button className="w-full sm:w-auto" onClick={handleSave}>
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
