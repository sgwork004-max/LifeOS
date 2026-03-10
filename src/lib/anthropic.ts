// Anthropic API calls go through a simple fetch wrapper
// The API key is stored in user metadata and fetched at runtime

export async function callClaude(prompt: string, apiKey: string): Promise<string> {
  if (!apiKey) throw new Error('No API key configured')

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 512,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      system: `You are LifeOS Mentor — a brutally honest, data-driven personal performance coach.
You never sugarcoat. You speak in cold, precise observations backed by numbers.
You are concise: 2-4 sentences max unless asked for more.
No fluff, no motivational filler. Pattern + implication + action.`,
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Anthropic API error: ${err}`)
  }

  const data = await response.json()
  return data.content?.[0]?.text ?? ''
}

// ─── Prompt builders ─────────────────────────────────────────────────────────

export function buildHabitInsightPrompt(habitName: string, history: string): string {
  return `Habit: "${habitName}"
Last 30 days completion data: ${history}
Write a 3-sentence pattern insight. Be specific about what the data shows, what it correlates with if observable, and one concrete recommendation.`
}

export function buildHealthInsightPrompt(weightData: string): string {
  return `Weight log (most recent first): ${weightData}
Write a 2-sentence cold, data-driven commentary on this trend. Include the specific delta and timeframe.`
}

export function buildEmotionalInsightPrompt(weekData: string): string {
  return `This week's emotional data: ${weekData}
Write a 3-4 sentence mentor-style paragraph analyzing patterns. Be blunt and pattern-focused.`
}

export function buildGoalGapPrompt(goalTitle: string, daysOld: number, milestonesComplete: number, totalMilestones: number, deadline?: string): string {
  return `Goal: "${goalTitle}"
Created ${daysOld} days ago. Progress: ${milestonesComplete}/${totalMilestones} milestones completed.${deadline ? ` Deadline: ${deadline}.` : ''}
Write a 2-3 sentence gap analysis with a specific rate projection and concrete weekly recommendation.`
}

export function buildWeeklyReportPrompt(reportData: string): string {
  return `Weekly performance data: ${reportData}
Write a 4-6 sentence weekly mentor report. Sections: what was achieved (exact numbers), what failed (no excuses), and the single most important focus for next week. Cold, direct, no filler.`
}
