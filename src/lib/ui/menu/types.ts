export interface MenuItem {
  label: string
  shortcut?: string
  action?: () => void
  options?: MenuItem[]
  disabled?: boolean
}
