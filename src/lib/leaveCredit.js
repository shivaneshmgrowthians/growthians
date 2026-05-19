import { supabase } from './supabase'

export const creditMonthlyLeaves = async (userId) => {
  const { data, error } = await supabase.rpc('credit_monthly_leaves', { p_user_id: userId })
  if (error) {
    console.error('Failed to credit leaves:', error)
    return null
  }
  return data?.[0] || null
}

export const getNextCreditDate = (lastCreditedMonth, leaveStartMonth) => {
  const today = new Date()
  const startMonth = leaveStartMonth || '2026-06'
  const policyStart = new Date(startMonth + '-01')

  if (today < policyStart) return policyStart

  if (lastCreditedMonth) {
    const [y, m] = lastCreditedMonth.split('-').map(Number)
    return new Date(y, m, 1)
  }

  return policyStart
}