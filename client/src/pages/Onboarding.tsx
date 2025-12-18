import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { memoryProvider } from "@/lib/memory";
import { toast } from "sonner";

export default function Onboarding() {
  const [, setLocation] = useLocation();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    role: "Director of Operations",
    industry: "Healthcare / Hospital Administration",
    org_size: "5000+ employees",
    initiative: "Digital Transformation of Patient Intake",
    constraints: "Strict HIPAA compliance, unionized workforce, budget freeze until Q3",
    capstone: "Reducing ER wait times via AI triage",
    preferences: "Direct, bullet points, no fluff"
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await memoryProvider.add({
        user_id: "u_demo",
        org_id: "org_demo",
        project_id: "p_emba_delta_brief",
        session_id: new Date().toISOString().split('T')[0],
        episode_type: "profile",
        tags: ["emba", "profile"],
        payload: {
          persona: {
            role: formData.role,
            industry: formData.industry,
            org_size: formData.org_size
          },
          work_initiative: formData.initiative,
          constraints: formData.constraints.split(',').map(c => c.trim()),
          capstone: formData.capstone,
          preferences: formData.preferences
        }
      });

      toast.success("Profile memory saved successfully");
      setLocation("/checkin");
    } catch (error) {
      console.error(error);
      toast.error("Failed to save profile");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Profile Memory</h2>
        <p className="text-muted-foreground mt-2">
          Establish the baseline context. This "Profile Memory" will be retrieved for every future brief to ensure relevance.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Student Profile</CardTitle>
          <CardDescription>Pre-filled with a demo persona. Edit to test different scenarios.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Input id="role" name="role" value={formData.role} onChange={handleChange} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="industry">Industry</Label>
                <Input id="industry" name="industry" value={formData.industry} onChange={handleChange} required />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="org_size">Org Size / Type</Label>
              <Input id="org_size" name="org_size" value={formData.org_size} onChange={handleChange} required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="initiative">Current Major Initiative</Label>
              <Input id="initiative" name="initiative" value={formData.initiative} onChange={handleChange} required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="constraints">Top Constraints (comma separated)</Label>
              <Textarea id="constraints" name="constraints" value={formData.constraints} onChange={handleChange} required />
              <p className="text-xs text-muted-foreground">The AI will check these against every proposed move.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="capstone">Capstone Topic</Label>
              <Input id="capstone" name="capstone" value={formData.capstone} onChange={handleChange} required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="preferences">Output Preferences</Label>
              <Input id="preferences" name="preferences" value={formData.preferences} onChange={handleChange} />
            </div>

            <div className="pt-4 flex justify-end">
              <Button type="submit" disabled={isSubmitting} size="lg">
                {isSubmitting ? "Saving..." : "Save Profile & Continue →"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
