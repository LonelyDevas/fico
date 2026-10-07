"use client"
import React, { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import toast from 'react-hot-toast'
import { 
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useCreateCategory, useListCategories, useUpdateCategory } from '@/queries/user/category/categories'
import { Loader2 } from 'lucide-react'

const categorySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.enum(['income', 'expense']),
  color: z.string().optional(),
  icon: z.string().optional(),
})

type CategoryFormValues = z.infer<typeof categorySchema>

type CategorySeed = {
  id: string
  name?: string
  type?: 'income' | 'expense'
  color?: string
  icon?: string
}

export default function CategoryModal({ open, onClose, category }: { open: boolean; onClose: () => void; category?: CategorySeed | null }) {
  const { refetch } = useListCategories()
  const { mutate: createCategory, isPending } = useCreateCategory()
  const { mutate: updateCategory, isPending: isUpdating } = useUpdateCategory()
  const isEdit = !!category
  
  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: '',
      type: 'expense',
      color: '#6366f1',
      icon: '📂',
    },
  })

  useEffect(() => {
    if (!open) return

    if (category) {
      form.reset({
        name: category.name || '',
        type: category.type || 'expense',
        color: category.color || '#6366f1',
        icon: category.icon || '📂',
      })
      return
    }

    form.reset({
      name: '',
      type: 'expense',
      color: '#6366f1',
      icon: '📂',
    })
  }, [open, category, form])

  const onSubmit = (data: CategoryFormValues) => {
    if (isEdit && category) {
      updateCategory({
        id: category.id,
        name: data.name,
        color: data.color,
        icon: data.icon,
      }, {
        onSuccess: () => {
          toast.success('Category updated successfully')
          refetch()
          form.reset()
          onClose()
        },
        onError: (error: any) => {
          toast.error(error?.response?.data?.message || 'Failed to update category')
        }
      })
      return
    }

    createCategory(data, {
      onSuccess: () => {
        toast.success('Category created successfully')
        refetch()
        form.reset()
        onClose()
      },
      onError: (error: any) => {
        toast.error(error?.response?.data?.message || 'Failed to create category')
      }
    })
  }

  return (
    <Sheet open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <SheetContent className="sm:max-w-xl" showCloseButton={false}>
        <SheetHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <SheetTitle>{isEdit ? 'Edit Category' : 'Create New Category'}</SheetTitle>
              <SheetDescription>Manage the label, color, and icon for a category.</SheetDescription>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="max-md:hidden rounded-full p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              aria-label="Close"
            >
              X
            </button>
          </div>
        </SheetHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Name</label>
            <Input 
              {...form.register('name')} 
              placeholder="e.g. Groceries, Salary..." 
              className="bg-secondary/30"
            />
            {form.formState.errors.name && (
              <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Type</label>
            <Select 
              onValueChange={(value) => form.setValue('type', value as 'income' | 'expense')}
              defaultValue={form.getValues('type')}
              disabled={isEdit}
            >
              <SelectTrigger className="bg-secondary/30 w-full">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="expense">Expense</SelectItem>
                <SelectItem value="income">Income</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium focus:outline-none">Color</label>
              <div className="flex items-center gap-2">
                <Input 
                  type="color" 
                  {...form.register('color')} 
                  className="h-10 w-full p-1 bg-secondary/30 border-none cursor-pointer"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Icon (Emoji)</label>
              <Input 
                {...form.register('icon')} 
                placeholder="📂" 
                className="bg-secondary/30"
              />
            </div>
          </div>

          <SheetFooter className="px-0 pt-4 border-t-0">
            <Button type="button" variant="ghost" onClick={onClose} disabled={isPending || isUpdating}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || isUpdating} className="min-w-[100px]">
              {isPending || isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : isEdit ? 'Save Category' : 'Create Category'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}

