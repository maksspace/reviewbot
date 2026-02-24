// ---------------------------------------------------------------------------
// Question types (what the API returns)
// ---------------------------------------------------------------------------

export type QuestionType =
  | "single_select"
  | "multi_select"
  | "code_opinion"
  | "confirm_correct"
  | "short_text"

export interface BaseQuestion {
  type: QuestionType
  question: string
  category: string
}

export interface SingleSelectQuestion extends BaseQuestion {
  type: "single_select"
  options: string[]
}

export interface MultiSelectQuestion extends BaseQuestion {
  type: "multi_select"
  options: string[]
}

export interface CodeOpinionQuestion extends BaseQuestion {
  type: "code_opinion"
  codeSnippet: string
  codeFile: string
  options: string[]
}

export interface ConfirmCorrectQuestion extends BaseQuestion {
  type: "confirm_correct"
  detections: string[]
}

export interface ShortTextQuestion extends BaseQuestion {
  type: "short_text"
  placeholder?: string
}

export type InterviewQuestion =
  | SingleSelectQuestion
  | MultiSelectQuestion
  | CodeOpinionQuestion
  | ConfirmCorrectQuestion
  | ShortTextQuestion

// ---------------------------------------------------------------------------
// Answer (what the frontend sends back)
// ---------------------------------------------------------------------------

export interface InterviewAnswer {
  question: string
  answer: string | string[]
  type: QuestionType
  category: string
}

// ---------------------------------------------------------------------------
// API request/response
// ---------------------------------------------------------------------------

export interface InterviewNextRequest {
  slug: string
  answers: InterviewAnswer[]
}

export type InterviewNextResponse =
  | { status: "question"; question: InterviewQuestion; questionNumber: number; estimatedTotal: number }
  | { status: "complete"; persona: string }
  | { status: "error"; message: string }
