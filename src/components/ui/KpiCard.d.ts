// Type declaration for KpiCard.jsx — the KPI bento primitives (§10.2 R10).
import type { ReactNode } from 'react'

export interface KpiHeroProps {
  eyebrow: string
  value: ReactNode
  unit?: string
  subtext?: string
  children?: ReactNode
}

export interface KpiCardProps {
  icon: ReactNode
  label: string
  value: ReactNode
  subtext?: string
  scheme?: 'accent' | 'success' | 'warning' | 'error'
}

export declare const KpiHero: import('react').FC<KpiHeroProps>

declare const KpiCard: import('react').FC<KpiCardProps>

export default KpiCard
