'use client'

import { MoreVertical, Trash2, Edit2, RotateCcw, AlertTriangle, CheckCircle2, MoreHorizontal } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useSettingsStore } from '@/store/settings-store'
import { formatMoney } from '@/utils/formatter'

interface BudgetCardProps {
  id: string
  name: string
  amount: number
  spent: number
  remaining: number
  period: string
  alertThreshold: number
  categories?: { id: string; name: string; color: string }[]
  percentageUsed: number
  isOverBudget: boolean
  isNearThreshold: boolean
  onEdit?: (id: string) => void
  onArchive?: (id: string) => void
  onRollover?: (id: string) => void
}

export function BudgetCard({
  id,
  name,
  amount,
  spent,
  remaining,
  period,
  alertThreshold,
  categories = [],
  percentageUsed,
  isOverBudget,
  isNearThreshold,
  onEdit,
  onArchive,
  onRollover,
}: BudgetCardProps) {
  const [showMenu, setShowMenu] = useState(false)
  const { currency } = useSettingsStore()

  const formatValue = (val: number) => {
    return formatMoney(val, currency, false)
  }

  const getProgressColor = () => {
    if (isOverBudget) return 'bg-destructive'
    if (isNearThreshold) return 'bg-warning'
    return 'bg-success'
  }

  const getStatusIcon = () => {
    if (isOverBudget) return <AlertTriangle className="w-4 h-4 text-destructive" />
    if (isNearThreshold) return <AlertTriangle className="w-4 h-4 text-warning" />
    return <CheckCircle2 className="w-4 h-4 text-success" />
  }

  return (
    <div className="group relative bg-card border border-border rounded-2xl p-5 shadow-ios hover:shadow-ios-lg transition-all duration-300">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div 
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-lg font-bold"
            style={{ backgroundColor: categories[0]?.color || '#6366f1' }}
          >
            {name.charAt(0)}
          </div>
          <div>
            <h3 className="font-bold text-lg text-foreground leading-none">{name}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-muted-foreground uppercase tracking-wider">{period}</span>
              {categories.slice(0, 2).map((category) => (
                <Badge key={category.id} variant="outline" className="text-[9px] h-4 px-1.5 opacity-70">
                  {category.name}
                </Badge>
              ))}
              {categories.length > 2 && (
                <Badge variant="outline" className="text-[9px] h-4 px-1.5 opacity-70">
                  +{categories.length - 2}
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div className="relative">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowMenu(!showMenu)}
            className="h-8 w-8 rounded-full hover:bg-secondary"
          >
            <MoreHorizontal className="w-5 h-5 text-muted-foreground" />
          </Button>

          {showMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 mt-2 w-48 bg-card border border-border rounded-xl shadow-xl py-2 z-50 animate-in fade-in zoom-in duration-200">
                <button
                  onClick={() => { onEdit?.(id); setShowMenu(false); }}
                  className="w-full text-left px-4 py-2.5 text-sm text-foreground hover:bg-secondary flex items-center gap-3 transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                  Edit Goal
                </button>
                <button
                  onClick={() => { onRollover?.(id); setShowMenu(false); }}
                  className="w-full text-left px-4 py-2.5 text-sm text-foreground hover:bg-secondary flex items-center gap-3 transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  Rollover
                </button>
                <hr className="my-1 border-border/50" />
                <button
                  onClick={() => { onArchive?.(id); setShowMenu(false); }}
                  className="w-full text-left px-4 py-2.5 text-sm text-destructive hover:bg-secondary flex items-center gap-3 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Remove Budget
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex justify-between items-baseline">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground/80 font-medium">SPENT</p>
            <p className={`text-2xl font-black ${isOverBudget ? 'text-destructive' : 'text-foreground'}`}>
               {formatValue(spent)}
            </p>
          </div>
          <div className="text-right space-y-1">
            <p className="text-xs text-muted-foreground/80 font-medium uppercase">{isOverBudget ? 'Exceeded By' : 'Remaining'}</p>
            <p className={`text-xl font-bold ${isOverBudget ? 'text-destructive' : 'text-success'}`}>
               {formatValue(Math.abs(remaining))}
            </p>
          </div>
        </div>

        <div className="space-y-2">
            <div className="h-2.5 w-full bg-secondary rounded-full overflow-hidden">
                <div 
                    className={`h-full transition-all duration-700 rounded-full ${getProgressColor()}`}
                    style={{ width: `${Math.min(percentageUsed, 100)}%` }}
                />
            </div>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                   {getStatusIcon()}
                   <span className="text-[11px] font-bold text-muted-foreground uppercase">
                     {percentageUsed.toFixed(0)}% Utilized
                   </span>
                </div>
                <span className="text-[11px] font-bold text-muted-foreground uppercase">
                  Limit: {formatValue(amount)}
                </span>
            </div>
        </div>
      </div>
    </div>
  )
}
