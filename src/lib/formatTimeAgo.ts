export function formatTimeAgo(date: Date, language: string = 'en'): string {
  const rtf = new Intl.RelativeTimeFormat(language, { numeric: 'auto' })
  const daysDifference = Math.round((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  
  if (Math.abs(daysDifference) > 0) {
    return rtf.format(daysDifference, 'day')
  }

  const hoursDifference = Math.round((date.getTime() - Date.now()) / (1000 * 60 * 60))
  if (Math.abs(hoursDifference) > 0) {
    return rtf.format(hoursDifference, 'hour')
  }

  const minutesDifference = Math.round((date.getTime() - Date.now()) / (1000 * 60))
  if (Math.abs(minutesDifference) > 0) {
    return rtf.format(minutesDifference, 'minute')
  }

  return rtf.format(Math.round((date.getTime() - Date.now()) / 1000), 'second')
}
