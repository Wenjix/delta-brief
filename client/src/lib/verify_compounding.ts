import { seedDemoData } from './seed';
import { memoryProvider } from './memory';
import { generateBrief } from './llm';

async function verify() {
  console.log("Seeding data...");
  await seedDemoData();

  console.log("Fetching context...");
  const [profile] = await memoryProvider.search("", { episode_type: ["profile"] }, 1);
  const recentDeltas = await memoryProvider.search("", { episode_type: ["work_delta"] }, 3);
  const [lastBrief] = await memoryProvider.search("", { episode_type: ["brief_output"] }, 1);

  // The seed data puts Week B delta at the top (index 0)
  const latestDelta = recentDeltas[0]; 
  
  console.log("Generating Week B Brief...");
  const result = await generateBrief({
    classDate: "2025-12-17",
    className: latestDelta.payload.course,
    syllabusTopic: latestDelta.payload.next_topic,
    mode: 'personalized',
    profile,
    recentDeltas,
    lastBrief
  });

  console.log("\n--- Generated Brief Snippet ---");
  console.log(result.markdown.substring(0, 500) + "...");
  console.log("\n-------------------------------");

  // Verification Checks
  const text = result.markdown.toLowerCase();
  const hasUnionRef = text.includes("union");
  const hasLegalRef = text.includes("legal");
  const hasChangeRef = text.includes("change") || text.includes("since") || text.includes("last");

  console.log("\nVerification Results:");
  console.log(`- References Union (Week A context): ${hasUnionRef ? "PASS" : "FAIL"}`);
  console.log(`- References Legal (Week B delta): ${hasLegalRef ? "PASS" : "FAIL"}`);
  console.log(`- References Change/History: ${hasChangeRef ? "PASS" : "FAIL"}`);

  if (hasUnionRef && hasLegalRef) {
    console.log("\nSUCCESS: Compounding logic verified.");
  } else {
    console.error("\nFAILURE: Brief did not reference expected context.");
  }
}

verify().catch(console.error);
