import { parseTransactionText } from '@/utils/transaction-parser'

/**
 * What a chat message to Fico is: something to log, or a question / small talk that needs a reply
 * instead of a transaction form.
 */
export type AgentIntent = 'transaction' | 'question' | 'greeting' | 'thanks' | 'help' | 'cancel'

const CANCEL = /^(cancel|nevermind|never mind|wag na|huwag na|wag nalang|wag na lang|stop|undo|clear|reset|start over)\b/i
const GREETING = /^(hi+|hello|helo|hey+|yo|hoy|oi|uy|sup|good\s+(morning|afternoon|evening|day)|magandang\s+(umaga|hapon|gabi)|kumusta|kamusta|musta)\b/i
const THANKS = /^(thanks?|thank\s+you|ty|tysm|tnx|thx|salamat|maraming\s+salamat|nice|great|ok(ay)?|sige|noted|cool|perfect|ayos)\b/i
const HELP = /\b(help|tulong|what can you do|what do you do|how (do|does|can) (i|you|this)|paano( ba)? (gamitin|mag|ito|to)|how to use|commands?|examples?)\b/i
const QUESTION_START =
  /^(how\s+much|how\s+many|how's|how\s+is|how\s+are|what|what's|whats|when|where|which|who|why|did\s+i|do\s+i|have\s+i|am\s+i|is\s+there|are\s+there|can\s+i|show|list|tell\s+me|check|magkano|ilan|ano|anong|saan|kailan|bakit|may\s+natitira|meron\s+pa|pakita|ipakita)\b/i
const QUESTION_TOPIC =
  /\b(balance|balances|natitira|pera\s+ko|laman|how\s+much\s+(do\s+i\s+have|is\s+left|left)|spending|spent\s+(this|last|today|so\s+far)|expenses?\s+(this|last|today)|nagastos|ginastos|gastos\s+ko|income\s+(this|last)|kinita|net\s+worth|budget\s+left|safe\s+to\s+spend)\b/i
const QUESTION_WORDS = /\b(how much|magkano|ilan|what|ano|show|list|balance|natitira)\b/i

const hasNumber = (text: string) => /\d/.test(text)

export function detectIntent(raw: string): AgentIntent {
  const text = raw.trim().replace(/\s+/g, ' ')
  if (!text) return 'help'
  const words = text.split(' ').length

  if (CANCEL.test(text) && words <= 4 && !hasNumber(text)) return 'cancel'
  if (GREETING.test(text) && words <= 4 && !hasNumber(text)) return 'greeting'
  if (THANKS.test(text) && words <= 5 && !hasNumber(text)) return 'thanks'
  if (HELP.test(text) && !hasNumber(text)) return 'help'

  const looksLikeQuestion = QUESTION_START.test(text) || /\?\s*$/.test(text) || QUESTION_TOPIC.test(text)
  if (looksLikeQuestion) {
    // "how much is 3 coffees 450?" still logs: a question that names an amount to log is a transaction.
    const parsed = parseTransactionText(text)
    const loggable = parsed.amount !== undefined && parsed.confidence.type >= 0.85 && !QUESTION_WORDS.test(text)
    return loggable ? 'transaction' : 'question'
  }
  return 'transaction'
}
