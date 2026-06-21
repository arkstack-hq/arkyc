const KEY = 'arkyc.theme'

export function initTheme(): void {
  if (localStorage.getItem(KEY) === 'dark') document.documentElement.classList.add('dark')
}

export function isDark(): boolean {
  return document.documentElement.classList.contains('dark')
}

export function toggleTheme(): boolean {
  const dark = document.documentElement.classList.toggle('dark')
  localStorage.setItem(KEY, dark ? 'dark' : 'light')
  return dark
}
