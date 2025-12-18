import { memoryProvider } from './memory';

export async function seedDemoData() {
  await memoryProvider.clear();

  // 1. Profile (Healthcare Ops Director)
  await memoryProvider.add({
    user_id: "u_demo",
    org_id: "org_demo",
    project_id: "p_emba_delta_brief",
    session_id: "2025-12-01",
    episode_type: "profile",
    tags: ["emba", "profile"],
    payload: {
      persona: {
        role: "Director of Operations",
        industry: "Healthcare / Hospital Administration",
        org_size: "5000+ employees"
      },
      work_initiative: "Digital Transformation of Patient Intake",
      constraints: ["Strict HIPAA compliance", "Unionized workforce", "Budget freeze until Q3"],
      capstone: "Reducing ER wait times via AI triage",
      preferences: "Direct, bullet points, no fluff"
    }
  });

  // 2. Week A Delta (Last Week)
  await memoryProvider.add({
    user_id: "u_demo",
    org_id: "org_demo",
    project_id: "p_emba_delta_brief",
    session_id: "2025-12-10",
    episode_type: "work_delta",
    tags: ["emba", "delta"],
    payload: {
      course: "AI Transformation",
      next_topic: "Data Strategy & Ethics",
      work_changes: [
        "Vendor selection for intake portal delayed by legal",
        "Nurses union raised concerns about 'AI replacing triage'",
        "Budget committee approved pilot funding (small)"
      ],
      constraint_focus_this_week: "Union pushback",
      capstone_milestone: "Problem statement approved"
    }
  });

  // 3. Week A Brief Output (Simulated)
  await memoryProvider.add({
    user_id: "u_demo",
    org_id: "org_demo",
    project_id: "p_emba_delta_brief",
    session_id: "2025-12-10",
    episode_type: "brief_output",
    tags: ["emba", "brief"],
    payload: {
      markdown: "# Pre-Class Delta Brief — AI Transformation — 2025-12-10\n\n## 3 moves that matter\n1) Move: Engage union reps early in data strategy design\n   - Why: Mitigate 'AI replacement' fears before pilot launch\n2) Move: Isolate pilot data to non-PHI for faster legal approval\n   - Why: Bypasses HIPAA heavy review for initial test\n3) Move: Pitch 'Augmentation not Automation' in town hall\n   - Why: Reframe narrative to support staff retention",
      highlights: ["Unionized workforce", "Strict HIPAA compliance"],
      mode: "personalized"
    }
  });

  // 4. Week B Delta (This Week - Current State)
  await memoryProvider.add({
    user_id: "u_demo",
    org_id: "org_demo",
    project_id: "p_emba_delta_brief",
    session_id: "2025-12-17",
    episode_type: "work_delta",
    tags: ["emba", "delta"],
    payload: {
      course: "AI Transformation",
      next_topic: "Operating Model & Governance",
      work_changes: [
        "Union rep agreed to join the steering committee (big win)",
        "Legal rejected the non-PHI pilot proposal (need new approach)",
        "CTO resigned unexpectedly"
      ],
      constraint_focus_this_week: "Legal/Compliance",
      capstone_milestone: "Data schema draft"
    }
  });

  console.log("Seed data injected successfully.");
}
