'use client'

import { Wallet, TrendingUp, AlertCircle, PieChart, Info } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

interface BudgetOverviewProps {
  totalBudgeted: number
  totalSpent: number
  totalRemaining: number
  activeBudgets: number
  exceededBudgets: number
  currency: string
  burnRate?: number
  message?: string
  loading?: boolean
}

export function BudgetOverview({
  totalBudgeted,
  totalSpent,
  totalRemaining,
  activeBudgets,
  exceededBudgets,
  currency,
  burnRate = 0,
  message,
  loading,
}: BudgetOverviewProps) {
  const percentageSpent = totalBudgeted > 0 ? (totalSpent / totalBudgeted) * 100 : 0
  
  const formatValue = (val: number) => {
    return `${currency}${val.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`
  }

  if (loading) {
    return (
      <div className="space-y-6 mb-8" aria-label="Loading">
        <div className="bg-card border border-border rounded-2xl p-6 md:p-8 shadow-ios">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div className="space-y-4">
              <Skeleton className="h-4 w-56" />
              <Skeleton className="h-10 w-64" />
              <Skeleton className="h-3.5 w-72 max-w-full" />
              <Skeleton className="h-4 w-full rounded-full" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 rounded-xl" />
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 mb-8">
      {/* Primary Overview Card */}
      <div className="relative overflow-hidden bg-card border border-border rounded-2xl p-6 md:p-8 shadow-ios">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -mr-32 -mt-32" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-accent/5 rounded-full blur-2xl -ml-24 -mb-24" />
        
        <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          <div className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <PieChart className="w-4 h-4 text-primary" />
              Overall Spending Performance
            </h3>
            
            <div className="space-y-1">
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-black text-foreground">{formatValue(totalSpent)}</span>
                <span className="text-muted-foreground font-medium">/ {formatValue(totalBudgeted)}</span>
              </div>
              <p className="text-sm text-muted-foreground">
                You've used <span className="font-bold text-foreground">{percentageSpent.toFixed(1)}%</span> of your total budget for this period.
              </p>
            </div>

            <div className="space-y-2">
              <Progress 
                value={percentageSpent} 
                variant={percentageSpent > 90 ? "destructive" : percentageSpent > 70 ? "warning" : "default"}
                className="h-4"
              />
              <div className="flex justify-between text-xs font-medium">
                <span className="text-muted-foreground">0%</span>
                <span className={`${percentageSpent > 90 ? 'text-destructive' : 'text-primary'} flex items-center gap-1`}>
                   {percentageSpent > 100 ? <AlertCircle className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                   {percentageSpent.toFixed(0)}% Utilized
                </span>
                <span className="text-muted-foreground">100%</span>
              </div>
            </div>
            
            {message && (
              <Badge variant="outline" className={`py-1.5 px-3 rounded-lg border-none shadow-sm flex items-center gap-2 w-fit ${
                percentageSpent > 100 ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success'
              }`}>
                <Info className="w-4 h-4 shrink-0" />
                {message}
              </Badge>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-secondary/40 border border-border/50 rounded-xl p-4 transition-all hover:bg-secondary/60">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-success/10 rounded-lg">
                  <Wallet className="w-4 h-4 text-success" />
                </div>
                <span className="text-xs font-semibold text-muted-foreground uppercase">Remaining</span>
              </div>
              <p className="text-xl font-bold text-success break-words">{formatValue(totalRemaining)}</p>
            </div>

            <div className="bg-secondary/40 border border-border/50 rounded-xl p-4 transition-all hover:bg-secondary/60">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <TrendingUp className="w-4 h-4 text-primary" />
                </div>
                <span className="text-xs font-semibold text-muted-foreground uppercase">Exceeded</span>
              </div>
              <p className="text-xl font-bold text-destructive break-words">{exceededBudgets} Budgets</p>
            </div>

            <div className="bg-secondary/40 border border-border/50 rounded-xl p-4 transition-all hover:bg-secondary/60">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-accent/10 rounded-lg">
                  <PieChart className="w-4 h-4 text-accent" />
                </div>
                <span className="text-xs font-semibold text-muted-foreground uppercase">Burn Rate</span>
              </div>
              <p className="text-xl font-bold text-foreground break-words">{burnRate.toFixed(1)}%</p>
            </div>

            <div className="bg-secondary/40 border border-border/50 rounded-xl p-4 transition-all hover:bg-secondary/60">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-warning/10 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-warning" />
                </div>
                <span className="text-xs font-semibold text-muted-foreground uppercase">Active</span>
              </div>
              <p className="text-xl font-bold text-foreground break-words">{activeBudgets} Total</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
