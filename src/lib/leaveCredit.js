import { supabase } from './supabase'

// Triggers the auto-credit logic on the server.
// Called once when a user signs in.
export const creditMonthlyLeaves = async (userId) => {
  const { data, error } = await supabase.rpc('credit_monthly_leaves', { p_user_id: userId })
  if (error) {
    console.error('Failed to credit leaves:', error)
    return null
  }
  return data?.[0] || null
}

// Compute next credit date for display
export const getNextCreditDate = (lastCreditedMonth) => {
  const today = new Date()
  const policyStart = new Date('2026-05-01')

  if (today < policyStart) return policyStart

  if (lastCreditedMonth) {
    const [y, m] = lastCreditedMonth.split('-').map(Number)
    return new Date(y, m, 1) // first of next month after lastCreditedMonth
  }
  return policyStart
}
