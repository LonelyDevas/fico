import { useAuthStore } from "@/store/auth-store"
import { AxiosError } from "axios"
import toast from "react-hot-toast"

export const handleApiError = (error: any) => {
  const status = error.response?.status
  const data = error.response?.data.data ?? ''
  const message = error.response?.data.message ?? ''
  const errMessage = `${data} ${message}`.trim() || error?.message || 'Something went wrong'
  const clearAuth = useAuthStore.getState().clearAuth


  if (status === 401) {
    clearAuth()
    return
  }


  toast.error(
    status === 500
      ? "Internal server error"
      : errMessage
  )
}
