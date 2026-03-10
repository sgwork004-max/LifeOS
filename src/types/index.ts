// ─── Auth ────────────────────────────────────────────────────────────────────
export interface UserProfile {
  id: string
  email: string
  full_name?: string
  avatar_url?: string
  onboarding_complete?: boolean
  anthropic_api_key?: string
  ai_enabled?: boolean
}

// ─── Habits ──────────────────────────────────────────────────────────────────
export interface Habit {
  id: string
  user_id: string
  name: string
  category: string
  frequency: 'daily' | 'weekly'
  target_time?: string
  importance_weight: number // 1-5
  created_at: string
  color?: string
}

export interface HabitLog {
  id: string
  habit_id: string
  user_id: string
  completed_at: string
  notes?: string
}

export interface HabitWithStats extends Habit {
  current_streak: number
  longest_streak: number
  completion_30d: number
  completed_today: boolean
  logs: HabitLog[]
}

// ─── Health ──────────────────────────────────────────────────────────────────
export interface HealthLog {
  id: string
  user_id: string
  weight_kg: number
  body_fat_pct?: number
  notes?: string
  logged_at: string
}

// ─── Emotional Intelligence ──────────────────────────────────────────────────
export type EmotionTag =
  | 'Joy' | 'Calm' | 'Anxious' | 'Angry' | 'Sad'
  | 'Focused' | 'Overwhelmed' | 'Grateful'

export interface EmotionalCheckin {
  id: string
  user_id: string
  mood: number // 1-10
  energy: number // 1-10
  emotion_tags: EmotionTag[]
  journal_note?: string
  logged_at: string
}

export interface GratitudeLog {
  id: string
  user_id: string
  entries: string[]
  logged_at: string
}

export interface AnxietyEvent {
  id: string
  user_id: string
  trigger_desc: string
  intensity: number // 1-10
  symptoms: string[]
  coping_used: string
  logged_at: string
}

export type CbtDistortion =
  | 'Catastrophizing'
  | 'Black-and-White Thinking'
  | 'Mind Reading'
  | 'Fortune Telling'
  | 'Emotional Reasoning'
  | 'Should Statements'
  | 'Labeling'
  | 'Personalization'
  | 'Magnification'
  | 'Mental Filter'

export interface CbtLog {
  id: string
  user_id: string
  negative_thought: string
  distortions: CbtDistortion[]
  reframe: string
  logged_at: string
}

// ─── Goals ───────────────────────────────────────────────────────────────────
export type GoalHorizon = 'monthly' | 'yearly' | '5-year'
export type GoalCategory =
  | 'career' | 'health' | 'relationships' | 'finance' | 'personal_growth'

export interface Goal {
  id: string
  user_id: string
  title: string
  description?: string
  horizon: GoalHorizon
  category: GoalCategory
  success_metric: string
  deadline?: string
  created_at: string
}

export interface Milestone {
  id: string
  goal_id: string
  user_id: string
  title: string
  due_date?: string
  completed_at?: string
}

export interface WeeklyTask {
  id: string
  milestone_id: string
  user_id: string
  title: string
  due_date?: string
  completed_at?: string
}

export interface GoalWithProgress extends Goal {
  milestones: MilestoneWithTasks[]
  progress: number // 0-100
}

export interface MilestoneWithTasks extends Milestone {
  tasks: WeeklyTask[]
}

// ─── Weekly Report ───────────────────────────────────────────────────────────
export interface WeeklyReportData {
  overall_score: number
  habit_score: number
  emotional_score: number
  health_score: number
  goal_score: number
  wins: string[]
  failures: string[]
  patterns: string[]
  focus_next_week: string[]
  ai_narrative?: string
}

export interface WeeklyReport {
  id: string
  user_id: string
  week_start: string
  score: number
  report_json: WeeklyReportData
  generated_at: string
}

// ─── Pattern Alerts ──────────────────────────────────────────────────────────
export type AlertLayer = 'habits' | 'health' | 'emotional' | 'goals'

export interface PatternAlert {
  id: string
  user_id: string
  layer: AlertLayer
  alert_type: string
  data_summary: string
  dismissed: boolean
  created_at: string
}

// ─── Score ───────────────────────────────────────────────────────────────────
export interface TodayScore {
  total: number // 0-100
  habit: number
  emotional: number
  goal: number
  health: number
}
