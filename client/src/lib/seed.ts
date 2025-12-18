import { memoryProvider } from "./memory";
import syllabus from "./syllabus.json";

export async function seedDemoData() {
  console.log("Seeding enhanced demo data...");
  await memoryProvider.clear();

  // 1. Enhanced Profile Memory
  await memoryProvider.add({
    user_id: "u_demo",
    org_id: "org_demo",
    project_id: "p_emba_delta_brief",
    session_id: "2025-12-10", // Established at start of course
    episode_type: "profile",
    tags: ["profile", "setup"],
    payload: {
      role: "Director of Operations",
      industry: "Healthcare / Hospital Administration",
      org_size: "5000+ employees",
      initiative: "Digital Transformation of Patient Intake",
      constraints: "Strict HIPAA compliance, unionized workforce, budget freeze until Q3",
      capstone_topic: "Reducing ER wait times via AI triage",
      output_preferences: "Direct, bullet points, no fluff",
      // New fields for better steering
      learning_goals: [
        "Become credible in governance discussions",
        "Speak in CFO language to unlock budget",
        "Master stakeholder alignment for AI projects"
      ],
      leadership_gaps: [
        "Stakeholder alignment with clinical staff",
        "Narrative control during crisis",
        "Risk framing for non-technical board members"
      ],
      success_definition: "Actionable case memo + talking points for steering committee"
    }
  });

  // 2. Week A: Data Strategy & Ethics (2025-12-10)
  
  // Week A Work Delta
  await memoryProvider.add({
    user_id: "u_demo",
    org_id: "org_demo",
    project_id: "p_emba_delta_brief",
    session_id: "2025-12-10",
    episode_type: "work_delta",
    tags: ["weekly_update"],
    payload: {
      course: syllabus.course,
      next_topic: syllabus.sessions[0].topic, // Data Strategy
      work_changes: [
        { bullet: "Selected vendor for AI pilot", category: "vendor", impact: "high" },
        { bullet: "Union reps expressed concern about job displacement", category: "stakeholders", impact: "high" },
        { bullet: "Legal team is blocking data access request", category: "blocker", impact: "critical" }
      ]
    }
  });

  // Week A Brief Output (Golden Record)
  // This sets up the "open threads" for Week B to resolve
  await memoryProvider.add({
    user_id: "u_demo",
    org_id: "org_demo",
    project_id: "p_emba_delta_brief",
    session_id: "2025-12-10",
    episode_type: "brief_output",
    tags: ["brief", "generated"],
    payload: {
      markdown: `
# Pre-Class Delta Brief — ${syllabus.course} — 2025-12-10

## This week’s lens (Data Strategy & Ethics)
- Focus on **data classification** boundaries (PHI vs non-PHI).
- Identify **ethical failure modes** in your triage workflow.

## 3 moves that matter since last class (ranked)
1) Move: **Isolate pilot data to non-PHI for faster legal approval**
   - What changed: Legal blocking data access.
   - Why it matters: Bypasses full HIPAA review to unblock the pilot.
   - Capstone implication: Define "minimum necessary" data set.
   - “In-class line”: "We're carving out a non-PHI sandbox to prove value before full integration."

2) Move: **Engage union reps early in the risk register**
   - What changed: Union concerns about displacement.
   - Why it matters: Prevents "shadow AI" narrative; builds trust.
   - Capstone implication: Add "workforce impact" to ethical risk assessment.
   - “In-class line”: "We're treating workforce trust as a critical data asset."

3) Move: **Define 'ethical failure' as a KPI**
   - What changed: Vendor selection complete.
   - Why it matters: Holds vendor accountable for bias/errors.
   - Capstone implication: Add "harm types" to vendor contract.
   - “In-class line”: "We're measuring 'harm reduction' alongside efficiency."

## 2 risks / failure modes
- Risk 1: Legal rejects even non-PHI sandbox. — Mitigation: Escalation to CIO with "competitor risk" framing.
- Risk 2: Union leaks "AI replacing nurses" rumor. — Mitigation: Joint town hall with nursing leadership.

## 1 next action
- Action: Draft "Data Classification Memo" for Legal.
- Output artifact: 1-page PDF defining non-PHI fields.

## Open Threads (for next week)
- Confirm whether 'non-PHI' carve-out is acceptable to legal.
- Define what counts as PHI in intake transcripts.
- Get union rep into governance cadence early.
`,
      moves: [
        "Isolate pilot data to non-PHI for faster legal approval",
        "Engage union reps early in the risk register",
        "Define 'ethical failure' as a KPI"
      ],
      open_threads: [
        "Confirm whether 'non-PHI' carve-out is acceptable to legal",
        "Define what counts as PHI in intake transcripts",
        "Get union rep into governance cadence early"
      ]
    }
  });

  // 3. Week B: Operating Model & Governance (2025-12-17)
  
  // Week B Work Delta (The "Present")
  await memoryProvider.add({
    user_id: "u_demo",
    org_id: "org_demo",
    project_id: "p_emba_delta_brief",
    session_id: "2025-12-17",
    episode_type: "work_delta",
    tags: ["weekly_update"],
    payload: {
      course: syllabus.course,
      next_topic: syllabus.sessions[1].topic, // Operating Model
      work_changes: [
        { bullet: "CTO resigned unexpectedly", category: "stakeholders", impact: "high" },
        { bullet: "Legal rejected non-PHI pilot proposal (cited re-id risk)", category: "compliance", impact: "critical" },
        { bullet: "Union rep agreed to join steering committee", category: "change_mgmt", impact: "high" }
      ]
    }
  });

  console.log("Seeding complete. Ready for Week B generation.");
}
