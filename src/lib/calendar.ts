export const WEEK_DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export function getCalendarDays(month: Date): Array<Date | null> {
  const firstWeekDay = month.getDay()
  const totalDays = new Date(
    month.getFullYear(),
    month.getMonth() + 1,
    0,
  ).getDate()
  const days: Array<Date | null> = Array.from(
    { length: firstWeekDay },
    () => null,
  )
  for (let day = 1; day <= totalDays; day += 1)
    days.push(new Date(month.getFullYear(), month.getMonth(), day))
  while (days.length % 7) days.push(null)
  return days
}
