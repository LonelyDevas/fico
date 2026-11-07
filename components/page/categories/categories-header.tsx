'use client'

import { Link } from 'react-router-dom'
import { BarChart3, Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface CategoriesHeaderProps {
  onAddCategory: () => void
  searchQuery: string
  onSearchChange: (value: string) => void
}

export function CategoriesHeader({
  onAddCategory,
  searchQuery,
  onSearchChange,
}: CategoriesHeaderProps) {
  return (
    <div className="flex flex-col gap-4 mb-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Categories</h1>
          <p className="text-muted-foreground">Manage your spending and income categories.</p>
        </div>
        <Button onClick={onAddCategory} className="flex items-center gap-2 rounded-full">
          <Plus className="w-4 h-4" />
          Add Category
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search categories..."
            className="pl-9 bg-card border-border rounded-xl"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        <Link
          to="/statistics#categories"
          className="flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-2 text-sm font-semibold text-primary shadow-ios hover:border-primary/50"
        >
          <BarChart3 className="h-4 w-4" />
          See insights
        </Link>
      </div>
    </div>
  )
}
